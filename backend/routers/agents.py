"""
Router Agents — Supervision et contrôle des sous-agents.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from core.database import SessionLocal, ProspectingCampaign, ProspectLead

router = APIRouter(prefix="/agents", tags=["Agents"])


class CampaignRequest(BaseModel):
    sector: str
    city: Optional[str] = ""
    target_count: Optional[int] = 10
    email_subject: Optional[str] = ""


@router.get("/cm/status")
async def get_cm_status():
    """Statut de l'Agent CM Facebook."""
    from agents.facebook_cm.agent import get_cm_agent
    agent = get_cm_agent()
    return agent.get_status()


@router.post("/prosp/launch")
async def launch_campaign(request: CampaignRequest):
    """Lance une campagne de prospection avec le Groupe de Prosp."""
    import uuid
    import asyncio

    db = SessionLocal()
    try:
        campaign = ProspectingCampaign(
            id=str(uuid.uuid4()),
            sector=request.sector,
            city=request.city or "",
            target_count=request.target_count,
            status="running",
        )
        db.add(campaign)
        db.commit()
        campaign_id = campaign.id
    finally:
        db.close()

    # Lancement en arrière-plan
    async def run_swarm():
        from agents.prosp_swarm.swarm import ProspSwarm
        swarm = ProspSwarm()
        await swarm.run_campaign(
            campaign_id=campaign_id,
            sector=request.sector,
            city=request.city or "",
            target_count=request.target_count,
            email_subject=request.email_subject or "",
        )

    asyncio.ensure_future(run_swarm())

    return {
        "campaign_id": campaign_id,
        "status": "running",
        "message": f"Campagne lancée pour {request.target_count} entreprises dans '{request.sector}'",
    }


@router.get("/prosp/campaigns")
async def list_campaigns(limit: int = 10):
    """Liste les campagnes de prospection."""
    db = SessionLocal()
    try:
        campaigns = (
            db.query(ProspectingCampaign)
            .order_by(ProspectingCampaign.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": c.id,
                "sector": c.sector,
                "city": c.city,
                "status": c.status,
                "leads_found": c.leads_found,
                "emails_sent": c.emails_sent,
                "responses": c.responses,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            }
            for c in campaigns
        ]
    finally:
        db.close()


@router.get("/prosp/campaigns/{campaign_id}/report")
async def get_campaign_report(campaign_id: str):
    """Récupère le rapport d'une campagne de prospection."""
    db = SessionLocal()
    try:
        campaign = db.query(ProspectingCampaign).filter(
            ProspectingCampaign.id == campaign_id
        ).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campagne introuvable.")
        return {
            "id": campaign.id,
            "sector": campaign.sector,
            "city": campaign.city,
            "status": campaign.status,
            "leads_found": campaign.leads_found,
            "emails_sent": campaign.emails_sent,
            "responses": campaign.responses,
            "report": campaign.report,
        }
    finally:
        db.close()


@router.get("/prosp/leads")
async def list_leads(
    campaign_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    """Liste les leads prospects avec filtres optionnels."""
    db = SessionLocal()
    try:
        query = db.query(ProspectLead)
        if campaign_id:
            query = query.filter(ProspectLead.campaign_id == campaign_id)
        if status:
            query = query.filter(ProspectLead.status == status)
        leads = query.order_by(ProspectLead.score.desc()).limit(limit).all()
        return [
            {
                "id": l.id,
                "company_name": l.company_name,
                "website": l.website,
                "email": l.email,
                "industry": l.industry,
                "city": l.city,
                "status": l.status,
                "score": l.score,
                "email_sent_at": l.email_sent_at.isoformat() if l.email_sent_at else None,
                "follow_up_at": l.follow_up_at.isoformat() if l.follow_up_at else None,
            }
            for l in leads
        ]
    finally:
        db.close()
