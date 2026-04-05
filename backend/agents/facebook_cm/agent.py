"""
Agent CM Facebook - Assistant IA pour les clients Messenger.
Repond aux messages entrants avec le contexte de l'organisation (prefs, catalogue).
"""
import json as _json
import logging
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from core.database import ChatbotCatalogueItem, ChatbotPreferences, FacebookPageConnection, SessionLocal
from core.llm_factory import get_llm
from core.memory import SessionMemory
from .tools import (
    get_user_profile,
    send_quick_replies,
    send_text_message,
)
from sqlalchemy import or_

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fallback system prompt (quand aucune preference n'est configuree en BDD)
# ---------------------------------------------------------------------------

CM_SYSTEM_PROMPT = """Tu es l'assistant virtuel de cette page Facebook.

## Ton role
Tu reponds aux questions des clients de maniere utile et concise. Si tu n'as pas les informations necessaires, tu proposes au client de contacter l'equipe directement.

## Regles importantes
- Reponds dans la langue du client (francais ou malgache selon ce qu'il ecrit)
- Sois bref : 2 a 4 phrases maximum par message (format Messenger)
- Ne promets rien qui n'est pas confirme
- Si la question depasse tes connaissances, dis-le honnêtement et propose un contact humain
- Ne jamais inventer des prix, des delais ou des informations produits

## Format
- Messages courts, clairs, sans markdown
- Pas de titres ni de listes a puces (Messenger ne les affiche pas bien)
- Utilise des emojis avec moderation

{user_context}"""

# ---------------------------------------------------------------------------
# Prompt dynamique construit depuis les preferences de l'organisation
# ---------------------------------------------------------------------------

def build_dynamic_prompt(
    prefs: ChatbotPreferences,
    catalogue_items: list[ChatbotCatalogueItem],
    user_context: str,
) -> str:
    tone_map = {
        "professionnel": "Tu es professionnel et courtois. Tu vouvoies.",
        "amical": "Tu es chaleureux et tu tutoies. Emojis avec moderation.",
        "decontracte": "Tu es cool et decontracte, langage familier, emojis ok.",
        "formel": "Tu vouvoies, tu es tres formel. Pas d'emojis.",
    }
    tone = str(prefs.tone or "amical").strip().lower()

    # Langue : directive claire selon la config
    lang_code = str(prefs.language or "fr").strip().lower()
    lang_label_map = {"fr": "francais", "mg": "malgache", "en": "anglais"}
    lang_label = lang_label_map.get(lang_code, lang_code)
    if lang_code == "mg":
        language_instruction = (
            "Reponds principalement en malgache. "
            "Si le client ecrit en francais, reponds en francais. "
            "Evite de melanger les deux langues dans un meme message."
        )
    else:
        language_instruction = (
            f"Reponds en {lang_label} par defaut. "
            "Si le client ecrit clairement dans une autre langue, adapte-toi. "
            "Evite de melanger les langues dans un meme message."
        )

    # Catalogue produits depuis la BDD
    catalogue_lines = []
    for i in catalogue_items:
        if str(i.is_active).lower() != "false":
            price_str = f" — {i.price}" if i.price else ""
            cat_str = f" [{i.category}]" if i.category else ""
            desc = f" : {i.description}" if i.description else ""
            img_str = f" (image: {i.image_url})" if i.image_url else ""
            catalogue_lines.append(f"- {i.name}{cat_str}{price_str}{desc}{img_str}")

    products_display = str(prefs.products_summary or "").strip()
    if catalogue_lines:
        if products_display:
            products_display += "\n\nProduits du catalogue :\n" + "\n".join(catalogue_lines)
        else:
            products_display = "Produits du catalogue :\n" + "\n".join(catalogue_lines)

    if not products_display:
        products_display = (
            "Catalogue non encore configure. "
            "Invite le client a contacter l'equipe pour plus d'informations."
        )

    # Handoff keywords -> instruction dans le prompt
    handoff_section = ""
    try:
        kws = _json.loads(prefs.handoff_keywords or "[]")
        if isinstance(kws, list) and kws:
            kw_list = ", ".join(f'"{k}"' for k in kws[:10])
            handoff_msg = prefs.handoff_message or "Je vous mets en contact avec un membre de notre equipe. Merci de patienter."
            handoff_section = (
                f"\n## Transfert vers un humain\n"
                f"Si le client utilise l'un de ces mots ou expressions : {kw_list}, "
                f"reponds uniquement avec ce message de transfert et ne continue pas : "
                f'"{handoff_msg}"'
            )
    except Exception:
        pass

    # Heures d'ouverture
    hours_section = f"\n## Horaires\n{prefs.business_hours}" if prefs.business_hours else ""

    # Contact
    contact_parts = []
    if prefs.phone:
        contact_parts.append(f"Tel : {prefs.phone}")
    if prefs.contact_email:
        contact_parts.append(f"Email : {prefs.contact_email}")
    if prefs.website_url:
        contact_parts.append(f"Site : {prefs.website_url}")
    if prefs.business_address:
        contact_parts.append(f"Adresse : {prefs.business_address}")
    contact_section = ("\n## Contact\n" + "\n".join(contact_parts)) if contact_parts else ""

    # Info entreprise
    business_lines = []
    if prefs.company_description:
        business_lines.append(prefs.company_description)
    if prefs.business_sector:
        business_lines.append(f"Secteur : {prefs.business_sector}")
    business_str = "\n".join(business_lines) or "Informations entreprise non configurees."

    return f"""Tu es {prefs.bot_name or "l'assistant"} de {prefs.business_name or "cette entreprise"}.

## Personnalite
{tone_map.get(tone, tone_map["amical"])}

## Entreprise
{business_str}

## Offres et Services
{products_display}
{hours_section}
{contact_section}

## Accueil
Quand un nouveau client te contacte pour la premiere fois : {prefs.greeting_message or "accueil chaleureux en utilisant son prenom."}

## Instructions speciales
{prefs.special_instructions or "Aucune."}
{handoff_section}

## Regles IMPORTANTES
- {language_instruction}
- Reponds en 2 a 4 phrases maximum par message (format Messenger, pas d'email)
- Pas de markdown (#, **, ---) : Messenger ne l'affiche pas correctement
- Ne promets rien qui n'est pas dans les offres ou les informations ci-dessus
- Si le client demande un prix non liste, dis que tu vas verifier et propose un contact
- Si une question depasse tes connaissances, dis-le et oriente vers le contact
- Si un produit a une image, tu peux envoyer l'URL directement dans le message
- INTERDIT : inventer des prix, des delais, des noms de personnes ou des garanties non confirmees

{user_context}"""


# ---------------------------------------------------------------------------
# Detection handoff (avant appel LLM)
# ---------------------------------------------------------------------------

def _check_handoff_trigger(message_text: str, prefs: Optional[ChatbotPreferences]) -> Optional[str]:
    """
    Retourne le message de handoff si un keyword est detecte, sinon None.
    """
    if not prefs:
        return None
    try:
        kws = _json.loads(prefs.handoff_keywords or "[]")
        if not isinstance(kws, list) or not kws:
            return None
        msg_lower = message_text.lower()
        for kw in kws:
            if str(kw).strip().lower() in msg_lower:
                return prefs.handoff_message or "Je vous mets en contact avec un membre de notre equipe. Merci de patienter."
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Chargement du contexte de page
# ---------------------------------------------------------------------------

def _load_page_context(page_id: Optional[str]) -> dict:
    resolved_page_id = str(page_id or "").strip()
    if not resolved_page_id:
        return {}

    db = SessionLocal()
    try:
        connection = (
            db.query(FacebookPageConnection)
            .filter(FacebookPageConnection.page_id == resolved_page_id)
            .order_by(FacebookPageConnection.updated_at.desc())
            .first()
        )
        if not connection:
            return {}

        org_slug = connection.organization_slug
        preferences = (
            db.query(ChatbotPreferences)
            .filter(
                ChatbotPreferences.organization_slug == org_slug,
                ChatbotPreferences.page_id == resolved_page_id,
            )
            .first()
        )
        if not preferences:
            preferences = (
                db.query(ChatbotPreferences)
                .filter(
                    ChatbotPreferences.organization_slug == org_slug,
                    ChatbotPreferences.page_id.is_(None),
                )
                .first()
            )

        catalogue_items = (
            db.query(ChatbotCatalogueItem)
            .filter(ChatbotCatalogueItem.organization_slug == org_slug)
            .filter(
                or_(
                    ChatbotCatalogueItem.page_id == resolved_page_id,
                    ChatbotCatalogueItem.page_id.is_(None),
                )
            )
            .order_by(ChatbotCatalogueItem.sort_order.asc())
            .all()
        )

        return {
            "organization_slug": str(org_slug or "").strip().lower(),
            "preferences": preferences,
            "catalogue": catalogue_items,
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Agent principal
# ---------------------------------------------------------------------------

class FacebookCMAgent:
    """
    Agent CM Facebook.
    Traite les messages Messenger entrants et genere des reponses IA adaptees.
    """

    def __init__(self):
        # Temperature 0.65 : moins creative que 0.8, evite les inventions
        self.llm = get_llm(temperature=0.65, purpose="chatbot")

    async def handle_message(
        self,
        psid: str,
        message_text: str,
        page_id: Optional[str] = None,
        auto_reply: bool = True,
    ) -> str:
        """
        Traite un message Messenger entrant et genere une reponse.
        Verifie d'abord les keywords de handoff avant d'appeler le LLM.
        """
        resolved_page_id = str(page_id or "").strip()
        session_id = f"messenger_{resolved_page_id}_{psid}" if resolved_page_id else f"messenger_{psid}"
        memory = SessionMemory(session_id)
        page_context = _load_page_context(resolved_page_id)
        organization_slug = str(page_context.get("organization_slug") or "").strip().lower()
        preferences = page_context.get("preferences")
        catalogue_items = page_context.get("catalogue", [])

        # ── 1. Verifier les keywords de handoff ──────────────────────────────
        handoff_reply = _check_handoff_trigger(message_text, preferences if isinstance(preferences, ChatbotPreferences) else None)
        if handoff_reply:
            logger.info(
                "[FacebookCMAgent] Handoff declenche pour psid=%s page=%s",
                psid, resolved_page_id or "?"
            )
            memory.save_message("user", message_text)
            memory.save_message("assistant", f"[HANDOFF] {handoff_reply}")
            if auto_reply:
                send_text_message(psid, handoff_reply, page_id=resolved_page_id)
            return handoff_reply

        # ── 2. Profil utilisateur ────────────────────────────────────────────
        user_profile = get_user_profile(psid, page_id=resolved_page_id)
        user_name = str(user_profile.get("first_name") or "").strip()

        user_context_lines = ["## Client actuel"]
        if user_name:
            user_context_lines.append(f"Prenom : {user_name}")
        if organization_slug:
            user_context_lines.append(f"Organisation : {organization_slug}")
        user_context = "\n" + "\n".join(user_context_lines)

        # ── 3. Construire le prompt systeme ──────────────────────────────────
        system_content = (
            build_dynamic_prompt(preferences, catalogue_items, user_context)
            if isinstance(preferences, ChatbotPreferences)
            else CM_SYSTEM_PROMPT.format(user_context=user_context)
        )

        # ── 4. Construire les messages avec historique ────────────────────────
        history = memory.load_messages()
        # Limiter l'historique aux 20 derniers messages pour eviter les tokens excessifs
        history = history[-20:] if len(history) > 20 else history
        messages = [SystemMessage(content=system_content)] + history + [
            HumanMessage(content=message_text)
        ]

        memory.save_message("user", message_text)

        # ── 5. Appel LLM ─────────────────────────────────────────────────────
        response = await self.llm.ainvoke(messages)
        reply_text = str(response.content if hasattr(response, "content") else response).strip()

        # Securite : tronquer si trop long (Messenger = 2000 chars max)
        if len(reply_text) > 1800:
            reply_text = reply_text[:1780] + "..."

        memory.save_message("assistant", reply_text)

        # ── 6. Envoyer la reponse ────────────────────────────────────────────
        if auto_reply:
            send_result = send_text_message(psid, reply_text, page_id=resolved_page_id)
            if isinstance(send_result, dict) and send_result.get("error"):
                error_detail = str(send_result.get("error") or "").strip() or "Envoi Messenger echoue."
                logger.error(
                    "Messenger send failed page_id=%s psid=%s error=%s",
                    resolved_page_id or "?",
                    psid,
                    error_detail,
                )
                raise RuntimeError(error_detail)

        return reply_text

    def get_status(self) -> dict:
        """Retourne le statut de l'agent CM."""
        return {
            "agent": "CM Facebook",
            "statut": "en ligne",
        }


_cm_agent: FacebookCMAgent | None = None


def get_cm_agent() -> FacebookCMAgent:
    global _cm_agent
    if _cm_agent is None:
        _cm_agent = FacebookCMAgent()
    return _cm_agent
