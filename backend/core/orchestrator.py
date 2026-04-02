"""
Orchestrateur Central — FLARE AI.
Agent LangGraph avec mémoire, outils Google Workspace complets, skills et supervision.
"""
import asyncio
import logging
import json
import re
import operator
import uuid
import base64
from contextvars import ContextVar
from typing import TypedDict, Annotated, Sequence, Literal, Optional, List
from google.genai import types

# Variables de contexte partagées — importées depuis core.context (source unique de vérité)
from .context import (
    current_user_id as _current_user_id,
    generated_images as _generated_images,
    current_request_id as _current_request_id,
    current_session_id as _current_session_id,
    knowledge_saved as _knowledge_saved,
    GLOBAL_IMAGE_REGISTRY as _GLOBAL_IMAGE_REGISTRY,
    core_memory as _core_memory,
)

logger = logging.getLogger(__name__)

from langchain_core.messages import (
    BaseMessage, HumanMessage, AIMessage, SystemMessage
)
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig
from google import genai

from .llm_factory import get_llm
from .memory import SessionMemory, CoreMemory
from .database import SessionLocal, ProspectingCampaign, Skill
from .config import settings

# _core_memory est maintenant importé depuis core.context

SYSTEM_PROMPT = """Tu es FLARE AI, assistant personnel intelligent. Date: {current_date}

REGLES: Agis immediatement (appelle les outils, ne decris pas). Sois concis. Cite tes sources. Reponds en francais par defaut. Prompts image/video EN ANGLAIS.

OUTILS: generate_image, generate_video, web_search, execute_deep_research, search_knowledge_base, remember_fact, recall_facts, Google Workspace (Sheets, Docs, Drive, Gmail, Calendar).

{user_persona}
{core_memory}"""


# ─── Nettoyage des réponses ────────────────────────────────────────────────────

def _clean_response(content) -> str:
    """Nettoie la réponse en extrayant le texte utile. Conservatif pour ne pas perdre de contenu."""
    if not content:
        return ""
    # Gemini peut retourner une liste de parts (contenu multi-modal) → extraire le texte
    if isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, str):
                text_parts.append(part)
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)
            elif isinstance(part, dict) and part.get("text"):
                text_parts.append(part["text"])
        content = "\n".join(text_parts)
    if not isinstance(content, str):
        content = str(content)
    if not content:
        return ""
    # Supprimer les blocs <thought>...</thought> UNIQUEMENT s'il y a du contenu en dehors
    without_thoughts = re.sub(r'<thought>[\s\S]*?</thought>', '', content).strip()
    if without_thoughts:
        content = without_thoughts
    else:
        # Tout le contenu est dans les blocs thought — extraire le texte à l'intérieur
        thought_texts = re.findall(r'<thought>([\s\S]*?)</thought>', content)
        if thought_texts:
            content = "\n".join(thought_texts).strip()
    # Supprimer les artefacts JSON de tool calls textuels (seulement les patterns évidents)
    content = re.sub(
        r'^\s*\{["\s]*name["\s]*:\s*"[a-z_]+"\s*,[^}]*"parameters"\s*:\s*\{[^}]*\}\s*\}\s*$',
        '', content, flags=re.MULTILINE
    )
    content = re.sub(r'\n{3,}', '\n\n', content)
    return content.strip()


# ─── Outils : Agents & Supervision ────────────────────────────────────────────

@tool
def get_cm_facebook_status() -> str:
    """Obtenir le statut de l'Agent CM Facebook : conversations actives, messages traités aujourd'hui."""
    db = SessionLocal()
    try:
        from .database import Conversation
        active = db.query(Conversation).filter(
            Conversation.platform == "messenger",
            Conversation.status == "active"
        ).count()
        total = db.query(Conversation).filter(Conversation.platform == "messenger").count()
    except Exception:
        active = 0
        total = 0
    finally:
        db.close()
    return json.dumps({
        "statut": "en ligne",
        "conversations_actives": active,
        "total_conversations_messenger": total,
        "messages_traites_aujourd_hui": active,
    })


@tool
def launch_prospecting_campaign(
    secteur: str,
    ville: str = "",
    nombre_cibles: int = 10,
    objet_email: str = "",
) -> str:
    """Lancer une campagne de prospection par email avec le Groupe de Prosp.

    Args:
        secteur: Secteur d'activité des prospects (ex: 'restauration', 'immobilier')
        ville: Ville ou région cible (optionnel)
        nombre_cibles: Nombre d'entreprises à cibler (défaut: 10)
        objet_email: Objet de l'email (auto-généré si vide)
    """
    import uuid as _uuid
    db = SessionLocal()
    try:
        campaign = ProspectingCampaign(
            id=str(_uuid.uuid4()),
            sector=secteur,
            city=ville,
            target_count=nombre_cibles,
            status="running",
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
                campaign_id=campaign_id,
                sector=secteur,
                city=ville,
                target_count=nombre_cibles,
                email_subject=objet_email,
            ))
    except Exception:
        pass

    return json.dumps({
        "statut": "campagne_lancee",
        "campaign_id": campaign_id,
        "secteur": secteur,
        "ville": ville or "France",
        "nombre_cibles": nombre_cibles,
        "message": f"Campagne lancée ! Le Groupe de Prosp cible {nombre_cibles} entreprises dans '{secteur}'.",
    })


@tool
def get_prospecting_report() -> str:
    """Obtenir le rapport et les KPIs des campagnes de prospection (5 dernières)."""
    db = SessionLocal()
    try:
        campaigns = db.query(ProspectingCampaign).order_by(
            ProspectingCampaign.created_at.desc()
        ).limit(5).all()
        if not campaigns:
            return json.dumps({"message": "Aucune campagne de prospection lancée pour l'instant."})
        return json.dumps([{
            "campaign_id": c.id,
            "secteur": c.sector,
            "ville": c.city,
            "statut": c.status,
            "leads_trouves": c.leads_found,
            "emails_envoyes": c.emails_sent,
            "reponses": c.responses,
            "taux_reponse": f"{(c.responses / c.emails_sent * 100):.1f}%" if c.emails_sent else "0%",
            "rapport": c.report or "En cours...",
        } for c in campaigns], ensure_ascii=False)
    finally:
        db.close()


# ─── Outils : Mémoire ─────────────────────────────────────────────────────────

@tool
def remember_fact(key: str, value: str, category: str = "general") -> str:
    """Mémoriser un fait important de façon persistante (cross-conversations).

    Args:
        key: Clé unique du fait (ex: 'client_principal', 'budget_mensuel')
        value: Valeur à mémoriser
        category: Catégorie (general, client, agence, preference, projet)
    """
    _core_memory.upsert_fact(key, value, category)
    return f"Mémorisé ✓ [{category}] {key} = {value}"


@tool
def recall_facts(category: str = "") -> str:
    """Rappeler les faits mémorisés en mémoire persistante.

    Args:
        category: Filtrer par catégorie (laisser vide pour tout rappeler)
    """
    facts = _core_memory.get_all_facts(category if category else None)
    if not facts:
        return "Aucun fait mémorisé pour le moment."
    return json.dumps(facts, ensure_ascii=False)


# ─── Outils : Google Sheets ───────────────────────────────────────────────────

@tool
def read_google_sheets(spreadsheet_id: str, range_name: str) -> str:
    """Lire des données depuis Google Sheets.

    Args:
        spreadsheet_id: ID du classeur (dans l'URL Google Sheets)
        range_name: Plage à lire, ex: 'Planning!A1:F20'
    """
    try:
        from mcp.sheets import read_range
        data = read_range(spreadsheet_id, range_name)
        return json.dumps(data, ensure_ascii=False)
    except Exception as e:
        return f"Erreur lecture Sheets : {e}"


@tool
def write_google_sheets(spreadsheet_id: str, range_name: str, values: List[List[str]]) -> str:
    """Écrire des données dans Google Sheets.

    Args:
        spreadsheet_id: ID du classeur
        range_name: Plage cible, ex: 'Planning!A2'
        values: Données (liste de listes), ex: [["Nom", "Date", "Statut"]]
    """
    try:
        from mcp.sheets import write_range
        write_range(spreadsheet_id, range_name, values)
        return f"Données écrites avec succès dans {range_name}."
    except Exception as e:
        return f"Erreur écriture Sheets : {e}"


@tool
def create_google_spreadsheet(title: str, sheet_names: List[str] = []) -> str:
    """Créer un nouveau classeur Google Sheets.

    Args:
        title: Titre du classeur
        sheet_names: Noms des feuilles (ex: ['Planning', 'Leads', 'Reporting'])
    """
    try:
        from mcp.sheets import create_spreadsheet
        result = create_spreadsheet(title, sheet_names if sheet_names else None)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur création Sheets : {e}"


@tool
def list_google_spreadsheets() -> str:
    """Lister les classeurs Google Sheets récents accessibles."""
    try:
        from mcp.sheets import list_spreadsheets_in_drive
        sheets = list_spreadsheets_in_drive(max_results=15)
        return json.dumps(sheets, ensure_ascii=False)
    except Exception as e:
        return f"Erreur listing Sheets : {e}"


@tool
def get_spreadsheet_info(spreadsheet_id: str) -> str:
    """Obtenir les métadonnées d'un classeur Sheets (titre, feuilles, dimensions).

    Args:
        spreadsheet_id: ID du classeur
    """
    try:
        from mcp.sheets import get_spreadsheet_info as _gsi
        info = _gsi(spreadsheet_id)
        return json.dumps(info, ensure_ascii=False)
    except Exception as e:
        return f"Erreur info Sheets : {e}"


@tool
def append_row_sheets(spreadsheet_id: str, sheet_name: str, row: List[str]) -> str:
    """Ajouter une ligne à la fin d'une feuille Google Sheets.

    Args:
        spreadsheet_id: ID du classeur
        sheet_name: Nom de la feuille
        row: Valeurs de la ligne (liste)
    """
    try:
        from mcp.sheets import append_row
        append_row(spreadsheet_id, sheet_name, row)
        return f"Ligne ajoutée à '{sheet_name}'."
    except Exception as e:
        return f"Erreur ajout ligne Sheets : {e}"


# ─── Outils : Google Drive ────────────────────────────────────────────────────

@tool
def search_google_drive(query: str, folder_id: str = "") -> str:
    """Rechercher des fichiers sur Google Drive.

    Args:
        query: Terme de recherche, ex: 'catalogue offres 2024'
        folder_id: ID du dossier à fouiller (optionnel)
    """
    try:
        from mcp.drive import search_files
        results = search_files(query, folder_id if folder_id else None)
        if not results:
            return "Aucun fichier trouvé pour cette recherche."
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        return f"Erreur recherche Drive : {e}"


@tool
def list_drive_folder(folder_id: str) -> str:
    """Lister le contenu d'un dossier Google Drive.

    Args:
        folder_id: ID du dossier à lister
    """
    try:
        from mcp.drive import list_folder
        files = list_folder(folder_id)
        return json.dumps(files, ensure_ascii=False)
    except Exception as e:
        return f"Erreur listing Drive : {e}"


@tool
def create_drive_folder(name: str, parent_folder_id: str = "") -> str:
    """Créer un dossier sur Google Drive.

    Args:
        name: Nom du dossier
        parent_folder_id: ID du dossier parent (optionnel)
    """
    try:
        from mcp.drive import create_folder
        result = create_folder(name, parent_folder_id if parent_folder_id else None)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur création dossier Drive : {e}"


@tool
def share_drive_file(file_id: str, email: str, role: str = "reader") -> str:
    """Partager un fichier Drive avec un utilisateur.

    Args:
        file_id: ID du fichier
        email: Email de la personne
        role: Rôle parmi reader, commenter, writer
    """
    try:
        from mcp.drive import share_file
        result = share_file(file_id, email, role)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur partage Drive : {e}"


@tool
def upload_text_to_drive(filename: str, content: str, folder_id: str = "") -> str:
    """Uploader un fichier texte sur Google Drive.

    Args:
        filename: Nom du fichier (ex: 'rapport.txt', 'donnees.csv')
        content: Contenu texte du fichier
        folder_id: ID du dossier de destination (optionnel)
    """
    try:
        from mcp.drive import upload_text_as_file
        result = upload_text_as_file(filename, content, folder_id=folder_id if folder_id else None)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur upload Drive : {e}"


@tool
def get_drive_quota() -> str:
    """Obtenir les informations de quota de stockage Google Drive."""
    try:
        from mcp.drive import get_storage_quota
        return json.dumps(get_storage_quota(), ensure_ascii=False)
    except Exception as e:
        return f"Erreur quota Drive : {e}"


# ─── Outils : Google Docs ─────────────────────────────────────────────────────

@tool
def create_google_doc(title: str, content: str = "") -> str:
    """Créer un nouveau document Google Docs.

    Args:
        title: Titre du document
        content: Contenu initial (texte brut, optionnel)
    """
    try:
        from mcp.docs import create_document
        result = create_document(title, content)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur création Doc : {e}"


@tool
def read_google_doc(document_id: str) -> str:
    """Lire le contenu d'un Google Doc.

    Args:
        document_id: ID du document (dans l'URL)
    """
    try:
        from mcp.docs import read_document
        result = read_document(document_id)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur lecture Doc : {e}"


@tool
def append_to_google_doc(document_id: str, text: str) -> str:
    """Ajouter du texte à la fin d'un Google Doc.

    Args:
        document_id: ID du document
        text: Texte à ajouter
    """
    try:
        from mcp.docs import append_to_document
        result = append_to_document(document_id, text)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur ajout texte Doc : {e}"


@tool
def list_google_docs() -> str:
    """Lister les Google Docs récents accessibles par le Service Account."""
    try:
        from mcp.docs import list_documents
        docs = list_documents(max_results=15)
        return json.dumps(docs, ensure_ascii=False)
    except Exception as e:
        return f"Erreur listing Docs : {e}"


# ─── Outils : Gmail ───────────────────────────────────────────────────────────

@tool
def send_gmail(to: str, subject: str, body: str, sender_email: str, cc: str = "") -> str:
    """Envoyer un email via Gmail.

    Args:
        to: Email du destinataire
        subject: Objet du message
        body: Corps de l'email (texte brut)
        sender_email: Email expéditeur (doit avoir délégation de domaine configurée)
        cc: Emails en copie (séparés par virgule, optionnel)
    """
    try:
        from mcp.gmail import send_email
        result = send_email(to, subject, body, sender_email, cc)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur envoi Gmail : {e}\nNote: la délégation de domaine doit être configurée."


@tool
def read_gmail_inbox(user_email: str, max_results: int = 10, unread_only: bool = False) -> str:
    """Lire la boîte de réception Gmail.

    Args:
        user_email: Email de l'utilisateur (délégation requise)
        max_results: Nombre d'emails à retourner
        unread_only: Si True, retourne uniquement les non-lus
    """
    try:
        from mcp.gmail import read_inbox
        emails = read_inbox(user_email, max_results, unread_only)
        return json.dumps(emails, ensure_ascii=False)
    except Exception as e:
        return f"Erreur lecture Gmail : {e}"


@tool
def search_gmail(user_email: str, query: str, max_results: int = 10) -> str:
    """Rechercher des emails Gmail.

    Args:
        user_email: Email de l'utilisateur
        query: Requête Gmail (ex: 'from:client@example.com', 'subject:devis', 'is:unread')
        max_results: Nombre maximum de résultats
    """
    try:
        from mcp.gmail import search_emails
        results = search_emails(user_email, query, max_results)
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        return f"Erreur recherche Gmail : {e}"


# ─── Outils : Google Calendar ─────────────────────────────────────────────────

@tool
def list_calendar_events(calendar_id: str = "primary", user_email: str = "", days_ahead: int = 7) -> str:
    """Lister les prochains événements Google Calendar.

    Args:
        calendar_id: ID du calendrier ('primary' ou email partagé avec le Service Account)
        user_email: Email pour délégation de domaine (optionnel)
        days_ahead: Nombre de jours à regarder en avant (défaut: 7)
    """
    try:
        from mcp.calendar_gws import list_events
        events = list_events(
            calendar_id=calendar_id,
            user_email=user_email if user_email else None,
            days_ahead=days_ahead,
        )
        return json.dumps(events, ensure_ascii=False)
    except Exception as e:
        return f"Erreur Calendar : {e}"


@tool
def create_calendar_event(
    summary: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    location: str = "",
    attendees: List[str] = [],
    calendar_id: str = "primary",
    user_email: str = "",
) -> str:
    """Créer un événement dans Google Calendar.

    Args:
        summary: Titre de l'événement
        start_datetime: Début ISO 8601 (ex: '2024-12-25T10:00:00+01:00')
        end_datetime: Fin ISO 8601
        description: Description (optionnel)
        location: Lieu (optionnel)
        attendees: Liste d'emails des participants (optionnel)
        calendar_id: ID du calendrier ('primary' par défaut)
        user_email: Email pour délégation (optionnel)
    """
    try:
        from mcp.calendar_gws import create_event
        result = create_event(
            summary=summary,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            description=description,
            location=location,
            attendees=attendees if attendees else None,
            calendar_id=calendar_id,
            user_email=user_email if user_email else None,
        )
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Erreur création événement Calendar : {e}"


# ─── Outils : Skills / Compétences ────────────────────────────────────────────

@tool
def create_skill(name: str, title: str, description: str, prompt_template: str, category: str = "general") -> str:
    """Créer une nouvelle compétence personnalisée pour FLARE AI.

    Args:
        name: Identifiant unique snake_case (ex: 'rediger_post_instagram')
        title: Titre lisible (ex: 'Rédiger un post Instagram')
        description: Ce que fait cette compétence
        prompt_template: Template du prompt avec {{variables}} (ex: 'Rédige un post pour {{sujet}} dans le style {{ton}}')
        category: Catégorie parmi general, marketing, google, analyse, automatisation
    """
    from datetime import datetime as _dt
    name_clean = name.strip().lower().replace(" ", "_")
    db = SessionLocal()
    try:
        existing = db.query(Skill).filter(Skill.name == name_clean).first()
        if existing:
            existing.title = title
            existing.description = description
            existing.prompt_template = prompt_template
            existing.category = category
            existing.updated_at = _dt.utcnow()
            db.commit()
            return f"Compétence '{name_clean}' mise à jour ✓"
        else:
            skill = Skill(
                name=name_clean,
                title=title,
                description=description,
                prompt_template=prompt_template,
                category=category,
                is_active="true",
                usage_count=0,
            )
            db.add(skill)
            db.commit()
            return f"Compétence '{name_clean}' créée ✓ — Catégorie: {category}"
    except Exception as e:
        return f"Erreur création compétence : {e}"
    finally:
        db.close()


@tool
def list_skills(category: str = "") -> str:
    """Lister les compétences disponibles dans FLARE AI.

    Args:
        category: Filtrer par catégorie (laisser vide pour tout voir)
    """
    db = SessionLocal()
    try:
        query = db.query(Skill).filter(Skill.is_active == "true")
        if category:
            query = query.filter(Skill.category == category)
        skills = query.order_by(Skill.category, Skill.title).all()
        if not skills:
            return "Aucune compétence disponible. Vous pouvez m'en créer avec create_skill !"
        return json.dumps([{
            "name": s.name,
            "title": s.title,
            "description": s.description,
            "category": s.category,
            "usage_count": s.usage_count or 0,
        } for s in skills], ensure_ascii=False)
    finally:
        db.close()


@tool
def use_skill(skill_name: str, variables_json: str = "{}") -> str:
    """Utiliser une compétence et générer le contenu final avec l'IA.

    Args:
        skill_name: Nom de la compétence (ex: 'post_instagram', 'email_prospection')
        variables_json: Variables JSON à substituer (ex: '{"sujet": "RAM FLARE", "ton": "professionnel"}')
    """
    from datetime import datetime as _dt
    db = SessionLocal()
    try:
        skill = db.query(Skill).filter(Skill.name == skill_name).first()
        if not skill:
            available = ", ".join(
                s.name for s in db.query(Skill).filter(Skill.is_active == "true").all()
            )
            return f"Compétence '{skill_name}' introuvable. Disponibles : {available or 'aucune'}"
        if skill.is_active != "true":
            return f"La compétence '{skill_name}' est désactivée."

        try:
            variables = json.loads(variables_json) if variables_json.strip() not in ("{}", "") else {}
        except json.JSONDecodeError:
            variables = {}

        prompt = skill.prompt_template
        for key, val in variables.items():
            prompt = prompt.replace(f"{{{{{key}}}}}", str(val))

        skill.usage_count = (skill.usage_count or 0) + 1
        skill.updated_at = _dt.utcnow()
        db.commit()
    finally:
        db.close()

    # ── Exécuter le prompt avec le LLM pour générer le contenu final ──────────
    try:
        llm = get_llm(temperature=0.8, model_override="gemini-2.5-flash-lite", purpose="assistant_fast")
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content if hasattr(response, "content") else str(response)
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        return content.strip() or "La compétence n'a pas généré de contenu."
    except Exception as e:
        return f"Erreur lors de l'exécution de la compétence : {e}"


# ─── Outils : Base de Connaissances ──────────────────────────────────────────

@tool
def search_knowledge_base(query: str) -> str:
    """Chercher dans la base de connaissances personnelle de l'utilisateur.
    Utiliser SYSTÉMATIQUEMENT pour les questions techniques, stratégiques ou spécifiques.

    Args:
        query: Question ou mots-clés à rechercher (ex: 'stratégie Instagram 2025', 'procédure facturation')
    """
    user_id = _current_user_id.get()
    try:
        from .firebase_client import knowledge_manager as kb
        results = kb.search_knowledge(user_id, query, limit=5)
            
        if not results:
            return f"Aucun document trouvé pour '{query}' dans la base de connaissances."
        
        docs_text = []
        for doc in results:
            meta = doc.get('metadata', {})
            # similarity n'est plus retourné tel quel par SQLAlchemy, on affiche le titre
            docs_text.append(
                f"### {meta.get('title', 'Sans titre')}\n"
                f"{doc.get('content', '')[:2000]}"
            )
        return f"Documents trouvés ({len(results)}) :\n\n" + "\n\n---\n\n".join(docs_text)
    except Exception as e:
        logger.error(f"Erreur recherche base de connaissances : {e}")
        return f"Erreur recherche base de connaissances : {e}"


@tool
def add_to_knowledge_base(title: str, content: str, source: str = "") -> str:
    """Ajouter un document dans la base de connaissances de l'utilisateur.
    Utiliser quand l'utilisateur partage une information importante, un rapport, une procédure.

    Args:
        title: Titre descriptif du document (ex: 'Stratégie Instagram Q1 2025')
        content: Contenu complet du document
        source: Source du document (ex: 'conversation', 'rapport interne', URL)
    """
    user_id = _current_user_id.get()
    try:
        from .firebase_client import knowledge_manager as kb
        doc_id = kb.add_knowledge(
            user_id=user_id,
            title=title,
            content=content,
            source=source or "agent",
            doc_type="agent_added",
        )
            
        if not doc_id:
            return "Erreur lors de l'ajout du document à la base vectorielle."

        word_count = len(content.split())
        # Enregistrer le titre pour notification frontend
        saved = _knowledge_saved.get() or []
        saved.append(title)
        _knowledge_saved.set(saved)
        return f"Document '{title}' ajouté (vectorisé) à la base de connaissances ✓ (ID: {doc_id}, {word_count} mots)"
    except Exception as e:
        logger.error(f"Erreur ajout base de connaissances : {e}")
        return f"Erreur ajout base de connaissances : {e}"


@tool
def list_knowledge_docs() -> str:
    """Lister les documents dans la base de connaissances (ID + titre).
    Utiliser avant d'ajouter un document pour vérifier si le sujet est déjà couvert.
    """
    user_id = _current_user_id.get()
    try:
        from .firebase_client import knowledge_manager as kb
        docs = kb.get_user_knowledge(user_id)
        
        if not docs:
            return "Aucun document dans la base de connaissances."
        lines = [f"- ID: {d['id']} | Titre: {d['title']} ({len(d['content'].split())} mots)" for d in docs]
        return f"{len(docs)} document(s) :\n" + "\n".join(lines)
    except Exception as e:
        logger.error(f"Erreur listing base de connaissances : {e}")
        return f"Erreur listing base de connaissances : {e}"


@tool
def update_knowledge_doc(doc_id: str, additional_content: str) -> str:
    """Mettre à jour un document existant (en crée un nouveau versionné ou le remplace).
    Note: Actuellement, on crée un nouveau document car la mise à jour vectorielle nécessite tout recalculer.
    """
    # Pour l'instant, on redirige vers l'ajout d'un nouveau document pour des raisons de simplicité vectorielle
    return "L'édition directe de documents vectoriels arrive. En attendant, veuillez utiliser 'add_to_knowledge_base' pour ajouter les nouvelles informations."


# ─── Liste des outils de l'orchestrateur ──────────────────────────────────────

ORCHESTRATOR_TOOLS = [
    # Agents
    get_cm_facebook_status,
    launch_prospecting_campaign,
    get_prospecting_report,
    # Mémoire
    remember_fact,
    recall_facts,
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
    # Google Calendar
    list_calendar_events,
    create_calendar_event,
    # Skills
    create_skill,
    list_skills,
    use_skill,
    # Base de connaissances
    search_knowledge_base,
    list_knowledge_docs,
    add_to_knowledge_base,
    update_knowledge_doc,
]


# ─── Outils : Création d'Images ───────────────────────────────────────────────

@tool
async def generate_image(prompt: str, config: RunnableConfig) -> str:
    """Générer une image à l'aide de l'IA (modèle Imagen 3 ou Gemini multimodal).
    Utiliser cet outil UNIQUEMENT si l'utilisateur demande explicitement une image, photo, illustration ou dessin.
    """
    # Récupérer le contexte via RunnableConfig (robuste pour LangGraph)
    configurable = config.get("configurable", {})
    user_id = configurable.get("user_id", "anonymous")
    session_id = configurable.get("session_id", "default")
    req_id = configurable.get("request_id")
    
    logger.info(f"🔍 [generate_image] config: user_id={user_id}, session_id={session_id}, req_id={req_id}")
    
    # Récupérer la liste d'images depuis le registre global ou le contextvar
    if req_id and req_id in _GLOBAL_IMAGE_REGISTRY:
        current_images = _GLOBAL_IMAGE_REGISTRY[req_id]
    else:
        current_images = _generated_images.get() or []
        
    # Modèles Imagen dédiés (génération via generate_images) — region: us-central1
    IMAGEN_MODELS = {
        "imagen-3.0-generate-001",
        "imagen-3.0-fast-generate-001",
        "imagen-4.0-generate-001",
        "imagen-4.0-fast-generate-001",
        "imagen-4.0-ultra-generate-001",
    }
    # Ordre de préférence : modèles stables en premier, expérimentaux en fallback
    MODELS_TO_TRY = [
        "imagen-3.0-generate-001",          # Imagen 3 stable (priorité — disponible globalement)
        "imagen-3.0-fast-generate-001",     # Imagen 3 Fast
        "imagen-4.0-generate-001",          # Imagen 4 stable
        "imagen-4.0-fast-generate-001",     # Imagen 4 Fast
        "imagen-4.0-ultra-generate-001",    # Imagen 4 Ultra
        "gemini-3-flash-preview",           # Gemini 3 Flash (fallback)
    ]

    # Initialiser le client GenAI (Vertex AI prioritaire, sinon clé API globale)
    # Imagen requiert us-central1 ou europe-west4 — on force us-central1
    if settings.LLM_PROVIDER == "vertexai":
        client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location="us-central1",
        )
        logger.info(f"[generate_image] Vertex AI project={settings.GOOGLE_CLOUD_PROJECT} location=us-central1")
    else:
        effective_key = settings.GEMINI_API_KEY
        if not effective_key:
            return "La génération d'image est actuellement désactivée."
        client = genai.Client(api_key=effective_key)
        logger.info(f"[generate_image] Usage clé API globale (AI Studio)")

    raw_bytes = None
    applied_model = None

    for model_name in MODELS_TO_TRY:
        try:
            if model_name in IMAGEN_MODELS:
                # Modèles dédiés Imagen — closure fix: capturer model_name par défaut
                def _call_imagen(m=model_name):
                    return client.models.generate_images(
                        model=m,
                        prompt=prompt,
                        config=types.GenerateImagesConfig(
                            number_of_images=1,
                            output_mime_type="image/jpeg"
                        )
                    )
                res = await asyncio.wait_for(asyncio.to_thread(_call_imagen), timeout=90)
                if res and res.generated_images:
                    raw_bytes = res.generated_images[0].image.image_bytes
                    applied_model = model_name
                    break
            else:
                # Modèles Multimodaux Gemini — nécessite response_modalities=["IMAGE"]
                def _call_gemini(m=model_name):
                    return client.models.generate_content(
                        model=m,
                        contents=f"Génère uniquement une image réaliste et de haute qualité basée sur cette description : {prompt}",
                        config=types.GenerateContentConfig(
                            response_modalities=["TEXT", "IMAGE"]
                        )
                    )
                res = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=90)
                if res.candidates:
                    for part in res.candidates[0].content.parts:
                        if part.inline_data:
                            raw_bytes = part.inline_data.data
                            applied_model = model_name
                            break
                if raw_bytes:
                    break
        except asyncio.TimeoutError:
            logger.warning(f"[generate_image] Timeout (90s) pour le modèle {model_name}")
            continue
        except Exception as model_err:
            logger.warning(f"[generate_image] Modèle {model_name} indisponible : {model_err}")
            continue

    if not raw_bytes:
        logger.error(f"[generate_image] Tous les modèles ont échoué pour prompt='{prompt[:50]}'")
        return "Désolé, je n'ai pas pu générer cette image pour le moment. Tous les modèles de génération d'image sont temporairement indisponibles. Réessayez dans quelques instants ou décrivez autrement votre demande."

    try:
        # Persistence : Upload sur Firebase Storage (session-scoped)
        file_uuid = str(uuid.uuid4())[:8]
        storage_path = f"users/{user_id}/conversations/{session_id}/gen_{file_uuid}.jpg"
        
        from .firebase_client import firebase_storage as storage
        public_url = storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path,
            file_bytes=raw_bytes,
            content_type="image/jpeg"
        )
        
        # Enregistrement dans la "Base de données fichiers" de la conversation (SQL)
        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=f"gen_{file_uuid}.jpg",
                    file_url=public_url,
                    file_type="image",
                    mime_type="image/jpeg",
                    file_size=len(raw_bytes)
                )
            except Exception as sql_err:
                logger.error(f"⚠️ Erreur enregistrement SQL image: {sql_err}")

        b64_img = base64.b64encode(raw_bytes).decode('utf-8')
        img_obj = {
            "prompt": prompt,
            "type": "image/jpeg",
            "data": b64_img,
            "url": public_url
        }
        current_images.append(img_obj)

        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_images
        _generated_images.set(current_images)

        logger.info(f"IMAGE GÉNÉRÉE ET STOCKÉE ({applied_model}): {storage_path}")
        return f"Succès : L'image a été générée avec {applied_model} et enregistrée dans vos fichiers de discussion."

    except Exception as e:
        logger.error(f"Erreur persistence generate_image: {e}")
        return "L'image a été générée mais n'a pas pu être persistée dans vos fichiers."

ORCHESTRATOR_TOOLS.append(generate_image)


@tool
async def generate_video(prompt: str, config: RunnableConfig) -> str:
    """Générer une vidéo à l'aide de l'IA (modèle VEO 2/3).
    Utiliser cet outil UNIQUEMENT si l'utilisateur demande explicitement une vidéo, animation ou clip vidéo.
    """
    configurable = config.get("configurable", {})
    user_id = configurable.get("user_id", "anonymous")
    session_id = configurable.get("session_id", "default")
    req_id = configurable.get("request_id")

    logger.info(f"🎥 [generate_video] user_id={user_id}, session_id={session_id}, req_id={req_id}")

    # Récupérer la liste de médias depuis le registre global ou le contextvar
    if req_id and req_id in _GLOBAL_IMAGE_REGISTRY:
        current_media = _GLOBAL_IMAGE_REGISTRY[req_id]
    else:
        current_media = _generated_images.get() or []

    # VEO requiert us-central1 — on force la région
    if settings.LLM_PROVIDER == "vertexai":
        client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location="us-central1",
        )
        logger.info(f"[generate_video] Vertex AI project={settings.GOOGLE_CLOUD_PROJECT} location=us-central1")
    else:
        effective_key = settings.GEMINI_API_KEY
        if not effective_key:
            return "La génération vidéo est actuellement désactivée."
        client = genai.Client(api_key=effective_key)
        logger.info(f"[generate_video] Usage clé API globale (AI Studio)")

    # Modèles VEO — VEO 3.1 en priorité (meilleure qualité)
    MODELS_TO_TRY = [
        "veo-3.0-generate-001",           # VEO 3.1 (priorité)
        "veo-2.0-generate-001",           # VEO 2 (fallback)
    ]

    video_bytes = None
    applied_model = None

    for model_name in MODELS_TO_TRY:
        try:
            logger.info(f"[generate_video] Tentative avec {model_name}...")

            def _call_veo_and_wait(m=model_name):
                """Appel VEO + polling bloquant dans un thread dédié (max 4 min)."""
                import time as _time
                op = client.models.generate_videos(
                    model=m,
                    prompt=prompt,
                    config=types.GenerateVideosConfig(
                        aspect_ratio="16:9",
                        number_of_videos=1,
                    )
                )
                logger.info(f"[generate_video] Opération lancée, polling...")
                max_wait = 240  # 4 minutes
                elapsed = 0
                while not op.done:
                    if elapsed >= max_wait:
                        raise TimeoutError(f"VEO timeout après {max_wait}s")
                    _time.sleep(10)
                    elapsed += 10
                    op = client.operations.get(op)
                    logger.info(f"[generate_video] Poll {elapsed}s — done={op.done}")
                return op

            # Exécuter l'appel + polling dans un thread (max 4m30s total)
            operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_and_wait), timeout=270)
            logger.info(f"[generate_video] Opération terminée. done={operation.done}")
            logger.info(f"[generate_video] Operation type={type(operation).__name__}, attrs={[a for a in dir(operation) if not a.startswith('_')]}")

            # Extraire les bytes vidéo de la réponse
            if not operation.done:
                logger.warning(f"[generate_video] Opération non terminée pour {model_name}")
                continue

            # Essayer toutes les manières possibles d'extraire la vidéo
            try:
                response = getattr(operation, 'response', None)
                logger.info(f"[generate_video] operation.response type={type(response).__name__ if response else 'None'}")
            except Exception as resp_err:
                logger.error(f"[generate_video] Erreur accès operation.response: {resp_err}")
                response = None

            if not response:
                try:
                    response = getattr(operation, 'result', None)
                    logger.info(f"[generate_video] operation.result type={type(response).__name__ if response else 'None'}")
                except Exception as res_err:
                    logger.error(f"[generate_video] Erreur accès operation.result: {res_err}")
                    response = None

            if not response:
                logger.warning(f"[generate_video] Pas de response/result dans l'opération.")
                continue

            try:
                gen_videos = getattr(response, 'generated_videos', None)
                logger.info(f"[generate_video] generated_videos={gen_videos is not None}, count={len(gen_videos) if gen_videos else 0}")
            except Exception as gv_err:
                logger.error(f"[generate_video] Erreur accès generated_videos: {gv_err}")
                gen_videos = None

            if not gen_videos:
                logger.warning(f"[generate_video] Pas de generated_videos. Response attrs: {[a for a in dir(response) if not a.startswith('_')]}")
                # Vérifier si VEO a filtré le contenu (RAI)
                rai_reason = getattr(response, 'rai_media_filtered_reasons', None)
                if rai_reason:
                    logger.warning(f"[generate_video] Contenu filtré par RAI: {rai_reason}")
                    return "La vidéo n'a pas pu être générée car le contenu a été filtré par les règles de sécurité. Essayez avec une description différente."
                # Essayer d'accéder aux données brutes
                try:
                    raw_resp = str(response)[:500]
                    logger.info(f"[generate_video] Response raw: {raw_resp}")
                except Exception:
                    pass
                continue

            try:
                video_obj_resp = gen_videos[0]
                logger.info(f"[generate_video] video_obj type={type(video_obj_resp).__name__}, attrs={[a for a in dir(video_obj_resp) if not a.startswith('_')]}")
                video_data = getattr(video_obj_resp, 'video', None)
                if not video_data:
                    logger.warning(f"[generate_video] Pas de .video sur generated_videos[0]")
                    continue
                logger.info(f"[generate_video] video_data type={type(video_data).__name__}, attrs={[a for a in dir(video_data) if not a.startswith('_')]}")
            except Exception as vobj_err:
                logger.error(f"[generate_video] Erreur extraction video_obj: {vobj_err}", exc_info=True)
                continue

            # Essayer video_bytes d'abord, puis uri si disponible
            try:
                vb = getattr(video_data, 'video_bytes', None)
                if vb:
                    video_bytes = vb
                    applied_model = model_name
                    logger.info(f"[generate_video] ✅ Vidéo obtenue via video_bytes ({len(video_bytes)} bytes) avec {model_name}")
                    break
            except Exception as vb_err:
                logger.error(f"[generate_video] Erreur accès video_bytes: {vb_err}")

            # Fallback: télécharger depuis URI si disponible
            try:
                video_uri = getattr(video_data, 'uri', None)
                if video_uri:
                    logger.info(f"[generate_video] Téléchargement depuis URI: {video_uri}")
                    import httpx
                    dl_resp = httpx.get(video_uri, timeout=60)
                    if dl_resp.status_code == 200 and len(dl_resp.content) > 1000:
                        video_bytes = dl_resp.content
                        applied_model = model_name
                        logger.info(f"[generate_video] ✅ Vidéo téléchargée depuis URI ({len(video_bytes)} bytes)")
                        break
                    else:
                        logger.warning(f"[generate_video] Échec téléchargement URI: status={dl_resp.status_code}, size={len(dl_resp.content)}")
            except Exception as uri_err:
                logger.error(f"[generate_video] Erreur téléchargement URI: {uri_err}")

            logger.warning(f"[generate_video] Ni video_bytes ni uri disponibles.")

        except asyncio.TimeoutError:
            logger.warning(f"[generate_video] Timeout (270s) pour {model_name}")
            continue
        except Exception as model_err:
            logger.error(f"[generate_video] Erreur {model_name}: {model_err}", exc_info=True)
            continue

    if not video_bytes:
        logger.error(f"[generate_video] Tous les modèles ont échoué pour prompt='{prompt[:80]}'")
        return "Désolé, je n'ai pas pu générer cette vidéo pour le moment. La génération vidéo peut prendre du temps — réessayez dans quelques instants."

    try:
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"gen_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        public_url = None

        # Sauvegarder la vidéo dans Firebase Storage pour éviter le base64 dans SSE
        try:
            from .firebase_client import firebase_storage as storage
            public_url = storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path,
                file_bytes=video_bytes,
                content_type="video/mp4"
            )
            logger.info(f"[generate_video] Vidéo uploadée: {storage_path}")

            # Enregistrer dans la base de fichiers
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=video_name,
                    file_url=public_url,
                    file_type="video",
                    mime_type="video/mp4",
                    file_size=len(video_bytes)
                )
            except Exception as sql_err:
                logger.error(f"⚠️ Erreur enregistrement SQL vidéo: {sql_err}")
        except Exception as upload_err:
            logger.warning(f"[generate_video] Échec upload storage: {upload_err}")

        video_obj = {
            "prompt": prompt,
            "type": "video/mp4",
            "name": video_name,
            "url": public_url,
            "ephemeral": not bool(public_url),  # Éphémère seulement si pas d'URL
        }
        # Inclure base64 uniquement si pas d'URL (fallback)
        if not public_url:
            video_obj["data"] = base64.b64encode(video_bytes).decode('utf-8')

        current_media.append(video_obj)

        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        size_mb = len(video_bytes) / (1024 * 1024)
        logger.info(f"[generate_video] ✅ VIDÉO GÉNÉRÉE ({applied_model}): {size_mb:.1f} MB — url={public_url is not None}")
        if public_url:
            return f"Succès : La vidéo a été générée avec {applied_model} et sauvegardée dans vos fichiers."
        else:
            return f"Succès : La vidéo a été générée avec {applied_model}. ⚠️ Téléchargez-la avant de quitter."

    except Exception as e:
        logger.error(f"[generate_video] Erreur encodage vidéo: {e}", exc_info=True)
        return "La vidéo a été générée mais une erreur est survenue lors du traitement."

ORCHESTRATOR_TOOLS.append(generate_video)


@tool
def web_search(query: str) -> str:
    """Effectuer une recherche sur le Web pour obtenir des informations récentes ou spécifiques.
    Retourne des résultats enrichis avec snippets et extraits des pages web.
    À utiliser pour toute question factuelle, actualité, personne, prix, statistique.
    """
    import httpx
    from bs4 import BeautifulSoup
    import logging
    import urllib.parse
    import re as _re

    logger = logging.getLogger(__name__)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }

    def _scrape_page(page_url: str, max_chars: int = 2000) -> str:
        """Scrape une page web pour extraire le contenu principal."""
        try:
            with httpx.Client(headers=headers, follow_redirects=True, timeout=6.0) as c:
                resp = c.get(page_url)
                ct = resp.headers.get("content-type", "")
                if "text/html" not in ct:
                    return ""
                if resp.status_code != 200:
                    return ""
                soup = BeautifulSoup(resp.text, "html.parser")
                for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe"]):
                    tag.decompose()
                paragraphs = soup.find_all(["p", "h1", "h2", "h3", "li"])
                if paragraphs:
                    text = " ".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20)
                else:
                    text = soup.get_text(separator=" ", strip=True)
                text = _re.sub(r'\s+', ' ', text).strip()
                return text[:max_chars]
        except Exception:
            return ""

    # ── Stratégie 1 : Google Search via Gemini (prioritaire, pas de rate-limiting) ──
    def _search_google_grounding(q: str) -> str:
        """Recherche via Gemini avec Google Search Grounding — résultats riches et fiables."""
        try:
            from google import genai as _genai
            from google.genai import types as _types
            _api_key = settings.GEMINI_API_KEY
            if not _api_key:
                return ""
            _client = _genai.Client(api_key=_api_key)
            search_tool = _types.Tool(google_search=_types.GoogleSearch())
            resp = _client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=f"Recherche les informations les plus récentes et complètes sur: {q}",
                config=_types.GenerateContentConfig(
                    tools=[search_tool],
                    temperature=0.2,
                ),
            )
            # Extraire le texte + les sources du grounding
            text_response = ""
            if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                text_response = "".join(
                    p.text for p in resp.candidates[0].content.parts if hasattr(p, "text") and p.text
                )

            sources = []
            if resp.candidates and resp.candidates[0].grounding_metadata:
                gm = resp.candidates[0].grounding_metadata
                chunks = getattr(gm, 'grounding_chunks', None) or []
                for chunk in chunks[:8]:
                    web = getattr(chunk, 'web', None)
                    if web:
                        title = getattr(web, 'title', '') or ''
                        url = getattr(web, 'uri', '') or ''
                        if title and url:
                            sources.append(f"[{title[:40]}]({url})")

            if text_response:
                result = text_response
                if sources:
                    result += "\n\n**Sources :**\n" + "\n".join(f"- {s}" for s in sources)
                logger.info(f"[web_search] Google Grounding: {len(text_response)} chars, {len(sources)} sources")
                return result
            return ""
        except Exception as e:
            logger.warning(f"[web_search] Google Grounding failed: {e}")
            return ""

    logger.info(f"Recherche Web : {query}")

    # Essayer Google Search via Gemini d'abord (plus fiable depuis Cloud Run)
    google_result = _search_google_grounding(query)
    if google_result and len(google_result) > 100:
        return google_result

    # ── Fallback : DuckDuckGo + scraping ──
    try:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

        with httpx.Client(headers=headers, follow_redirects=True, timeout=20.0) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return google_result or f"Désolé, la recherche web a retourné une erreur {resp.status_code}."

            soup = BeautifulSoup(resp.text, 'html.parser')
            results = []

            items = soup.select(".result__body")
            for item in items[:8]:
                title_elem = item.select_one(".result__title")
                snippet_elem = item.select_one(".result__snippet")

                if title_elem and snippet_elem:
                    title = title_elem.text.strip()
                    snippet = snippet_elem.text.strip()
                    link = ""
                    for a_tag in item.select("a[href]"):
                        href = a_tag.get("href", "")
                        if "uddg=" in href:
                            link = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
                            break
                        elif href.startswith("http") and "duckduckgo" not in href:
                            link = href
                            break
                    if not link:
                        url_elem = item.select_one(".result__url")
                        if url_elem:
                            raw = url_elem.text.strip()
                            link = raw if raw.startswith("http") else f"https://{raw}"
                    if not link:
                        link = "Pas de lien"

                    # Scraper le contenu pour enrichir (top 3 résultats)
                    extra_content = ""
                    if len(results) < 3 and link.startswith("http"):
                        page_text = _scrape_page(link, max_chars=1500)
                        if page_text and len(page_text) > 100:
                            extra_content = f"\n**Extrait** : {page_text[:1000]}"

                    results.append(f"### {title}\n{snippet}{extra_content}\nSource: [{title[:30]}]({link})")

            if not results:
                return google_result or "Aucun résultat trouvé sur le Web pour cette requête."

            return "\n\n".join(results)

    except Exception as e:
        logger.error(f"Erreur web_search DDG fallback: {e}")
        return google_result or f"Une erreur est survenue lors de la recherche : {e}"

ORCHESTRATOR_TOOLS.append(web_search)

@tool
def execute_deep_research(query: str) -> str:
    """Effectue une recherche approfondie sur un sujet complexe.
    Utilise Google Search via Gemini pour explorer plusieurs angles en parallèle.
    Utiliser pour : analyses concurrentielles, études de marché, recherches stratégiques, sujets techniques.
    """
    import time as _time
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from datetime import datetime as _dt

    _logger = logging.getLogger(__name__)
    _start_time = _time.monotonic()

    # ── Étape 1 : Décomposition en 5 angles de recherche ──────────────────────
    _year = _dt.now().year
    angles = [
        {"label": "Présentation générale", "query": f"{query} définition présentation générale"},
        {"label": "Analyse comparative", "query": f"{query} analyse comparative concurrents alternatives"},
        {"label": f"Tendances {_year}", "query": f"{query} tendances actualités {_year - 1} {_year}"},
        {"label": "Stratégie et enjeux", "query": f"{query} stratégie avantages inconvénients opportunités"},
        {"label": "Cas concrets et chiffres", "query": f"{query} exemples concrets cas pratiques résultats chiffres données"},
    ]

    # ── Étape 2 : Recherche Google via Gemini (parallèle) ─────────────────────
    def _search_angle(angle_info: dict) -> dict:
        """Recherche un angle via Gemini Google Search Grounding."""
        try:
            from google import genai as _genai
            from google.genai import types as _types
            _api_key = settings.GEMINI_API_KEY
            if not _api_key:
                return {"label": angle_info["label"], "text": "", "sources": []}

            _client = _genai.Client(api_key=_api_key)
            search_tool = _types.Tool(google_search=_types.GoogleSearch())
            prompt = (
                f"Fais une recherche approfondie et détaillée sur : {angle_info['query']}\n\n"
                f"Fournis une analyse structurée avec des données chiffrées, des exemples concrets, "
                f"des noms d'entreprises/acteurs clés, et des tendances récentes. "
                f"Sois factuel et cite les sources. Réponds en français."
            )
            resp = _client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt,
                config=_types.GenerateContentConfig(
                    tools=[search_tool],
                    temperature=0.2,
                ),
            )

            text = ""
            sources = []
            if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                text = "".join(
                    p.text for p in resp.candidates[0].content.parts if hasattr(p, "text") and p.text
                )

            if resp.candidates and resp.candidates[0].grounding_metadata:
                gm = resp.candidates[0].grounding_metadata
                chunks = getattr(gm, 'grounding_chunks', None) or []
                for chunk in chunks[:6]:
                    web = getattr(chunk, 'web', None)
                    if web:
                        title = getattr(web, 'title', '') or ''
                        url = getattr(web, 'uri', '') or ''
                        if title and url:
                            sources.append({"title": title, "url": url})

            _logger.info(f"[deep_research] Angle '{angle_info['label']}': {len(text)} chars, {len(sources)} sources")
            return {"label": angle_info["label"], "text": text, "sources": sources}

        except Exception as e:
            _logger.warning(f"[deep_research] Angle '{angle_info['label']}' failed: {e}")
            return {"label": angle_info["label"], "text": "", "sources": []}

    # Exécution parallèle (5 angles simultanés, max 90s)
    results = []
    _logger.info(f"[deep_research] Lancement de 5 recherches parallèles pour '{query[:50]}'")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_search_angle, a): a for a in angles}
        for future in as_completed(futures, timeout=90):
            try:
                result = future.result(timeout=30)
                if result and result.get("text"):
                    results.append(result)
            except Exception as e:
                _logger.warning(f"[deep_research] Thread error: {e}")

    elapsed = _time.monotonic() - _start_time
    _logger.info(f"[deep_research] {len(results)}/5 angles complétés en {elapsed:.0f}s")

    if not results:
        return f"La recherche approfondie n'a pas pu obtenir de résultats pour '{query}'. Réessayez avec des termes plus spécifiques."

    # ── Étape 3 : Consolidation en rapport structuré ──────────────────────────
    all_sources = []
    report = [
        f"# 🔬 Rapport d'Expertise : {query}\n",
        f"*{len(results)} angles analysés en {elapsed:.0f}s via Google Search*\n",
    ]

    for r in results:
        report.append(f"\n## 🧱 {r['label']}\n")
        # Limiter le texte par section pour ne pas dépasser les limites LLM
        section_text = r["text"][:4000]
        if len(r["text"]) > 4000:
            section_text += "\n\n*[... contenu tronqué]*"
        report.append(section_text)

        if r["sources"]:
            report.append("\n**Sources :**")
            for s in r["sources"]:
                report.append(f"- [{s['title'][:50]}]({s['url']})")
                all_sources.append(s)
        report.append("\n---")

    # Résumé des sources
    if all_sources:
        unique_sources = {s["url"]: s for s in all_sources}
        report.append(f"\n## 📚 Sources ({len(unique_sources)} uniques)")
        for s in list(unique_sources.values())[:20]:
            report.append(f"- [{s['title'][:50]}]({s['url']})")

    report.append(f"\n\n*Rapport généré par FLARE AI.*")
    return "\n".join(report)

ORCHESTRATOR_TOOLS.append(execute_deep_research)


# ─── LangGraph State ──────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]


# ─── Orchestrateur ────────────────────────────────────────────────────────────

class OrchestratorAgent:
    """Agent central FLARE AI basé sur LangGraph."""

    def __init__(self):
        self.tools = ORCHESTRATOR_TOOLS
        self.llm = get_llm(temperature=0.7, purpose="assistant_reasoning").bind_tools(self.tools)
        self.tool_node = ToolNode(self.tools)
        self.graph = self._build_graph()
        logger.info(f"[OrchestratorAgent] Initialisé avec {len(self.tools)} outils")

    def _build_graph(self):
        graph = StateGraph(AgentState)
        graph.add_node("agent", self._call_model)
        graph.add_node("tools", self.tool_node)
        graph.set_entry_point("agent")
        graph.add_conditional_edges(
            "agent",
            self._should_continue,
            {"continue": "tools", "end": END},
        )
        graph.add_edge("tools", "agent")
        return graph.compile()

    def _should_continue(self, state: AgentState) -> Literal["continue", "end"]:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "continue"
        return "end"

    def _call_model(self, state: AgentState, config: RunnableConfig = None) -> dict:
        """Appelle le LLM avec retry progressif + réduction de contexte + fallback modèle."""
        import time
        configurable = (config or {}).get("configurable", {})
        model_override = configurable.get("model_override")
        llm = self._get_llm_for_user(model_override=model_override) if model_override else self.llm

        # Stratégie progressive:
        # Attempt 1: Modèle principal, contexte complet
        # Attempt 2: Modèle principal, contexte complet (retry)
        # Attempt 3: gemini-2.5-flash (stable), contexte complet
        # Attempt 4: gemini-2.5-flash-lite, contexte réduit (derniers 10 messages)
        max_attempts = 4
        messages = state["messages"]

        for attempt in range(max_attempts):
            current_llm = llm
            current_messages = messages

            if attempt == 2:
                # 3ème essai → modèle stable gemini-2.5-flash
                logger.info("[_call_model] Attempt 3: fallback vers gemini-2.5-flash")
                current_llm = get_llm(temperature=0.7, model_override="gemini-2.5-flash", purpose="assistant_reasoning").bind_tools(self.tools)

            if attempt == 3:
                # 4ème essai → modèle ultra-stable + contexte réduit
                logger.info("[_call_model] Attempt 4: fallback gemini-2.5-flash-lite + contexte réduit")
                current_llm = get_llm(temperature=0.7, model_override="gemini-2.5-flash-lite", purpose="assistant_fast").bind_tools(self.tools)
                # Garder uniquement : system prompt (2 premiers msgs) + derniers 10 messages
                if len(messages) > 12:
                    current_messages = messages[:2] + messages[-10:]
                    logger.info(f"[_call_model] Contexte réduit: {len(messages)} → {len(current_messages)} messages")

            try:
                response = current_llm.invoke(current_messages)

                n_tool_calls = len(response.tool_calls) if hasattr(response, "tool_calls") and response.tool_calls else 0
                content = response.content if hasattr(response, "content") else ""
                content_preview = str(content)[:150] if content else ""

                logger.info(f"[_call_model] attempt={attempt+1}/{max_attempts}, tool_calls={n_tool_calls}, content_len={len(str(content))}, msgs={len(current_messages)}")

                if n_tool_calls > 0:
                    for tc in response.tool_calls:
                        logger.info(f"[_call_model] Tool call: {tc.get('name', '?')}")
                    return {"messages": [response]}

                if content_preview:
                    return {"messages": [response]}

                # Réponse vide + 0 tool calls → retry
                if attempt < max_attempts - 1:
                    logger.warning(f"[_call_model] Réponse vide (attempt {attempt+1}), retry...")
                    time.sleep(0.5 * (attempt + 1))
                    continue
                else:
                    logger.warning(f"[_call_model] Réponse vide après {max_attempts} tentatives")
                    # Forcer une réponse plutôt que vide
                    from langchain_core.messages import AIMessage as _AIMsg
                    return {"messages": [_AIMsg(content="Je suis désolé, je n'ai pas pu traiter votre demande. Veuillez reformuler ou réessayer.")]}

            except Exception as e:
                error_str = str(e).lower()
                is_retryable = any(k in error_str for k in ["429", "too many", "resource exhausted", "500", "503", "overloaded", "deadline", "timeout"])
                if is_retryable and attempt < max_attempts - 1:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"[LLM] Erreur retryable (attempt {attempt+1}), attente {wait}s : {e}")
                    time.sleep(wait)
                    continue
                logger.error(f"[_call_model] Erreur fatale: {e}")
                raise

    def _build_human_message(
        self,
        text: str,
        file_content: Optional[str] = None,
        file_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> HumanMessage:
        """Construit le message utilisateur avec fichier joint si présent."""
        if not file_content or not file_type:
            return HumanMessage(content=text)

        if file_type.startswith("image/"):
            if settings.LLM_PROVIDER in ("openai", "gemini"):
                return HumanMessage(content=[
                    {"type": "text", "text": text or "Analyse cette image."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{file_type};base64,{file_content}"}
                    }
                ])
            else:
                enhanced = (
                    f"[Image jointe : {file_name}]\n"
                    f"Note : l'analyse visuelle nécessite Gemini ou GPT-4o. "
                    f"Configure LLM_PROVIDER=gemini ou openai dans .env.\n\n"
                    f"{text}"
                )
                return HumanMessage(content=enhanced)

        elif file_type.startswith("audio/"):
            # L'audio a DÉJÀ été transcrit par le router dans user_message.
            # S'il arrive ici sans être vidé, c'est qu'il n'a pas pu être transcrit (ou intentionnel)
            # Ne déclenchons l'erreur OPENAI que si le texte est vraiment vide
            if not text or "[Message vocal]" not in text:
                enhanced = (
                    f"[Message vocal reçu : {file_name}]\n"
                    f"Note : la transcription automatique a échoué.\n"
                    f"Demande à l'utilisateur de répéter son message par écrit.\n\n"
                    f"{text or ''}"
                )
                return HumanMessage(content=enhanced)
            else:
                return HumanMessage(content=text)

        elif file_name and file_name.lower().endswith(".pdf"):
            # PDF reçu en base64 — extraction texte via pypdf
            try:
                import base64, io
                from pypdf import PdfReader
                raw = base64.b64decode(file_content)
                pdf = PdfReader(io.BytesIO(raw))
                extracted = "\n".join(p.extract_text() for p in pdf.pages if p.extract_text())
                preview = extracted[:8000] + ("..." if len(extracted) > 8000 else "")
                enhanced = (
                    f"[Document PDF joint : {file_name}]\n\n"
                    f"{preview}\n\n"
                    f"{text}"
                )
            except Exception as e:
                enhanced = f"[PDF joint : {file_name} — extraction échouée : {e}]\n\n{text}"
            return HumanMessage(content=enhanced)

        elif file_name and file_name.lower().endswith(".docx"):
            # DOCX reçu en base64 — extraction texte via python-docx
            try:
                import base64, io
                import docx as _docx
                raw = base64.b64decode(file_content)
                doc_obj = _docx.Document(io.BytesIO(raw))
                extracted = "\n".join(p.text for p in doc_obj.paragraphs if p.text.strip())
                preview = extracted[:8000] + ("..." if len(extracted) > 8000 else "")
                enhanced = (
                    f"[Document DOCX joint : {file_name}]\n\n"
                    f"{preview}\n\n"
                    f"{text}"
                )
            except Exception as e:
                enhanced = f"[DOCX joint : {file_name} — extraction échouée : {e}]\n\n{text}"
            return HumanMessage(content=enhanced)

        else:
            preview = file_content[:5000] + ("..." if len(file_content) > 5000 else "")
            enhanced = (
                f"[Fichier joint : {file_name}]\n\n"
                f"```\n{preview}\n```\n\n"
                f"{text}"
            )
            return HumanMessage(content=enhanced)

    def _get_llm_for_user(self, model_override: Optional[str] = None):
        """Retourne un LLM bindé aux outils, avec modèle override si spécifié."""
        if model_override:
            return get_llm(temperature=0.7, model_override=model_override, purpose="assistant_reasoning").bind_tools(self.tools)
        return self.llm

    async def chat_stream(
        self,
        user_message: str,
        session_id: str,
        file_content: Optional[str] = None,
        file_type: Optional[str] = None,
        file_name: Optional[str] = None,
        user_id: str = "anonymous",
        deep_research: bool = False,
        model_override: Optional[str] = None,
    ):
        """Streaming version of chat that yields 'thought' events and final response."""
        _current_user_id.set(user_id)
        _current_session_id.set(session_id)
        req_id = str(uuid.uuid4())
        _current_request_id.set(req_id)
        _GLOBAL_IMAGE_REGISTRY[req_id] = []
        _generated_images.set([])
        _knowledge_saved.set([])
        _core_memory.set_user_id(user_id)
        
        memory = SessionMemory(session_id, user_id=user_id)

        # ── Gestion Abonnement : quota + modèle utilisateur ──────────────────
        _user_model = None
        try:
            from core.database import check_and_increment_usage, get_user_subscription
            quota = check_and_increment_usage(user_id, kind="message")
            if not quota["allowed"]:
                plan_name = quota.get("plan_name", "Free")
                limit = quota["limit"]
                quota_msg = (
                    f"\U0001F512 **Limite du plan {plan_name} atteinte** ({limit} messages/mois).\n\n"
                    "Pour continuer à utiliser FLARE AI sans interruption, passez sur un plan supérieur.\n"
                    "Contactez RAM'S FLARE pour upgrader votre abonnement !"
                )
                yield f'data: {{"type": "response", "content": {json.dumps(quota_msg)}}}\n\n'
                return
            sub = get_user_subscription(user_id)
            if sub:
                _user_model = sub.get("gemini_model")
        except Exception as e:
            logger.warning(f"[subscription] Erreur abonnement stream: {e}")

        core_mem_str = _core_memory.format_for_prompt()
        
        # Load persona and knowledge
        user_persona = ""
        try:
            from core.database import SessionLocal, SystemSetting
            _db = SessionLocal()
            pref = _db.query(SystemSetting).filter(SystemSetting.key == "user_preferences", SystemSetting.user_id == user_id).first()
            if pref and pref.value: user_persona = f"\n## Préférences Personnelles\n{pref.value}"
            _db.close()
        except Exception as e:
            logger.warning(f"Erreur chargement préférences utilisateur: {e}")

        knowledge_ctx = ""
        files_ctx = ""
        try:
            from core.database import SessionLocal, ConversationFile
            db = SessionLocal()
            conv_files = db.query(ConversationFile).filter(ConversationFile.conversation_id == session_id).all()
            if conv_files:
                files_list = [f"- {f.file_name} ({f.file_type}): {f.file_url}" for f in conv_files]
                files_ctx = "\n\n## Fichiers de la Discussion (Images & Docs)\nVoici les fichiers présents dans cette conversation :\n" + "\n".join(files_list)
            db.close()
        except Exception as e:
            logger.warning(f"Erreur chargement fichiers conversation: {e}")

        try:
            from .firebase_client import knowledge_manager as kb
            docs = kb.get_user_knowledge(user_id)
            if docs:
                titles = [f"- {d.get('metadata', {}).get('title', '?')}" for d in docs[:10]]
                knowledge_ctx = "\n\n## Base de Connaissances\n" + "\n".join(titles) + "\nUtilise search_knowledge_base pour le contenu."
        except Exception as e:
            logger.warning(f"Erreur chargement base de connaissances: {e}")

        # System prompt non modifiable — toujours utiliser le prompt intégré
        base_prompt = SYSTEM_PROMPT

        # Substitution safe (str.format crashe si le prompt contient des accolades JSON/Markdown)
        from datetime import date as _date
        system_content = base_prompt.replace("{current_date}", _date.today().strftime("%d/%m/%Y")).replace("{core_memory}", core_mem_str).replace("{user_persona}", user_persona) + knowledge_ctx + files_ctx

        if deep_research:
            system_content += "\nMODE DEEP RESEARCH: Recherche EXHAUSTIVE obligatoire avant de repondre."

        history = memory.load_messages()
        # Sanitize: Gemini 400 si un message a un contenu vide (ex: AIMessage tool-call-only)
        sanitized_history = []
        for msg in history:
            if isinstance(msg, AIMessage) and (not msg.content or msg.content == ""):
                msg = AIMessage(content="(action effectuée)")
            elif isinstance(msg, HumanMessage) and (not msg.content or msg.content == ""):
                msg = HumanMessage(content="(message)")
            sanitized_history.append(msg)
        history = sanitized_history

        # Garde-fou : limiter l'historique à 20 messages max pour éviter les réponses vides
        # (Gemini 3 Flash preview + 20 outils = instable avec un gros contexte)
        MAX_HISTORY_MSGS = 20
        if len(history) > MAX_HISTORY_MSGS:
            logger.info(f"[chat_stream] Historique tronqué: {len(history)} → {MAX_HISTORY_MSGS} messages")
            history = history[-MAX_HISTORY_MSGS:]

        human_msg = self._build_human_message(user_message, file_content, file_type, file_name)
        # IMPORTANT: Gemini ne gère PAS les SystemMessage longs + beaucoup d'outils
        # (retourne contenu vide + 0 tool calls). Fix: injecter en HumanMessage.
        if history:
            # Avec historique : system prompt condensé + historique + message
            # Condenser le system prompt si l'historique est long
            sys_content = system_content
            if len(history) > 10:
                # Après 10 messages, le modèle connaît déjà le contexte — réduire le prompt
                sys_content = system_content[:3000] + "\n[Instructions complètes omises — contexte déjà établi]"
            system_as_human = HumanMessage(content=f"[Instructions système]\n{sys_content}")
            system_ack = AIMessage(content="OK.")
            messages = [system_as_human, system_ack] + history + [human_msg]
        else:
            # Sans historique : combiner system + user dans un seul HumanMessage
            combined_content = f"[Instructions système]\n{system_content}\n[Fin instructions]\n\n{human_msg.content}"
            # Préserver les pièces jointes multimodales si présentes
            if isinstance(human_msg.content, list):
                # Message multimodal (image/audio)
                combined_content = [{"type": "text", "text": f"[Instructions système]\n{system_content}\n[Fin instructions]\n\n"}] + human_msg.content
            messages = [HumanMessage(content=combined_content)]

        logger.info(f"[chat_stream] Prompt construit OK — {len(history)} messages historiques, deep_research={deep_research}, system_len={len(sys_content if history else system_content)}, total_msgs={len(messages)}")
        
        memory.save_message("user", user_message)

        # Mapping for human-friendly tool names (with emoji for frontend display)
        TOOL_NAMES = {
            "web_search": "🔍 Recherche sur le web",
            "execute_deep_research": "🧠 Analyse approfondie en cours",
            "search_knowledge_base": "📚 Consultation de la base de connaissances",
            "recall_facts": "💭 Récupération de tes souvenirs",
            "remember_fact": "💾 Mémorisation d'un nouveau fait",
            "generate_image": "🎨 Création de ton image",
            "generate_video": "🎬 Création de ta vidéo (VEO 3.1)",
            "read_gmail_inbox": "📧 Lecture de tes emails",
            "send_gmail": "📤 Envoi de ton email",
            "search_gmail": "🔎 Recherche dans tes emails",
            "list_calendar_events": "📅 Vérification de ton agenda",
            "create_calendar_event": "📅 Création d'un événement",
            "read_google_sheets": "📊 Lecture de ton tableur",
            "write_google_sheets": "📝 Écriture dans le tableur",
            "create_google_spreadsheet": "📊 Création d'un tableur",
            "read_google_doc": "📄 Lecture du document",
            "create_google_doc": "📄 Création d'un document",
            "search_google_drive": "🗂️ Recherche dans Google Drive",
            "list_drive_folder": "📁 Exploration des dossiers",
            "list_knowledge_docs": "📚 Liste des documents de connaissances",
            "add_to_knowledge_base": "📥 Ajout à la base de connaissances",
            "create_skill": "⚡ Création d'un skill",
            "list_skills": "⚡ Chargement des skills",
            "use_skill": "⚡ Exécution du skill",
        }

        # STREAMING EVENTS — collect sources from tool outputs
        final_response = ""
        collected_sources = []  # {url, title, domain}
        tools_called = []  # Track which tools were called
        effective_model = _user_model or model_override
        config = {
            "configurable": {
                "user_id": user_id,
                "session_id": session_id,
                "request_id": req_id,
                "model_override": effective_model,
            }
        }

        try:
            async for event in self.graph.astream_events({"messages": messages}, config=config, version="v2"):
                kind = event["event"]
                if kind == "on_tool_start":
                    tool_name = event["name"]
                    tool_input = event.get("data", {}).get("input", {})
                    tools_called.append(tool_name)
                    display_name = TOOL_NAMES.get(tool_name, f"Utilisation de l'outil {tool_name}...")

                    # Add context about what's being searched
                    if tool_name == "web_search" and isinstance(tool_input, dict) and tool_input.get("query"):
                        display_name = f"🔍 Recherche : {tool_input['query'][:80]}"
                    elif tool_name == "execute_deep_research" and isinstance(tool_input, dict) and tool_input.get("query"):
                        display_name = f"🧠 Recherche approfondie : {tool_input['query'][:60]}"
                    elif tool_name == "search_knowledge_base" and isinstance(tool_input, dict) and tool_input.get("query"):
                        display_name = f"📚 Recherche dans vos docs : {tool_input['query'][:60]}"

                    yield {"type": "thought", "content": display_name}

                elif kind == "on_tool_end":
                    # Extract sources from web_search / deep_research results
                    tool_name = event.get("name", "")
                    if tool_name in ("web_search", "execute_deep_research"):
                        tool_output = event.get("data", {}).get("output", "")
                        # ToolMessage has .content; use it directly instead of str() repr
                        if hasattr(tool_output, "content"):
                            output_str = tool_output.content or ""
                        else:
                            output_str = str(tool_output) if tool_output else ""
                        # Extract URLs from Source: lines and markdown links
                        import re as _re
                        from urllib.parse import urlparse

                        def _clean_url(raw: str) -> str:
                            """Nettoie les artefacts courants des URLs extraites."""
                            # Supprimer les artefacts markdown/newlines en fin d'URL
                            raw = _re.sub(r'[\n\r\\n\\r]+.*$', '', raw)
                            raw = _re.sub(r'\s*#{1,}.*$', '', raw)
                            raw = raw.rstrip('.,;:!?)>]}\'"\\/ \t')
                            return raw.strip()

                        def _add_source(url: str, title: str = ""):
                            url = _clean_url(url)
                            if not url.startswith("http"):
                                url = "https://" + url
                            try:
                                parsed = urlparse(url)
                                domain = parsed.netloc.replace("www.", "")
                                if domain and len(domain) > 3 and domain not in [s.get("domain") for s in collected_sources]:
                                    collected_sources.append({
                                        "url": url,
                                        "domain": domain,
                                        "title": (title or domain.split(".")[0].capitalize())[:40],
                                    })
                            except:
                                pass

                        # Pattern 1: Source: domain.com/path
                        for match in _re.finditer(r'Source:\s*(https?://[^\s\)]+|[a-zA-Z0-9][\w.-]+\.[a-zA-Z]{2,}[^\s\)]*)', output_str):
                            _add_source(match.group(1))
                        # Pattern 2: [Title](https://url) markdown links
                        for match in _re.finditer(r'\[([^\]]+)\]\((https?://[^\)]+)\)', output_str):
                            _add_source(match.group(2), match.group(1))

                        # Yield a thought showing results found
                        n_sources = len(collected_sources)
                        if n_sources > 0:
                            yield {"type": "thought", "content": f"📄 {n_sources} source{'s' if n_sources > 1 else ''} trouvée{'s' if n_sources > 1 else ''} — Analyse en cours..."}

                elif kind == "on_chat_model_end":
                    output = event["data"].get("output")
                    if output:
                        has_tool_calls = hasattr(output, "tool_calls") and output.tool_calls
                        content = getattr(output, "content", "")
                        logger.info(f"[chat_stream] on_chat_model_end: has_tool_calls={has_tool_calls}, content_type={type(content).__name__}, content_len={len(str(content))}")
                        if not has_tool_calls:
                            final_response = content

                elif kind == "on_chat_model_stream":
                    # Capture streaming chunks for thinking display
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        # Gemini 2.5 thinking models may emit thinking tokens
                        pass  # Content captured via on_chat_model_end

        except Exception as stream_err:
            logger.error(f"[chat_stream] Erreur pendant le streaming du graphe: {stream_err}", exc_info=True)
            if not final_response:
                final_response = f"Une erreur est survenue pendant le traitement. Veuillez réessayer."

        final_response = _clean_response(final_response)
        logger.info(f"[chat_stream] Réponse finale: len={len(final_response)}, tools_called={tools_called}")

        # Fallback intelligent basé sur ce qui s'est passé
        if not final_response:
            if "generate_image" in tools_called:
                final_response = "Voici l'image que j'ai générée pour vous !"
            elif "generate_video" in tools_called:
                final_response = "Voici la vidéo que j'ai générée pour vous !"
            elif "web_search" in tools_called:
                final_response = "J'ai effectué une recherche mais n'ai pas pu formuler de réponse. Veuillez reformuler votre question."
            elif tools_called:
                final_response = f"J'ai utilisé {len(tools_called)} outil(s) pour traiter votre demande."
            else:
                final_response = "Je n'ai pas pu traiter cette demande correctement. Veuillez reformuler ou préciser votre question."
            logger.warning(f"[chat_stream] Réponse vide — fallback utilisé. Tools={tools_called}")

        # Also extract sources from the final response markdown links
        import re
        from urllib.parse import urlparse as _urlparse
        for match in re.finditer(r'\[([^\]]+)\]\((https?://[^\)]+)\)', final_response):
            title = match.group(1)
            url = re.sub(r'[\n\r\\n\\r]+.*$', '', match.group(2)).rstrip('.,;:!?)>]}\'"\\/ \t').strip()
            try:
                domain = _urlparse(url).netloc.replace("www.", "")
                if domain and len(domain) > 3 and domain not in [s.get("domain") for s in collected_sources]:
                    collected_sources.append({"url": url, "domain": domain, "title": title[:40]})
            except:
                pass

        memory.save_message("assistant", final_response)

        # Anti-429 : tâches de fond uniquement tous les 8 messages (1 seule tâche à la fois)
        msg_count = len(history) + 2
        if msg_count % 8 == 0:
            asyncio.create_task(self._run_background_memory_tasks(memory))

        res_images = _GLOBAL_IMAGE_REGISTRY.get(req_id, [])
        if not res_images: res_images = _generated_images.get() or []

        # Optimiser la taille de l'event SSE : envoyer uniquement l'URL si disponible
        # (les images base64 ~300KB+ causent des coupures SSE sur les connexions lentes)
        stream_images = []
        for img in res_images:
            if img.get("url"):
                # Image persistée dans Firebase Storage → envoyer uniquement l'URL
                stream_images.append({
                    "prompt": img.get("prompt", ""),
                    "type": img.get("type", "image/jpeg"),
                    "url": img["url"],
                    "name": img.get("name"),
                    "ephemeral": img.get("ephemeral", False),
                })
            else:
                # Pas d'URL (fallback) → envoyer le base64
                stream_images.append(img)

        yield {
            "type": "final",
            "response": final_response,
            "images": stream_images,
            "sources": collected_sources[:15],  # Max 15 sources
            "knowledge_saved": _knowledge_saved.get() or [],
            "session_id": session_id
        }

        asyncio.create_task(self._cleanup_registry(req_id))

    async def chat(
        self,
        user_message: str,
        session_id: str,
        file_content: Optional[str] = None,
        file_type: Optional[str] = None,
        file_name: Optional[str] = None,
        user_id: str = "anonymous",
        deep_research: bool = False,
        model_override: Optional[str] = None,
    ) -> dict:
        # Rendre l'user_id et session_id accessibles aux outils (thread-safe)
        _current_user_id.set(user_id)
        _current_session_id.set(session_id)
        
        # Initialiser un ID de requête unique pour collecter les images
        req_id = str(uuid.uuid4())
        _current_request_id.set(req_id)
        _GLOBAL_IMAGE_REGISTRY[req_id] = []
        
        # Réinitialiser les images et saves knowledge pour ce nouveau cycle
        _generated_images.set([])
        _knowledge_saved.set([])

        # Configurer la mémoire avec l'user_id pour Firestore
        _core_memory.set_user_id(user_id)
        memory = SessionMemory(session_id, user_id=user_id)

        # ── Gestion Abonnement : quota + modèle utilisateur ──────────────────
        _user_model = None
        try:
            from core.database import check_and_increment_usage, get_user_subscription
            quota = check_and_increment_usage(user_id, kind="message")
            if not quota["allowed"]:
                plan_name = quota.get("plan_name", "Free")
                limit = quota["limit"]
                return {
                    "response": (
                        f"\U0001F512 **Limite du plan {plan_name} atteinte** ({limit} messages/mois).\n\n"
                        "Pour continuer à utiliser FLARE AI sans interruption, passez sur un plan supérieur.\n"
                        "Contactez RAM'S FLARE pour upgrader votre abonnement !"
                    ),
                    "images": [],
                    "knowledge_saved": [],
                }
            sub = get_user_subscription(user_id)
            if sub:
                _user_model = sub.get("gemini_model")
        except Exception as e:
            logger.warning(f"[subscription] Erreur gestion abonnement: {e}")

        core_mem_str = _core_memory.format_for_prompt()

        # Charger les préférences personnelles de l'utilisateur (persona)
        user_persona = ""
        try:
            from core.database import SessionLocal, SystemSetting
            _db = SessionLocal()
            pref = _db.query(SystemSetting).filter(
                SystemSetting.key == "user_preferences",
                SystemSetting.user_id == user_id,
            ).first()
            if pref and pref.value and pref.value.strip():
                user_persona = f"\n## Préférences Personnelles de l'Utilisateur\n{pref.value.strip()}"
            _db.close()
        except Exception as e:
            logger.warning(f"Erreur chargement préférences utilisateur (chat): {e}")

        # Injecter un résumé de la base de connaissances dans le prompt système
        knowledge_ctx = ""
        try:
            from core.firebase_client import knowledge_manager as kb
            # Note: le seed de la KB est géré par le router via background_tasks
            docs = kb.get_user_knowledge(user_id)

            if docs:
                logger.info(f"Context: {len(docs)} documents trouvés pour user={user_id}")
                titles = [f"- {d.get('metadata', {}).get('title', '?')} ({d.get('metadata', {}).get('word_count', 0)} mots)" for d in docs[:20]]
                knowledge_ctx = (
                    f"\n\n## Base de Connaissances Disponible ({len(docs)} documents)\n"
                    + "\n".join(titles)
                    + "\n\nUtilise search_knowledge_base pour accéder au contenu complet."
                )
            else:
                logger.info(f"Aucun document dans la KB pour user={user_id}")
        except Exception as e:
            logger.error(f"Erreur injection knowledge_ctx: {e}")

        # System prompt non modifiable — toujours utiliser le prompt intégré
        base_prompt = SYSTEM_PROMPT

        # Substitution safe (str.format crashe si le prompt contient des accolades JSON/Markdown)
        from datetime import date as _date
        system_content = base_prompt.replace("{current_date}", _date.today().strftime("%d/%m/%Y")).replace("{core_memory}", core_mem_str).replace("{user_persona}", user_persona) + knowledge_ctx

        if deep_research:
            system_content += "\nMODE DEEP RESEARCH: Recherche EXHAUSTIVE obligatoire avant de repondre."

        history = memory.load_messages()
        # Sanitize: Gemini 400 si un message a un contenu vide (ex: AIMessage tool-call-only)
        sanitized_history = []
        for msg in history:
            if isinstance(msg, AIMessage) and (not msg.content or msg.content == ""):
                msg = AIMessage(content="(action effectuée)")
            elif isinstance(msg, HumanMessage) and (not msg.content or msg.content == ""):
                msg = HumanMessage(content="(message)")
            sanitized_history.append(msg)
        history = sanitized_history

        # Garde-fou : limiter l'historique (même logique que chat_stream)
        MAX_HISTORY_MSGS = 20
        if len(history) > MAX_HISTORY_MSGS:
            logger.info(f"[chat] Historique tronqué: {len(history)} → {MAX_HISTORY_MSGS} messages")
            history = history[-MAX_HISTORY_MSGS:]

        human_msg = self._build_human_message(user_message, file_content, file_type, file_name)
        # Même fix que chat_stream: pas de SystemMessage long avec beaucoup d'outils
        if history:
            sys_content = system_content
            if len(history) > 10:
                sys_content = system_content[:3000] + "\n[Instructions complètes omises — contexte déjà établi]"
            system_as_human = HumanMessage(content=f"[Instructions système]\n{sys_content}")
            system_ack = AIMessage(content="OK.")
            messages = [system_as_human, system_ack] + history + [human_msg]
        else:
            combined_content = f"[Instructions système]\n{system_content}\n[Fin instructions]\n\n{human_msg.content}"
            if isinstance(human_msg.content, list):
                combined_content = [{"type": "text", "text": f"[Instructions système]\n{system_content}\n[Fin instructions]\n\n"}] + human_msg.content
            messages = [HumanMessage(content=combined_content)]

        memory.save_message("user", user_message)

        effective_model = _user_model or model_override
        config = {
            "configurable": {
                "user_id": user_id,
                "session_id": session_id,
                "request_id": req_id,
                "model_override": effective_model,
            }
        }
        result = await self.graph.ainvoke({"messages": messages}, config=config)

        last_msg = result["messages"][-1]
        logger.info(f"ORCHESTRATOR DEBUG - Last message type: {type(last_msg)}")
        
        response_content = (
            last_msg.content if hasattr(last_msg, "content") else str(last_msg)
        )
        if isinstance(response_content, list):
            response_content = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in response_content
            )
        
        logger.info(f"ORCHESTRATOR DEBUG - Raw response: {response_content[:100]}...")
        response_content = _clean_response(response_content)
        
        if not response_content:
            logger.warning(f"ORCHESTRATOR WARNING - Empty response after cleaning. Messages count: {len(result['messages'])}")
            # Tenter de récupérer du contenu depuis les messages précédents
            for msg in reversed(result["messages"]):
                if hasattr(msg, "content") and msg.content and not (hasattr(msg, "tool_calls") and msg.tool_calls):
                    candidate = _clean_response(msg.content)
                    if candidate:
                        response_content = candidate
                        break
            if not response_content:
                response_content = "Je n'ai pas pu formuler une réponse. Veuillez reformuler votre question."

        memory.save_message("assistant", response_content)

        # Anti-429 : tâches de fond uniquement tous les 8 messages
        msg_count = len(history) + 2
        if msg_count % 8 == 0:
            asyncio.create_task(self._run_background_memory_tasks(memory))

        res_images = _GLOBAL_IMAGE_REGISTRY.get(req_id, [])
        if not res_images:
            res_images = _generated_images.get() or []

        logger.info(f"FIN CHAT ORCHESTRATOR - Images trouvées: {len(res_images)} (Req: {req_id})")

        # Nettoyage optionnel du registre pour éviter les fuites mémoire
        background_tasks = asyncio.create_task(self._cleanup_registry(req_id))

        return {
            "response": response_content,
            "images": res_images,
            "knowledge_saved": _knowledge_saved.get() or [],
        }

    async def _run_background_memory_tasks(self, memory: SessionMemory):
        """Exécute séquentiellement les tâches de fond mémoire pour éviter les appels Gemini en parallèle.
        Séquentiel = 1 seul appel à la fois = pas de saturation API (anti-429).
        """
        try:
            all_messages = memory.load_messages()
            # Utiliser flash-lite pour les tâches de fond (5x moins cher)
            bg_llm = get_llm(temperature=0.3, model_override="gemini-2.5-flash-lite", purpose="assistant_fast")
            # 1. Extraction de faits (1 appel Gemini)
            await _core_memory.auto_extract_facts(all_messages, bg_llm)
            # 2. Résumé si nécessaire (1 appel Gemini, seulement si > 40 messages)
            await memory.summarize_if_needed(bg_llm)
        except Exception as e:
            logger.debug(f"[background_memory] Tâche de fond ignorée: {e}")

    async def _cleanup_registry(self, req_id: str):
        await asyncio.sleep(60) # Garder 1 minute pour la sécurité
        if req_id in _GLOBAL_IMAGE_REGISTRY:
            del _GLOBAL_IMAGE_REGISTRY[req_id]


# Instance singleton
_orchestrator_instance: OrchestratorAgent | None = None


def get_orchestrator() -> OrchestratorAgent:
    """Retourne l'instance singleton de l'orchestrateur."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = OrchestratorAgent()
    return _orchestrator_instance






