"""
Agent CM Facebook - Assistant IA pour les clients Messenger.
Repond aux messages entrants avec le contexte de l'organisation (prefs, catalogue).
"""
import json as _json
import logging
import re
from datetime import datetime, timedelta
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from core.database import ChatbotCatalogueItem, ChatbotOrder, ChatbotPreferences, FacebookPageConnection, SessionLocal
from core.llm_factory import get_llm
from core.memory import SessionMemory
from .tools import (
    get_user_profile,
    _load_page_connection,
    send_text_message,
)
from sqlalchemy import or_

logger = logging.getLogger(__name__)
CANONICAL_ORDER_STATUSES = {"detected", "contacted", "confirmed", "fulfilled", "canceled"}
ORDER_INTENT_KEYWORDS = (
    "commande",
    "commander",
    "acheter",
    "achat",
    "prendre",
    "reservation",
    "reserver",
    "livraison",
    "livrer",
    "payer",
    "paiement",
    "devis",
    "prix",
    "tarif",
)
STRONG_ORDER_KEYWORDS = (
    "je veux commander",
    "je veux acheter",
    "je confirme",
    "je valide",
    "je prends",
    "livrez",
    "pret a payer",
)
HUMAN_FOLLOWUP_KEYWORDS = (
    "appeler",
    "telephone",
    "tel",
    "whatsapp",
    "humain",
    "conseiller",
    "agent",
    "service client",
)
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?\d[\d\s\-]{7,}\d)(?!\d)")
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
AMOUNT_PATTERN = re.compile(r"(\d[\d\s.,]{1,15})(?:\s*(?:ar|ariary|mga|usd|eur|\$))", re.IGNORECASE)
QUANTITY_PATTERN = re.compile(r"\b(\d{1,4})\s*(?:x|fois|piece|pieces|pcs|article|articles|unite|unites)\b", re.IGNORECASE)

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
    primary_role = str(prefs.primary_role or "mixte").strip().lower()
    role_map = {
        "vendeur": "Priorite business: qualifier vite le besoin, proposer une offre adaptee et aider a conclure la commande.",
        "support_client": "Priorite business: resoudre les demandes SAV/support avec precision avant toute proposition commerciale.",
        "informateur": "Priorite business: informer clairement sans pousser la vente de facon aggressive.",
        "mixte": "Priorite business: equilibrer information, support et conversion commerciale selon le contexte client.",
    }

    # Langue : directive claire selon la config
    lang_code = str(prefs.language or "fr").strip().lower()
    lang_label_map = {"fr": "francais", "mg": "malgache", "en": "anglais"}
    lang_label = lang_label_map.get(lang_code, lang_code)
    if lang_code == "auto":
        language_instruction = (
            "Detecte et adapte-toi automatiquement a la langue du client. "
            "Si le client ecrit en francais, reponds en francais. "
            "Si le client ecrit en malgache, reponds en malgache. "
            "Si le client ecrit en anglais, reponds en anglais. "
            "Evite de melanger les langues dans un meme message."
        )
    elif lang_code == "mg":
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
            product_images = []
            try:
                parsed_images = _json.loads(getattr(i, "product_images_json", "[]") or "[]")
                if isinstance(parsed_images, list):
                    product_images = [str(url).strip() for url in parsed_images if str(url).strip()]
            except Exception:
                product_images = []
            if not product_images and i.image_url:
                product_images = [i.image_url]
            img_str = f" (images: {', '.join(product_images[:3])})" if product_images else ""
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
    handoff_mode = str(prefs.handoff_mode or "auto").strip().lower()
    try:
        kws = _json.loads(prefs.handoff_keywords or "[]")
        if isinstance(kws, list) and kws and handoff_mode != "disabled":
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

    # Sujets interdits
    forbidden_text = str(prefs.forbidden_topics_or_claims or "").strip()
    forbidden_section = (
        f"\n## Sujets interdits\nNe parle JAMAIS de ces sujets et ne fais jamais ces affirmations :\n{forbidden_text}"
        if forbidden_text
        else ""
    )

    # Heures d'ouverture
    hours_section = f"\n## Horaires\n{prefs.business_hours}" if prefs.business_hours else ""
    off_hours_section = ""
    if prefs.off_hours_message:
        off_hours_section = (
            f"\n## Hors Horaires\n"
            f"Si un message arrive hors horaires, ou si la disponibilite immediate est incertaine, "
            f"base-toi sur ce message: {str(prefs.off_hours_message).strip()}"
        )

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

## Role Principal
{role_map.get(primary_role, role_map["mixte"])}

## Entreprise
{business_str}

## Offres et Services
{products_display}
{hours_section}
{off_hours_section}
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
{forbidden_section}
{user_context}"""


# ---------------------------------------------------------------------------
# Detection handoff (avant appel LLM)
# ---------------------------------------------------------------------------

def _check_handoff_trigger(message_text: str, prefs: Optional[ChatbotPreferences]) -> Optional[str]:
    """
    Retourne le message de handoff si un keyword est detecte, sinon None.
    Respecte le handoff_mode : disabled = jamais, manual = mots-cles, auto = mots-cles + detection LLM.
    """
    if not prefs:
        return None
    # Si le mode handoff est desactive, ne jamais transferer
    mode = str(prefs.handoff_mode or "auto").strip().lower()
    if mode == "disabled":
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


def _is_off_hours(prefs: Optional[ChatbotPreferences]) -> bool:
    if not prefs:
        return False
    hours_text = str(getattr(prefs, "business_hours", "") or "").strip().lower()
    if not hours_text or "24/7" in hours_text or "24h/24" in hours_text or "toujours" in hours_text:
        return False
    if "ferme" in hours_text and not re.search(r"\d{1,2}[:h]\d{0,2}", hours_text):
        return True

    matches = re.findall(r"(\d{1,2})[:h]?(\d{0,2})\s*[-aà]\s*(\d{1,2})[:h]?(\d{0,2})", hours_text)
    if not matches:
        return False

    now_local = datetime.utcnow() + timedelta(hours=3)
    current_minutes = now_local.hour * 60 + now_local.minute
    for start_h, start_m, end_h, end_m in matches:
        start_minutes = int(start_h) * 60 + int(start_m or "0")
        end_minutes = int(end_h) * 60 + int(end_m or "0")
        if start_minutes <= end_minutes:
            if start_minutes <= current_minutes <= end_minutes:
                return False
        else:
            if current_minutes >= start_minutes or current_minutes <= end_minutes:
                return False
    return True


def _normalize_message_for_match(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def _extract_order_signal(message_text: str) -> dict[str, object]:
    normalized = _normalize_message_for_match(message_text)
    if not normalized:
        return {"is_order_signal": False}
    if normalized.startswith("[postback:") or normalized.startswith("[le client a envoye"):
        return {"is_order_signal": False}

    keyword_hits = sum(1 for token in ORDER_INTENT_KEYWORDS if token in normalized)
    strong_hits = sum(1 for token in STRONG_ORDER_KEYWORDS if token in normalized)
    quantity_match = QUANTITY_PATTERN.search(normalized)
    amount_match = AMOUNT_PATTERN.search(normalized)
    has_supporting_context = bool(
        quantity_match
        or amount_match
        or any(token in normalized for token in ("adresse", "livraison", "livrer", "payer", "paiement", "disponible"))
    )
    has_intent = bool(
        strong_hits
        or any(token in normalized for token in ("commande", "commander", "acheter", "achat", "je prends"))
    )
    is_signal = has_intent and (has_supporting_context or keyword_hits >= 2)
    if not is_signal:
        return {"is_order_signal": False}

    phone_match = PHONE_PATTERN.search(message_text)
    email_match = EMAIL_PATTERN.search(message_text)
    quantity_text = quantity_match.group(0).strip() if quantity_match else ""
    amount_text = amount_match.group(0).strip() if amount_match else ""
    delivery_address = message_text.strip()[:280] if any(
        marker in normalized for marker in ("adresse", "livraison", "livrer", "quartier", "lot", "avenue", "rue")
    ) else ""
    confidence = min(
        0.95,
        0.35
        + (0.12 * keyword_hits)
        + (0.2 * strong_hits)
        + (0.1 if quantity_text else 0.0)
        + (0.1 if amount_text else 0.0),
    )
    return {
        "is_order_signal": True,
        "product_summary": message_text.strip()[:280],
        "quantity_text": quantity_text,
        "amount_text": amount_text,
        "delivery_address": delivery_address,
        "contact_phone": phone_match.group(0).strip() if phone_match else "",
        "contact_email": email_match.group(0).strip() if email_match else "",
        "needs_human_followup": any(token in normalized for token in HUMAN_FOLLOWUP_KEYWORDS),
        "confidence": round(confidence, 3),
    }


def _find_existing_signal_order(
    db,
    *,
    organization_slug: str,
    page_id: str,
    psid: str,
    source_message_id: Optional[str],
    message_text: str,
) -> Optional[ChatbotOrder]:
    query = db.query(ChatbotOrder).filter(
        ChatbotOrder.organization_slug == organization_slug,
        ChatbotOrder.contact_psid == psid,
        ChatbotOrder.source == "signal",
    )
    if page_id:
        query = query.filter(ChatbotOrder.facebook_page_id == page_id)

    resolved_message_id = str(source_message_id or "").strip()
    if resolved_message_id:
        return query.filter(ChatbotOrder.source_message_id == resolved_message_id).order_by(ChatbotOrder.created_at.desc()).first()

    recent_cutoff = datetime.utcnow() - timedelta(minutes=5)
    normalized_request = _normalize_message_for_match(message_text)
    candidates = (
        query.filter(ChatbotOrder.created_at >= recent_cutoff)
        .order_by(ChatbotOrder.created_at.desc())
        .all()
    )
    for candidate in candidates:
        if _normalize_message_for_match(candidate.customer_request_text) == normalized_request:
            return candidate
    return None


def _record_order_signal_from_message(
    *,
    organization_slug: str,
    page_id: str,
    page_name: str,
    psid: str,
    contact_name: str,
    message_text: str,
    source_message_id: Optional[str] = None,
    source_conversation_id: Optional[str] = None,
) -> Optional[str]:
    signal = _extract_order_signal(message_text)
    if not bool(signal.get("is_order_signal")):
        return None
    if not organization_slug:
        return None

    db = SessionLocal()
    try:
        existing = _find_existing_signal_order(
            db,
            organization_slug=organization_slug,
            page_id=page_id,
            psid=psid,
            source_message_id=source_message_id,
            message_text=message_text,
        )
        if existing:
            updated = False
            resolved_message_id = str(source_message_id or "").strip()
            resolved_conversation_id = str(source_conversation_id or "").strip()
            resolved_contact_name = str(contact_name or "").strip()
            if resolved_message_id and not str(existing.source_message_id or "").strip():
                existing.source_message_id = resolved_message_id
                updated = True
            if resolved_conversation_id and not str(existing.source_conversation_id or "").strip():
                existing.source_conversation_id = resolved_conversation_id
                updated = True
            if resolved_contact_name and not str(existing.contact_name or "").strip():
                existing.contact_name = resolved_contact_name
                updated = True
            if bool(signal.get("needs_human_followup")) and str(existing.needs_human_followup or "").strip().lower() != "true":
                existing.needs_human_followup = "true"
                updated = True
            if not str(existing.contact_phone or "").strip() and str(signal.get("contact_phone") or "").strip():
                existing.contact_phone = str(signal.get("contact_phone") or "").strip()
                updated = True
            if not str(existing.contact_email or "").strip() and str(signal.get("contact_email") or "").strip():
                existing.contact_email = str(signal.get("contact_email") or "").strip()
                updated = True
            if not str(existing.quantity_text or "").strip() and str(signal.get("quantity_text") or "").strip():
                existing.quantity_text = str(signal.get("quantity_text") or "").strip()
                updated = True
            if not str(existing.amount_text or "").strip() and str(signal.get("amount_text") or "").strip():
                existing.amount_text = str(signal.get("amount_text") or "").strip()
                updated = True
            if not str(existing.delivery_address or "").strip() and str(signal.get("delivery_address") or "").strip():
                existing.delivery_address = str(signal.get("delivery_address") or "").strip()
                updated = True
            if not str(existing.product_summary or "").strip() and str(signal.get("product_summary") or "").strip():
                existing.product_summary = str(signal.get("product_summary") or "").strip()
                updated = True
            normalized_status = str(existing.status or "").strip().lower()
            if normalized_status not in CANONICAL_ORDER_STATUSES:
                existing.status = "detected"
                updated = True
            if updated:
                existing.updated_at = datetime.utcnow()
                db.commit()
            return existing.id

        order = ChatbotOrder(
            organization_slug=organization_slug,
            organization_scope_id=organization_slug,
            user_id=organization_slug,
            facebook_page_id=page_id or None,
            page_name=page_name,
            contact_psid=psid,
            contact_name=contact_name,
            contact_phone=str(signal.get("contact_phone") or "").strip(),
            contact_email=str(signal.get("contact_email") or "").strip(),
            source_conversation_id=str(source_conversation_id or "").strip() or None,
            source_message_id=str(source_message_id or "").strip() or None,
            product_summary=str(signal.get("product_summary") or "").strip(),
            quantity_text=str(signal.get("quantity_text") or "").strip(),
            amount_text=str(signal.get("amount_text") or "").strip(),
            delivery_address=str(signal.get("delivery_address") or "").strip(),
            customer_request_text=message_text.strip()[:2000],
            confidence=float(signal.get("confidence") or 0.0),
            source="signal",
            status="detected",
            needs_human_followup="true" if bool(signal.get("needs_human_followup")) else "false",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        logger.info(
            "[FacebookCMAgent] Order signal captured order_id=%s page=%s psid=%s",
            order.id,
            page_id or "?",
            psid,
        )
        return order.id
    except Exception as exc:
        db.rollback()
        logger.exception(
            "[FacebookCMAgent] Failed to persist order signal page=%s psid=%s: %s",
            page_id or "?",
            psid,
            exc,
        )
        return None
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Chargement du contexte de page
# ---------------------------------------------------------------------------

def _load_page_context(page_id: Optional[str]) -> dict:
    resolved_page_id = str(page_id or "").strip()
    if not resolved_page_id:
        return {}

    connection = _load_page_connection(resolved_page_id)
    if not connection:
        return {}

    db = SessionLocal()
    try:
        org_slug = str(connection.organization_slug or connection.user_id or "").strip().lower()
        owner_user_id = str(connection.user_id or "").strip().lower()
        if not org_slug:
            return {}
        preferences_scope = [
            ChatbotPreferences.organization_slug == org_slug,
            ChatbotPreferences.user_id == org_slug,
        ]
        if owner_user_id and owner_user_id != org_slug:
            preferences_scope.append(ChatbotPreferences.user_id == owner_user_id)
        preferences = (
            db.query(ChatbotPreferences)
            .filter(
                or_(*preferences_scope),
                ChatbotPreferences.page_id == resolved_page_id,
            )
            .order_by(ChatbotPreferences.updated_at.desc(), ChatbotPreferences.created_at.desc())
            .first()
        )
        if not preferences:
            preferences = (
                db.query(ChatbotPreferences)
                .filter(
                    or_(*preferences_scope),
                    ChatbotPreferences.page_id.is_(None),
                )
                .order_by(ChatbotPreferences.updated_at.desc(), ChatbotPreferences.created_at.desc())
                .first()
            )

        catalogue_scope = [
            ChatbotCatalogueItem.organization_slug == org_slug,
            ChatbotCatalogueItem.user_id == org_slug,
        ]
        if owner_user_id and owner_user_id != org_slug:
            catalogue_scope.append(ChatbotCatalogueItem.user_id == owner_user_id)
        catalogue_items = (
            db.query(ChatbotCatalogueItem)
            .filter(or_(*catalogue_scope))
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
            "page_name": str(connection.page_name or "").strip(),
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
        source_message_id: Optional[str] = None,
        source_conversation_id: Optional[str] = None,
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
        page_name = str(page_context.get("page_name") or "").strip()
        preferences = page_context.get("preferences")
        catalogue_items = page_context.get("catalogue", [])
        user_profile = get_user_profile(psid, page_id=resolved_page_id)
        user_name = str(user_profile.get("first_name") or "").strip()
        resolved_conversation_id = str(source_conversation_id or "").strip() or session_id
        _record_order_signal_from_message(
            organization_slug=organization_slug,
            page_id=resolved_page_id,
            page_name=page_name,
            psid=psid,
            contact_name=user_name,
            message_text=message_text,
            source_message_id=source_message_id,
            source_conversation_id=resolved_conversation_id,
        )

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
        off_hours_message = (
            str(getattr(preferences, "off_hours_message", "") or "").strip()
            if isinstance(preferences, ChatbotPreferences)
            else ""
        )
        if off_hours_message and _is_off_hours(preferences):
            logger.info(
                "[FacebookCMAgent] Off-hours reply returned for psid=%s page=%s",
                psid,
                resolved_page_id or "?",
            )
            memory.save_message("user", message_text)
            memory.save_message("assistant", f"[OFF_HOURS] {off_hours_message}")
            if auto_reply:
                send_text_message(psid, off_hours_message, page_id=resolved_page_id)
            return off_hours_message

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
