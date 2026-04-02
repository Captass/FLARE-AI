import logging
import random
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2

from core.auth import get_user_identity
from core.database import SessionLocal, ProspectingCampaign, ProspectLead
from core.config import settings
from core.gmail_service import send_email_via_api
from agents.prospecting_graph import prospecting_graph
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents/prospecting", tags=["Prospecting"])

# ─── Modèles Pydantic ────────────────────────────────────────────────────────

class ProspectingChatRequest(BaseModel):
    message: str
    campaign_id: Optional[str] = None # UUID de la campagne

class ProspectingChatResponse(BaseModel):
    response: str
    campaign_id: str
    brief: Dict[str, Any]

class LeadReviewResponse(BaseModel):
    campaign_id: str
    leads: List[Dict[str, Any]]

class LeadEmailPayload(BaseModel):
    campaign_id: str
    lead_email: str
    company_name: str
    subject: str
    body: str

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ProspectingChatResponse)
async def prospecting_chat(
    request: ProspectingChatRequest,
    authorization: Optional[str] = Header(None)
):
    """Dialogue initial avec le Supervisor pour définir le brief."""
    user_id, _ = get_user_identity(authorization)
    
    db = SessionLocal()
    campaign_id = request.campaign_id
    
    if not campaign_id:
        # Création d'une nouvelle campagne si non fournie
        campaign = ProspectingCampaign(
            user_id=user_id,
            status="draft",
            name="Nouvelle Campagne"
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        campaign_id = str(campaign.id)
    
    # Configuration du thread_id pour LangGraph
    thread_config = {"configurable": {"thread_id": campaign_id}}
    
    # Invocation du graphe (supervisor_node)
    initial_state = {
        "messages": [HumanMessage(content=request.message)],
        "user_id": user_id,
        "campaign_id": campaign_id,
        "brief": {},
        "leads": [],
        "step_history": [],
        "errors": []
    }
    
    # Note: On utilise astream ou ainvoke selon le besoin. Ici ainvoke pour la réponse simple.
    # Dans une version future, on pourra streamer les thoughts.
    try:
        # On essaie de récupérer l'état existant si campaign_id existe
        current_state = await prospecting_graph.aget_state(thread_config)
        if current_state.values:
            # On ajoute simplement le nouveau message
            result = await prospecting_graph.ainvoke(
                {"messages": [HumanMessage(content=request.message)]},
                config=thread_config
            )
        else:
            # Premier lancement
            result = await prospecting_graph.ainvoke(initial_state, config=thread_config)
            
        ai_message = result["messages"][-1].content
        brief = result.get("brief", {})
        
        # Mise à jour du prompt_context en DB pour persistance
        db_campaign = db.query(ProspectingCampaign).filter(ProspectingCampaign.id == campaign_id).first()
        if db_campaign:
            db_campaign.prompt_context = str(brief)
            db.commit()
            
        return ProspectingChatResponse(
            response=ai_message,
            campaign_id=campaign_id,
            brief=brief
        )
        
    except Exception as e:
        logger.error(f"Erreur prospecting chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/{campaign_id}/source")
async def launch_sourcing(
    campaign_id: str,
    authorization: Optional[str] = Header(None)
):
    """Lance le sourcing (passe du supervisor au researcher)."""
    user_id, _ = get_user_identity(authorization)
    thread_config = {"configurable": {"thread_id": campaign_id}}
    
    try:
        # On force le next_node à "researcher" et on lance
        result = await prospecting_graph.ainvoke(
            {"next_node": "researcher"}, 
            config=thread_config
        )
        
        # Le graphe va s'arrêter au interrupt_before(["action_sender"])
        return {"status": "sourcing_completed", "next_step": "review"}
        
    except Exception as e:
        logger.error(f"Erreur launch sourcing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{campaign_id}/review", response_model=LeadReviewResponse)
async def review_leads(
    campaign_id: str,
    authorization: Optional[str] = Header(None)
):
    """Récupère les leads qualifiés et leurs brouillons pour validation."""
    thread_config = {"configurable": {"thread_id": campaign_id}}
    
    state = await prospecting_graph.aget_state(thread_config)
    if not state.values:
        raise HTTPException(status_code=404, detail="Campagne introuvable ou non lancée.")
        
    leads = state.values.get("leads", [])
    return LeadReviewResponse(campaign_id=campaign_id, leads=leads)

@router.post("/{campaign_id}/approve")
async def approve_and_send(
    campaign_id: str,
    authorization: Optional[str] = Header(None)
):
    """Approuve la campagne et planifie les tâches dans Google Cloud Tasks."""
    user_id, _ = get_user_identity(authorization)
    
    # 1. Récupération de l'état (les brouillons d'emails générés)
    thread_config = {"configurable": {"thread_id": campaign_id}}
    state = await prospecting_graph.aget_state(thread_config)
    leads = state.values.get("leads", [])
    
    # Filtrer les leads prêts (score >= 5 et ayant un email)
    valid_leads = [l for l in leads if l.get("score", 0) >= 5 and l.get("email")]
    count = len(valid_leads)
    
    if count == 0:
        return {"status": "skipped", "message": "Aucun lead qualifié à envoyer."}

    # 2. Configuration du client Cloud Tasks
    client = tasks_v2.CloudTasksClient()
    parent = client.queue_path(
        settings.GOOGLE_CLOUD_PROJECT, 
        settings.GOOGLE_CLOUD_REGION, 
        "prospecting-queue"
    )

    # 3. Planification des tâches avec Anti-Spam Pacing
    now = datetime.utcnow()
    current_delay = 0 # En secondes
    
    tasks_created = 0
    for lead in valid_leads:
        # Pacing : délai aléatoire entre 3 et 6 minutes par email (en cumulé)
        # Sauf le premier qui peut partir de suite ou avec un petit délai
        if tasks_created > 0:
            current_delay += random.randint(180, 360) # +3-6 mins
            
        schedule_time = now + timedelta(seconds=current_delay)
        
        # Préparation du payload pour le worker
        payload = {
            "campaign_id": campaign_id,
            "lead_email": lead.get("email"),
            "company_name": lead.get("company_name"),
            "subject": lead.get("email_subject", "Offre de partenariat"),
            "body": lead.get("email_body", "")
        }
        
        # Construction de la Task HTTP
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": f"{settings.BACKEND_URL}/agents/prospecting/worker/send-email",
                "headers": {"Content-type": "application/json"},
                "body": json.dumps(payload).encode()
            }
        }
        
        # Conversion du datetime en Timestamp protobuf
        timestamp = timestamp_pb2.Timestamp()
        timestamp.FromDatetime(schedule_time)
        task["schedule_time"] = timestamp
        
        try:
            client.create_task(request={"parent": parent, "task": task})
            tasks_created += 1
        except Exception as e:
            logger.error(f"❌ Erreur création tâche Cloud Tasks: {e}")

    # 4. Mise à jour du statut de la campagne
    db = SessionLocal()
    try:
        campaign = db.query(ProspectingCampaign).filter(ProspectingCampaign.id == campaign_id).first()
        if campaign:
            campaign.status = "running"
            db.commit()
    finally:
        db.close()
        
    return {
        "status": "approved",
        "tasks_queued": tasks_created,
        "message": f"{tasks_created} emails planifiés avec un intervalle de 3-6 min."
    }

@router.post("/worker/send-email")
async def email_worker(payload: LeadEmailPayload):
    """Webhook appelé par Cloud Tasks pour l'envoi effectif via Gmail API."""
    db = SessionLocal()
    try:
        # 1. Récupération du lead et de la campagne pour identifier l'utilisateur
        lead = db.query(ProspectLead).filter(
            ProspectLead.campaign_id == payload.campaign_id,
            ProspectLead.email == payload.lead_email
        ).first()
        
        campaign = db.query(ProspectingCampaign).filter(
            ProspectingCampaign.id == payload.campaign_id
        ).first()

        if not lead or not campaign:
            logger.error(f"❌ Lead ou Campagne introuvable pour {payload.lead_email}")
            return {"status": "not_found"}

        # 2. Envoi via l'API Gmail (via notre service dédié)
        try:
            # On utilise le user_id de la campagne pour récupérer ses tokens
            send_email_via_api(
                user_id=campaign.user_id,
                to_email=payload.lead_email,
                subject=payload.subject,
                body=payload.body
            )
            
            # 3. Mise à jour du statut en cas de succès
            lead.status = "sent"
            lead.email_sent_at = datetime.utcnow()
            campaign.emails_sent = (campaign.emails_sent or 0) + 1
            db.commit()
            
            return {"status": "ok", "message": f"Sent via Gmail to {payload.lead_email}"}

        except Exception as e:
            logger.error(f"❌ Erreur Gmail Worker pour {payload.lead_email}: {e}")
            # On relance l'exception pour que Cloud Tasks puisse retenter la tâche (Retry)
            raise HTTPException(status_code=500, detail=str(e))
            
    except Exception as e:
        logger.error(f"Erreur worker email processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
