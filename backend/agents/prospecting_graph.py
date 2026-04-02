import logging
import operator
import json
import uuid
from typing import Annotated, Any, Dict, List, Sequence, TypedDict, Literal

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig

from core.llm_factory import get_llm
from core.database import SessionLocal, ProspectingCampaign, ProspectLead, UserIntegration
from core.encryption_service import encryption_service

logger = logging.getLogger(__name__)

# ─── Définition de l'État du Graphe ──────────────────────────────────────────

class ProspectingState(TypedDict):
    """État exhaustif pour le graphe de prospection autonome."""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    user_id: str
    campaign_id: str
    
    # Données de la mission
    brief: Dict[str, Any]      # {sector, city, offer, tone, target_type}
    leads: List[Dict[str, Any]] # Prospects avec infos, score, et drafts
    
    # Contrôle de flux
    next_node: str
    step_history: List[str]
    errors: List[str]
    config: Dict[str, Any] # Configuration additionnelle (BYOK, etc.)

# ─── Nœuds du Graphe (Squelette/Mocks) ───────────────────────────────────────

async def supervisor_node(state: ProspectingState, config: RunnableConfig = None) -> Dict[str, Any]:
    """
    Supervisor (Chef d'Orchestre) :
    Utilise Gemini pour analyser le brief et décider du routage.
    """
    logger.info(f"[Supervisor] Analyse de la mission pour {state.get('user_id')}")
    
    user_id = state.get("user_id")
    from core.memory import CoreMemory
    local_core = CoreMemory(user_id)
    agency_context = local_core.format_for_prompt()
    
    # Utilisation de Gemini 3 Flash Preview (Standard Projet)
    routing_model = "gemini-3-flash-preview"
    llm = get_llm(temperature=0.2, model_override=routing_model)
    
    system_prompt = f"""Tu es le Superviseur de Prospection FLARE AI.
Ton but : Transformer une intention vage en brief précis.

CONTEXTE AGENCE :
{agency_context}

BRIEF ACTUEL :
{json.dumps(state.get('brief', {}), indent=2)}

INSTRUCTIONS:
1. Si le brief est incomplet (cible, offre, ton), pose 1-3 questions courtes.
2. Si le brief est prêt, réponds EXACTEMENT par: "READY: [JSON_DU_BRIEF]"
3. Pour le JSON, utilise les clés : sector, city, target_type, offer, tone.
"""
    
    messages = [SystemMessage(content=system_prompt)] + list(state["messages"])
    response = await llm.ainvoke(messages)
    
    content = response.content.strip()
    next_node = "end"
    updated_brief = state.get("brief", {})
    
    if "READY:" in content:
        try:
            # Extraction JSON simplifiée
            json_str = content.split("READY:")[1].strip()
            # Nettoyage markdown
            json_str = json_str.replace("```json", "").replace("```", "").strip()
            updated_brief = json.loads(json_str)
            next_node = "researcher"
        except Exception as e:
            logger.error(f"Erreur parsing brief supervisor: {e}")
            next_node = "end"

    return {
        "messages": [response],
        "brief": updated_brief,
        "step_history": ["supervisor"],
        "next_node": next_node
    }

async def researcher_node(state: ProspectingState, config: RunnableConfig = None) -> Dict[str, Any]:
    """
    Researcher (Sourcing) :
    Utilise Google Search Grounding pour trouver des entreprises réelles.
    """
    brief = state.get("brief", {})
    sector = brief.get("sector", "communication")
    city = brief.get("city", "")
    
    logger.info(f"[Researcher] Sourcing reel pour {sector} à {city}")
    
    # Appel réel au Grounding
    try:
        from google import genai as _genai
        from google.genai import types as _types
        
        _client = _genai.Client(api_key=settings.GEMINI_API_KEY)
        search_tool = _types.Tool(google_search=_types.GoogleSearch())
        
        prompt = f"Trouve 5 entreprises réelles dans le secteur '{sector}' à '{city}'. Pour chaque entreprise, donne moi son nom exact, son site web officiel et une brève description de son activité."
        
        resp = _client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=_types.GenerateContentConfig(tools=[search_tool], temperature=0.1),
        )
        
        # Le Grounding donne des sources. On va demander au LLM de parser cela en JSON propre.
        parse_prompt = f"Extrais les entreprises de cette réponse sous forme de liste JSON [{{'company': ..., 'website': ..., 'description': ...}}]. \nCONTEXTE: {resp.text}"
        llm = get_llm(temperature=0, model_override="gemini-3-flash-preview")
        parse_resp = await llm.ainvoke([HumanMessage(content=parse_prompt)])
        
        # Nettoyage JSON
        json_str = parse_resp.content.replace("```json", "").replace("```", "").strip()
        found_leads = json.loads(json_str)
        
    except Exception as e:
        logger.error(f"Erreur sourcing researcher: {e}")
        found_leads = []

    return {
        "leads": found_leads,
        "step_history": ["researcher"],
        "next_node": "qualifier"
    }

async def qualifier_node(state: ProspectingState, config: RunnableConfig = None) -> Dict[str, Any]:
    """
    Qualifier (Scoring Agent) :
    Analyse la pertinence du lead par rapport à l'offre définie dans le brief.
    """
    logger.info(f"[Qualifier] Scoring des leads pour la campagne {state.get('campaign_id')}")
    
    brief = state.get("brief", {})
    offer = brief.get("offer", "")
    leads = state.get("leads", [])
    
    llm = get_llm(temperature=0, model_override="gemini-3-flash-preview")
    qualified_leads = []
    
    for lead in leads:
        # Prompt de qualification IA
        qual_prompt = f"""Analyse ce prospect pour décider s'il est pertinent pour notre offre.
OFFRE AGENCE : {offer}
PROSPECT : {lead.get('company')}
SITE WEB : {lead.get('website')}
DESCRIPTION : {lead.get('description')}

INSTRUCTIONS:
Réponds UNIQUEMENT par un objet JSON avec:
- score: (0-10) float. Pertinence par rapport à l'offre.
- valuation_notes: (string) Analyse spécifique (points forts/faibles).
"""
        try:
            resp = await llm.ainvoke([HumanMessage(content=qual_prompt)])
            # Parsing JSON
            json_str = resp.content.replace("```json", "").replace("```", "").strip()
            result = json.loads(json_str)
            
            score = result.get("score", 0)
            if score >= 5:
                lead.update(result)
                qualified_leads.append(lead)
            else:
                logger.info(f"[Qualifier] Lead rejeté: {lead.get('company')} (Score: {score})")
                
        except Exception as e:
            logger.error(f"Erreur qualification lead {lead.get('company')}: {e}")
            
    return {
        "leads": qualified_leads,
        "step_history": ["qualifier"],
        "next_node": "writer"
    }

async def writer_node(state: ProspectingState, config: RunnableConfig = None) -> Dict[str, Any]:
    """
    Writer (Copywriter Hyper-Personnalisé) :
    Rédige des messages en croisant CoreMemory, Brief et Valuation Notes.
    """
    logger.info(f"[Writer] Rédaction hyper-personnalisée...")
    
    user_id = state.get("user_id")
    from core.memory import CoreMemory
    local_core = CoreMemory(user_id)
    agency_context = local_core.format_for_prompt()
    
    brief = state.get("brief", {})
    leads = state.get("leads", [])
    
    llm = get_llm(temperature=0.7, model_override="gemini-3-flash-preview")
    updated_leads = []
    
    for lead in leads:
        write_prompt = f"""Rédige un email de prospection unique et percutant.
        
CONTEXTE AGENCE (CoreMemory):
{agency_context}

INFOS CAMPAGNE :
Offre: {brief.get('offer')}
Ton: {brief.get('tone')}

CIBLE :
Entreprise: {lead.get('company')}
Analyse Qualité: {lead.get('valuation_notes')}

CONSIGNES :
- Ne sois PAS générique. Fais référence aux 'valuation_notes'.
- Utilise le contexte de l'agence pour montrer notre expertise.
- Structure: Crochet accrocheur -> Valeur ajoutée -> Appel à l'action.
- Format de sortie: JSON avec keys "subject" et "body".
"""
        try:
            resp = await llm.ainvoke([HumanMessage(content=write_prompt)])
            json_str = resp.content.replace("```json", "").replace("```", "").strip()
            draft = json.loads(json_str)
            
            lead["draft_email"] = draft
            updated_leads.append(lead)
            
        except Exception as e:
            logger.error(f"Erreur rédaction pour {lead.get('company')}: {e}")
            
    return {
        "leads": updated_leads,
        "step_history": ["writer"],
        "next_node": "action_sender"
    }

async def action_sender_node(state: ProspectingState, config: RunnableConfig = None) -> Dict[str, Any]:
    """
    Action Sender (Omni-canal) :
    Gère l'envoi Gmail. Extensible : Twilio (SMS/Appels), WhatsApp.
    """
    logger.info(f"[ActionSender] Préparation de l'envoi omni-canal...")
    
    # NOTE : Intégrera la lecture de thread Gmail avant chaque envoi (Anti-spam)
    
    return {
        "step_history": ["action_sender"],
        "next_node": "planner"
    }

async def planner_node(state: ProspectingState, config: RunnableConfig = None) -> Dict[str, Any]:
    """
    Planner (Agenda/Meeting) :
    Intégration Google Calendar pour la planification de RDV automatiques.
    """
    logger.info(f"[Planner] Planification Google Calendar...")
    
    return {
        "step_history": ["planner"],
        "next_node": "end"
    }

# ─── Construction du Graphe ──────────────────────────────────────────────────

def _routing_logic(state: ProspectingState) -> str:
    """Logique de transition basée sur next_node."""
    node = state.get("next_node", "end")
    if node == "end":
        return END
    return node

def build_prospecting_graph():
    """Graphe de prospection complet avec HITL."""
    workflow = StateGraph(ProspectingState)
    
    # Déclaration des nœuds
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("qualifier", qualifier_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("action_sender", action_sender_node)
    workflow.add_node("planner", planner_node)
    
    # Flux principal
    workflow.set_entry_point("supervisor")
    
    workflow.add_conditional_edges("supervisor", _routing_logic)
    workflow.add_edge("researcher", "qualifier")
    workflow.add_edge("qualifier", "writer")
    workflow.add_edge("writer", "action_sender")
    workflow.add_edge("action_sender", "planner")
    workflow.add_edge("planner", END)
    
    # Persistence (Local Memory pour le dev)
    checkpointer = MemorySaver()
    
    # Interruption AVANT l'envoi pour validation humaine
    return workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["action_sender"]
    )

# Compilation globale
prospecting_graph = build_prospecting_graph()






