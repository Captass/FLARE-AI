"""
Worker Data & Workspace — FLARE AI.
Gère : Google Sheets, Drive, Docs, Gmail, Calendar + Agents legacy (FB CM, Prospection).
Modèle : Gemini Flash.
"""
import logging
import json
import operator
from typing import TypedDict, Annotated, Sequence, Literal, List

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig

from core.llm_factory import get_llm
from core.database import SessionLocal, ProspectingCampaign
from core.config import settings

logger = logging.getLogger(__name__)


# ─── Outils : Agents Legacy ──────────────────────────────────────────────────

@tool
def get_cm_facebook_status() -> str:
    """Obtenir le statut de l'Agent CM Facebook."""
    db = SessionLocal()
    try:
        from core.database import Conversation
        active = db.query(Conversation).filter(
            Conversation.platform == "messenger", Conversation.status == "active"
        ).count()
        total = db.query(Conversation).filter(Conversation.platform == "messenger").count()
    except Exception:
        active, total = 0, 0
    finally:
        db.close()
    return json.dumps({"statut": "en ligne", "conversations_actives": active, "total_messenger": total})


@tool
def launch_prospecting_campaign(secteur: str, ville: str = "", nombre_cibles: int = 10, objet_email: str = "") -> str:
    """Lancer une campagne de prospection email.

    Args:
        secteur: Secteur d'activité cible
        ville: Ville ou région cible
        nombre_cibles: Nombre d'entreprises à cibler
        objet_email: Objet de l'email
    """
    import asyncio
    import uuid as _uuid
    db = SessionLocal()
    try:
        campaign = ProspectingCampaign(
            id=str(_uuid.uuid4()), sector=secteur, city=ville,
            target_count=nombre_cibles, status="running",
        )
        db.add(campaign)
        db.commit()
        campaign_id = campaign.id
    finally:
        db.close()
    try:
        from agents.prosp_swarm.swarm import ProspSwarm
        swarm = ProspSwarm()
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(swarm.run_campaign(
                campaign_id=campaign_id, sector=secteur, city=ville,
                target_count=nombre_cibles, email_subject=objet_email,
            ))
    except Exception:
        pass
    return json.dumps({
        "statut": "campagne_lancee", "campaign_id": campaign_id,
        "secteur": secteur, "ville": ville or "France", "nombre_cibles": nombre_cibles,
    })


@tool
def get_prospecting_report() -> str:
    """Obtenir le rapport des campagnes de prospection (5 dernières)."""
    db = SessionLocal()
    try:
        campaigns = db.query(ProspectingCampaign).order_by(ProspectingCampaign.created_at.desc()).limit(5).all()
        if not campaigns:
            return json.dumps({"message": "Aucune campagne lancée."})
        return json.dumps([{
            "campaign_id": c.id, "secteur": c.sector, "ville": c.city, "statut": c.status,
            "leads_trouves": c.leads_found, "emails_envoyes": c.emails_sent,
            "reponses": c.responses,
            "taux_reponse": f"{(c.responses / c.emails_sent * 100):.1f}%" if c.emails_sent else "0%",
            "rapport": c.report or "En cours...",
        } for c in campaigns], ensure_ascii=False)
    finally:
        db.close()


# ─── Outils : Google Sheets ──────────────────────────────────────────────────

@tool
def read_google_sheets(spreadsheet_id: str, range_name: str) -> str:
    """Lire des données depuis Google Sheets.

    Args:
        spreadsheet_id: ID du classeur
        range_name: Plage à lire (ex: 'Planning!A1:F20')
    """
    try:
        from mcp.sheets import read_range
        return json.dumps(read_range(spreadsheet_id, range_name), ensure_ascii=False)
    except Exception as e:
        return f"Erreur lecture Sheets : {e}"


@tool
def write_google_sheets(spreadsheet_id: str, range_name: str, values: List[List[str]]) -> str:
    """Écrire dans Google Sheets.

    Args:
        spreadsheet_id: ID du classeur
        range_name: Plage cible
        values: Données (liste de listes)
    """
    try:
        from mcp.sheets import write_range
        write_range(spreadsheet_id, range_name, values)
        return f"Données écrites dans {range_name}."
    except Exception as e:
        return f"Erreur écriture Sheets : {e}"


@tool
def create_google_spreadsheet(title: str, sheet_names: List[str] = []) -> str:
    """Créer un classeur Google Sheets.

    Args:
        title: Titre du classeur
        sheet_names: Noms des feuilles
    """
    try:
        from mcp.sheets import create_spreadsheet
        return json.dumps(create_spreadsheet(title, sheet_names if sheet_names else None), ensure_ascii=False)
    except Exception as e:
        return f"Erreur création Sheets : {e}"


@tool
def list_google_spreadsheets() -> str:
    """Lister les classeurs Google Sheets récents."""
    try:
        from mcp.sheets import list_spreadsheets_in_drive
        return json.dumps(list_spreadsheets_in_drive(max_results=15), ensure_ascii=False)
    except Exception as e:
        return f"Erreur listing Sheets : {e}"


@tool
def get_spreadsheet_info(spreadsheet_id: str) -> str:
    """Métadonnées d'un classeur Sheets."""
    try:
        from mcp.sheets import get_spreadsheet_info as _gsi
        return json.dumps(_gsi(spreadsheet_id), ensure_ascii=False)
    except Exception as e:
        return f"Erreur info Sheets : {e}"


@tool
def append_row_sheets(spreadsheet_id: str, sheet_name: str, row: List[str]) -> str:
    """Ajouter une ligne à une feuille Sheets.

    Args:
        spreadsheet_id: ID du classeur
        sheet_name: Nom de la feuille
        row: Valeurs de la ligne
    """
    try:
        from mcp.sheets import append_row
        append_row(spreadsheet_id, sheet_name, row)
        return f"Ligne ajoutée à '{sheet_name}'."
    except Exception as e:
        return f"Erreur ajout ligne : {e}"


# ─── Outils : Google Drive ───────────────────────────────────────────────────

@tool
def search_google_drive(query: str, folder_id: str = "") -> str:
    """Rechercher des fichiers sur Google Drive.

    Args:
        query: Terme de recherche
        folder_id: ID du dossier (optionnel)
    """
    try:
        from mcp.drive import search_files
        results = search_files(query, folder_id if folder_id else None)
        return json.dumps(results, ensure_ascii=False) if results else "Aucun fichier trouvé."
    except Exception as e:
        return f"Erreur Drive : {e}"


@tool
def list_drive_folder(folder_id: str) -> str:
    """Lister le contenu d'un dossier Drive."""
    try:
        from mcp.drive import list_folder
        return json.dumps(list_folder(folder_id), ensure_ascii=False)
    except Exception as e:
        return f"Erreur listing Drive : {e}"


@tool
def create_drive_folder(name: str, parent_folder_id: str = "") -> str:
    """Créer un dossier Drive.

    Args:
        name: Nom du dossier
        parent_folder_id: Dossier parent (optionnel)
    """
    try:
        from mcp.drive import create_folder
        return json.dumps(create_folder(name, parent_folder_id if parent_folder_id else None), ensure_ascii=False)
    except Exception as e:
        return f"Erreur création dossier : {e}"


@tool
def share_drive_file(file_id: str, email: str, role: str = "reader") -> str:
    """Partager un fichier Drive.

    Args:
        file_id: ID du fichier
        email: Email du destinataire
        role: reader, commenter, writer
    """
    try:
        from mcp.drive import share_file
        return json.dumps(share_file(file_id, email, role), ensure_ascii=False)
    except Exception as e:
        return f"Erreur partage : {e}"


@tool
def upload_text_to_drive(filename: str, content: str, folder_id: str = "") -> str:
    """Uploader un fichier texte sur Drive.

    Args:
        filename: Nom du fichier
        content: Contenu texte
        folder_id: Dossier de destination (optionnel)
    """
    try:
        from mcp.drive import upload_text_as_file
        return json.dumps(upload_text_as_file(filename, content, folder_id=folder_id if folder_id else None), ensure_ascii=False)
    except Exception as e:
        return f"Erreur upload : {e}"


@tool
def get_drive_quota() -> str:
    """Informations de quota Drive."""
    try:
        from mcp.drive import get_storage_quota
        return json.dumps(get_storage_quota(), ensure_ascii=False)
    except Exception as e:
        return f"Erreur quota : {e}"


# ─── Outils : Google Docs ────────────────────────────────────────────────────

@tool
def create_google_doc(title: str, content: str = "") -> str:
    """Créer un Google Doc."""
    try:
        from mcp.docs import create_document
        return json.dumps(create_document(title, content), ensure_ascii=False)
    except Exception as e:
        return f"Erreur création Doc : {e}"


@tool
def read_google_doc(document_id: str) -> str:
    """Lire un Google Doc."""
    try:
        from mcp.docs import read_document
        return json.dumps(read_document(document_id), ensure_ascii=False)
    except Exception as e:
        return f"Erreur lecture Doc : {e}"


@tool
def append_to_google_doc(document_id: str, text: str) -> str:
    """Ajouter du texte à un Google Doc."""
    try:
        from mcp.docs import append_to_document
        return json.dumps(append_to_document(document_id, text), ensure_ascii=False)
    except Exception as e:
        return f"Erreur ajout Doc : {e}"


@tool
def list_google_docs() -> str:
    """Lister les Google Docs récents."""
    try:
        from mcp.docs import list_documents
        return json.dumps(list_documents(max_results=15), ensure_ascii=False)
    except Exception as e:
        return f"Erreur listing Docs : {e}"


# ─── Outils : Gmail ──────────────────────────────────────────────────────────

@tool
def send_gmail(to: str, subject: str, body: str, sender_email: str, cc: str = "") -> str:
    """Envoyer un email via Gmail.

    Args:
        to: Destinataire
        subject: Objet
        body: Corps du message
        sender_email: Email expéditeur
        cc: Copie (optionnel)
    """
    try:
        from mcp.gmail import send_email
        return json.dumps(send_email(to, subject, body, sender_email, cc), ensure_ascii=False)
    except Exception as e:
        return f"Erreur Gmail : {e}"


@tool
def read_gmail_inbox(user_email: str, max_results: int = 10, unread_only: bool = False) -> str:
    """Lire la boîte de réception Gmail."""
    try:
        from mcp.gmail import read_inbox
        return json.dumps(read_inbox(user_email, max_results, unread_only), ensure_ascii=False)
    except Exception as e:
        return f"Erreur Gmail : {e}"


@tool
def search_gmail(user_email: str, query: str, max_results: int = 10) -> str:
    """Rechercher des emails Gmail."""
    try:
        from mcp.gmail import search_emails
        return json.dumps(search_emails(user_email, query, max_results), ensure_ascii=False)
    except Exception as e:
        return f"Erreur Gmail : {e}"


# ─── Outils : Google Calendar ────────────────────────────────────────────────

@tool
def list_calendar_events(calendar_id: str = "primary", user_email: str = "", days_ahead: int = 7) -> str:
    """Lister les événements Calendar.

    Args:
        calendar_id: ID du calendrier
        user_email: Email pour délégation
        days_ahead: Jours en avant
    """
    try:
        from mcp.calendar_gws import list_events
        return json.dumps(list_events(
            calendar_id=calendar_id, user_email=user_email if user_email else None, days_ahead=days_ahead,
        ), ensure_ascii=False)
    except Exception as e:
        return f"Erreur Calendar : {e}"


@tool
def create_calendar_event(
    summary: str, start_datetime: str, end_datetime: str, description: str = "",
    location: str = "", attendees: List[str] = [], calendar_id: str = "primary", user_email: str = "",
) -> str:
    """Créer un événement Calendar.

    Args:
        summary: Titre
        start_datetime: Début ISO 8601
        end_datetime: Fin ISO 8601
        description: Description
        location: Lieu
        attendees: Emails des participants
        calendar_id: ID calendrier
        user_email: Email pour délégation
    """
    try:
        from mcp.calendar_gws import create_event
        return json.dumps(create_event(
            summary=summary, start_datetime=start_datetime, end_datetime=end_datetime,
            description=description, location=location,
            attendees=attendees if attendees else None,
            calendar_id=calendar_id, user_email=user_email if user_email else None,
        ), ensure_ascii=False)
    except Exception as e:
        return f"Erreur Calendar : {e}"


# ─── Liste des outils ────────────────────────────────────────────────────────

WORKSPACE_TOOLS = [
    # Agents Legacy
    get_cm_facebook_status,
    launch_prospecting_campaign,
    get_prospecting_report,
    # Google Sheets
    read_google_sheets,
    write_google_sheets,
    create_google_spreadsheet,
    list_google_spreadsheets,
    get_spreadsheet_info,
    append_row_sheets,
    # Google Drive
    search_google_drive,
    list_drive_folder,
    create_drive_folder,
    share_drive_file,
    upload_text_to_drive,
    get_drive_quota,
    # Google Docs
    create_google_doc,
    read_google_doc,
    append_to_google_doc,
    list_google_docs,
    # Gmail
    send_gmail,
    read_gmail_inbox,
    search_gmail,
    # Calendar
    list_calendar_events,
    create_calendar_event,
]

WORKSPACE_SYSTEM_PROMPT = """Tu es le Worker Workspace de FLARE AI. Ton rôle : gérer Google Workspace et les données.

RÈGLES:
- Manipule Google Sheets, Drive, Docs, Gmail et Calendar selon les demandes.
- Sois précis avec les IDs de fichiers et les plages de données.
- Pour les emails, vérifie toujours le destinataire avant envoi.
- Réponds en français. Sois concis.

PROACTIVITÉ : À la fin de TA réponse, propose TOUJOURS 2 à 3 actions ou questions de suivi pertinentes et concises pour l'utilisateur. 
Utilise EXACTEMENT ce format :
[SUGGESTION: Titre court de la suggestion 1]
[SUGGESTION: Titre court de la suggestion 2]"""


class WorkspaceWorker:
    """Worker Data & Workspace — graphe LangGraph autonome."""

    def __init__(self, model_override: str = None):
        self.tools = WORKSPACE_TOOLS
        self.llm = get_llm(
            temperature=0.3,
            model_override=model_override or "gemini-2.5-flash",
        ).bind_tools(self.tools)
        self.tool_node = ToolNode(self.tools)
        self.graph = self._build_graph()
        logger.info(f"[WorkspaceWorker] Initialisé avec {len(self.tools)} outils")

    def _build_graph(self):
        graph = StateGraph(TypedDict("WsState", {"messages": Annotated[Sequence[BaseMessage], operator.add]}))
        graph.add_node("agent", self._call_model)
        graph.add_node("tools", self.tool_node)
        graph.set_entry_point("agent")
        graph.add_conditional_edges("agent", self._should_continue, {"continue": "tools", "end": END})
        graph.add_edge("tools", "agent")
        return graph.compile()

    def _should_continue(self, state) -> Literal["continue", "end"]:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "continue"
        return "end"

    async def _call_model(self, state, config: RunnableConfig = None) -> dict:
        import asyncio
        messages = state["messages"]
        for attempt in range(3):
            try:
                return {"messages": [await self.llm.ainvoke(messages)]}
            except Exception as e:
                if attempt < 2 and any(k in str(e).lower() for k in ["429", "500", "503"]):
                    await asyncio.sleep(2 ** (attempt + 1))
                    continue
                raise

    async def run(self, task: str, config: dict = None) -> str:
        messages = [HumanMessage(content=f"[Instructions]\n{WORKSPACE_SYSTEM_PROMPT}\n[Fin instructions]\n\n{task}")]
        result = await self.graph.ainvoke({"messages": messages}, config=config or {})
        last_msg = result["messages"][-1]
        content = getattr(last_msg, "content", "")
        if isinstance(content, list):
            content = " ".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
        return content or "Tâche workspace terminée."







