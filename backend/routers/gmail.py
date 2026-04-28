import logging
import os
import re
import secrets
import time
import base64
import html
import hashlib
import hmac
import json
import quopri
import unicodedata
from email.header import decode_header, make_header
from urllib.parse import quote
from email.utils import parsedate_to_datetime
from email.message import EmailMessage
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from typing import Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from langchain_core.messages import HumanMessage
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth import get_user_id_from_header
from core.config import settings
from core.database import get_db
from core.gmail_token_store import gmail_token_store
from core.llm_factory import get_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gmail", tags=["gmail-assistant"])

GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
_oauth_states: dict[str, dict[str, Any]] = {}
_STATE_TTL_SECONDS = 600
_send_reply_dedup: dict[str, float] = {}
_SEND_REPLY_TTL_SECONDS = 300
GMAIL_FETCH_LIMIT = 20


class GmailAnalyzePayload(BaseModel):
    subject: str = ""
    snippet: str = ""
    from_email: str = ""


class GmailReplyPayload(GmailAnalyzePayload):
    message_id: str = ""
    category: Optional[str] = None
    recommendedAction: Optional[str] = None
    instruction: Optional[str] = None
    currentDraft: Optional[str] = None


class GmailSendReplyPayload(BaseModel):
    message_id: str
    body: str
    idempotency_key: Optional[str] = None


def _configured_scopes() -> list[str]:
    raw_scopes = settings.GOOGLE_OAUTH_SCOPES or GMAIL_READONLY_SCOPE
    scopes = [scope.strip() for scope in raw_scopes.replace(",", " ").split() if scope.strip()]
    allowed = [scope for scope in scopes if scope in {GMAIL_READONLY_SCOPE, GMAIL_SEND_SCOPE}]
    return allowed or [GMAIL_READONLY_SCOPE]


def _redirect_uri() -> str:
    return settings.GOOGLE_REDIRECT_URI or f"{settings.BACKEND_URL.rstrip('/')}/api/gmail/callback"


def _allow_local_oauth_transport() -> None:
    redirect_uri = _redirect_uri()
    if redirect_uri.startswith(("http://localhost", "http://127.0.0.1")):
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _frontend_return_url(return_url: Optional[str]) -> str:
    if return_url and return_url.startswith(("http://localhost:", "http://127.0.0.1:", "https://flareai.ramsflare.com")):
        return return_url
    return f"{settings.FRONTEND_URL.rstrip('/')}/app?view=executive-mail"


def _state_secret() -> bytes:
    secret = settings.GOOGLE_OAUTH_MASTER_KEY or settings.GOOGLE_CLIENT_SECRET or "flare-ai-local-oauth"
    return secret.encode("utf-8")


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _sign_state(payload_b64: str) -> str:
    return _b64encode(hmac.new(_state_secret(), payload_b64.encode("ascii"), hashlib.sha256).digest())


def _build_oauth_state(user_id: str, return_url: str, code_verifier: str) -> str:
    payload = {
        "user_id": user_id,
        "return_url": return_url,
        "code_verifier": code_verifier,
        "created_at": time.time(),
        "nonce": secrets.token_urlsafe(12),
    }
    payload_b64 = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{payload_b64}.{_sign_state(payload_b64)}"


def _parse_oauth_state(state: str) -> Optional[dict[str, Any]]:
    try:
        payload_b64, signature = state.split(".", 1)
        if not hmac.compare_digest(signature, _sign_state(payload_b64)):
            return None
        payload = json.loads(_b64decode(payload_b64).decode("utf-8"))
        if time.time() - float(payload.get("created_at", 0)) > _STATE_TTL_SECONDS:
            return None
        if not payload.get("user_id") or not payload.get("return_url"):
            return None
        return payload
    except Exception:
        logger.exception("Unable to parse Gmail OAuth state")
        return None


def _redirect_with_gmail_status(return_url: str, status: str, reason: Optional[str] = None) -> RedirectResponse:
    parts = urlsplit(return_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["gmail"] = status
    if reason:
        query["gmail_reason"] = reason
    redirect_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return RedirectResponse(redirect_url, status_code=302)


def _canonical_authorization_response(request: Request) -> str:
    configured = urlsplit(_redirect_uri())
    received = urlsplit(str(request.url))
    return urlunsplit((configured.scheme, configured.netloc, configured.path, received.query, ""))


def _safe_oauth_error(exc: Exception) -> str:
    text = str(exc).strip() or exc.__class__.__name__
    lowered = text.lower()
    for marker in (
        "invalid_client",
        "invalid_grant",
        "redirect_uri_mismatch",
        "unauthorized_client",
        "access_denied",
        "insecure_transport",
    ):
        if marker in lowered:
            return marker
    return quote(text[:120], safe="")


def _flow(state: Optional[str] = None, code_verifier: Optional[str] = None) -> Flow:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")
    _allow_local_oauth_transport()
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [_redirect_uri()],
            }
        },
        scopes=_configured_scopes(),
        redirect_uri=_redirect_uri(),
        state=state,
        code_verifier=code_verifier,
    )


def _require_user_id(authorization: Optional[str]) -> str:
    user_id = get_user_id_from_header(authorization)
    if not user_id or user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user_id


def _cleanup_states() -> None:
    now = time.time()
    expired = [state for state, payload in _oauth_states.items() if now - float(payload.get("created_at", 0)) > _STATE_TTL_SECONDS]
    for state in expired:
        _oauth_states.pop(state, None)


def _cleanup_send_dedup() -> None:
    now = time.time()
    expired = [key for key, created_at in _send_reply_dedup.items() if now - created_at > _SEND_REPLY_TTL_SECONDS]
    for key in expired:
        _send_reply_dedup.pop(key, None)


def _credentials(refresh_token: str) -> Credentials:
    return Credentials(
        None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=_configured_scopes(),
    )


def _extract_email(value: str) -> str:
    match = re.search(r"<([^>]+)>", value or "")
    return (match.group(1) if match else value).strip()


def _headers_to_dict(headers: list[dict[str, str]]) -> dict[str, str]:
    return {item.get("name", "").lower(): item.get("value", "") for item in headers}


def _decode_mime_header(value: str) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value))).strip()
    except Exception:
        return html.unescape(value).strip()


def _normalize_date(value: str) -> str:
    if not value:
        return ""
    try:
        return parsedate_to_datetime(value).isoformat()
    except Exception:
        return value


POSITIVE_TERMS = [
    "urgent", "important", "reponse", "réponse", "demande", "rendez-vous", "rdv",
    "confirmation", "devis", "facture", "paiement", "partenariat", "client",
    "validation", "planning", "action requise", "action required", "validation requise",
    "approve", "approval", "signature", "deadline", "proposal", "quote",
]
AUTOMATED_SENDERS = [
    "no-reply", "noreply", "newsletter", "marketing", "promo",
    "notification", "notifications", "support", "billing", "alert", "alerts",
    "info@", "mailer-daemon", "postmaster", "updates", "accounts", "security",
    "donotreply", "do-not-reply", "bounce", "feedback", "system",
]
LOW_SUBJECT_TERMS = [
    "newsletter", "promotion", "offre speciale", "offre spéciale", "live", "webinar",
    "notification", "alerte automatique", "digest", "weekly roundup", "community update",
    "verification code", "code de verification", "security alert", "alerte de securite",
    "log in", "login", "password", "mot de passe", "one-time code", "otp",
    "receipt", "recu", "order confirmation", "commande confirmee", "commande confirmée",
    "shipping", "livraison", "tracking", "feedback request", "survey", "sondage",
    "your account", "votre compte", "report", "weekly", "monthly",
    "subscription", "abonnement", "your order", "votre commande",
    "welcome to", "bienvenue", "getting started", "confirm your email",
    "verify your email", "confirmer votre email", "verifier votre email",
]
PLATFORM_TERMS = [
    "facebook", "instagram", "linkedin", "youtube", "tiktok", "discord",
    "google", "accounts.google", "paypal", "x.com", "twitter",
    "github", "gitlab", "slack", "notion", "trello", "jira", "stripe",
    "amazon", "apple", "microsoft", "zoom", "teams", "dropbox",
    "spotify", "netflix", "uber", "airbnb", "pinterest", "snapchat",
    "whatsapp", "telegram", "signal", "reddit",
]
AUTOMATED_CONTENT_TERMS = [
    "verification code",
    "code de verification",
    "security alert",
    "alerte de securite",
    "you've added another way to log in",
    "you have added another way to log in",
    "thanks for contacting us",
    "we've received your message",
    "we have received your message",
    "our team is currently reviewing",
    "do not reply",
    "please do not reply",
    "this is an automated message",
    "ceci est un message automatique",
    "your verification code is",
    "your security code",
    "use this code",
    "expiring soon",
    "expires in",
    "expire dans",
    "automatically generated",
    "genere automatiquement",
    "this email was sent to",
    "you are receiving this",
    "vous recevez ce message",
    "manage your notifications",
    "gerer vos notifications",
    "update your preferences",
]


def _strip_accents_for_rules(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", html.unescape(value or ""))
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def _detect_category(subject: str, snippet: str, from_email: str, body_text: str = "") -> str:
    text = _strip_accents_for_rules(f"{subject} {snippet} {from_email} {body_text[:800]}")
    sender = _strip_accents_for_rules(from_email)
    if any(term in text for term in AUTOMATED_CONTENT_TERMS):
        return "Notification"
    if any(term in text for term in ["newsletter", "unsubscribe", "desabonnement", "promo", "promotion"]):
        return "Newsletter"
    if any(term in text for term in ["notification", "alerte", "security alert", "alerte de securite"]) or any(term in sender for term in ["no-reply", "noreply"]):
        return "Notification"
    if any(term in text for term in ["facture", "paiement", "invoice", "payment", "charge"]):
        return "Finance"
    if any(term in text for term in ["rendez-vous", "rdv", "meeting", "creneau", "calendar"]):
        return "Rendez-vous"
    if any(term in text for term in ["planning", "schedule", "tournage", "planification"]):
        return "Planning"
    if any(term in text for term in ["client", "commande", "customer request", "demande client"]):
        return "Client"
    if any(term in text for term in ["partenaire", "partenariat", "proposition", "contrat", "presentation"]):
        return "Partenaire"
    if any(term in text for term in ["famille", "maison", "week-end", "weekend"]):
        return "Famille"
    if any(term in text for term in ["devis", "validation", "demande", "important", "urgent", "equipe", "team"]):
        return "Pro"
    if any(term in sender for term in PLATFORM_TERMS):
        return "Notification"
    return "Autre"


def _is_recent(date_value: str) -> bool:
    if not date_value:
        return False
    try:
        parsed = parsedate_to_datetime(date_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).days <= 3
    except Exception:
        try:
            parsed = datetime.fromisoformat(date_value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).days <= 3
        except Exception:
            return False


def _looks_direct(subject: str, snippet: str, from_email: str, body_text: str = "") -> bool:
    text = _strip_accents_for_rules(f"{subject} {snippet} {from_email} {body_text[:500]}")
    sender = _strip_accents_for_rules(from_email)
    if any(term in sender for term in AUTOMATED_SENDERS):
        return False
    if any(term in text for term in ["unsubscribe", "desabonnement", "newsletter", "webinar", "notification"]):
        return False
    return "@" in from_email


def _has_action_request(subject: str, snippet: str, body_text: str = "") -> bool:
    text = _strip_accents_for_rules(f"{subject} {snippet} {body_text[:900]}")
    return "?" in text or any(term in text for term in ["merci de", "pouvez-vous", "peux-tu", "confirmer", "valider", "envoyer", "repondre", "demande", "action requise", "please"])


def _summary_for(category: str, snippet: str, body_text: str = "") -> str:
    cleaned = " ".join(_clean_extracted_text(snippet or "").split())
    fallback_body = " ".join(_clean_extracted_text(body_text or "").split())
    if cleaned:
        return cleaned[:180]
    if fallback_body:
        return fallback_body[:180]
    if category == "Finance":
        return "Mail financier a verifier."
    if category == "Rendez-vous":
        return "Mail lie a un rendez-vous ou une confirmation de creneau."
    if category == "Newsletter":
        return "Information sans action urgente."
    if category == "Notification":
        return "Notification automatique probablement sans reponse necessaire."
    return "Message a lire et classer selon son importance."


def _recommended_action(category: str, bucket: str) -> str:
    if category == "Finance":
        return "Verifier le montant et l'echeance"
    if category == "Rendez-vous":
        return "Confirmer ou proposer un creneau"
    if category == "Planning":
        return "Ajouter au planning"
    if category == "Client":
        return "Preparer une reponse client"
    if category == "Partenaire":
        return "Preparer une reponse professionnelle"
    if category in {"Newsletter", "Notification"}:
        return "Aucune reponse necessaire"
    if bucket == "priority":
        return "Traiter aujourd'hui"
    if bucket == "review":
        return "Verifier avant de classer"
    return "Lire plus tard"


def scoreGmailMessage(message: dict[str, str]) -> dict[str, Any]:
    subject = message.get("subject", "")
    snippet = message.get("snippet", "")
    from_email = message.get("from", "")
    date_value = message.get("date", "")
    body_text = message.get("bodyText", "")
    subject_text = _strip_accents_for_rules(subject)
    text = _strip_accents_for_rules(f"{subject} {snippet} {from_email} {body_text[:800]}")
    sender = _strip_accents_for_rules(from_email)
    category = _detect_category(subject, snippet, from_email, body_text)
    score = 0
    reasons: list[str] = []

    if any(_strip_accents_for_rules(term) in text for term in POSITIVE_TERMS):
        score += 35
        reasons.append("Contient des mots d'action ou de suivi")
    if not any(term in sender for term in AUTOMATED_SENDERS):
        score += 25
        reasons.append("Expediteur non automatique")
    if _looks_direct(subject, snippet, from_email, body_text):
        score += 20
        reasons.append("Semble etre une conversation directe")
    if category in {"Client", "Partenaire", "Finance", "Pro"}:
        score += 20
        reasons.append(f"Categorie utile detectee: {category}")
    if _has_action_request(subject, snippet, body_text):
        score += 15
        reasons.append("Demande ou action detectee")
    if _is_recent(date_value):
        score += 10
        reasons.append("Mail recent")

    is_automated_sender = any(term in sender for term in AUTOMATED_SENDERS)
    is_pro_category = category in {"Client", "Partenaire", "Finance", "Pro", "Rendez-vous", "Planning"}

    if is_automated_sender:
        score -= 50
        reasons.append("Expediteur automatique ou marketing")
    if any(_strip_accents_for_rules(term) in subject_text for term in LOW_SUBJECT_TERMS):
        score -= 40
        reasons.append("Sujet typique newsletter, notification ou evenement")
    if any(term in text for term in AUTOMATED_CONTENT_TERMS):
        score -= 45
        reasons.append("Message automatique ou accusé de réception")
    if category in {"Newsletter", "Notification"}:
        score -= 30
        reasons.append(f"Categorie faible priorite: {category}")
    # Only penalize platform terms if the sender is also automated or the category is not business-relevant.
    # This prevents real emails from Google Workspace, Stripe billing contacts, etc. from being buried.
    if any(term in sender or term in text for term in PLATFORM_TERMS):
        if is_automated_sender or not is_pro_category:
            score -= 20
            reasons.append("Plateforme ou reseau social automatique")
        else:
            reasons.append("Plateforme detectee mais expediteur non automatique et categorie pro")

    if score >= 70:
        bucket = "priority"
        priority = "Haute"
    elif score >= 35:
        bucket = "review"
        priority = "Normale"
    else:
        bucket = "low"
        priority = "Basse"

    return {
        "score": score,
        "bucket": bucket,
        "category": category,
        "priority": priority,
        "reasons": reasons or ["Classement par defaut"],
        "recommendedAction": _recommended_action(category, bucket),
    }


def analyze_mail(subject: str, snippet: str, from_email: str = "", date: str = "", body_text: str = "") -> dict[str, Any]:
    scoring = scoreGmailMessage({"subject": subject, "snippet": snippet, "from": from_email, "date": date, "bodyText": body_text})
    return {
        **scoring,
        "status": "A lire" if scoring["bucket"] == "low" else "Reponse proposee",
        "summary": _summary_for(scoring["category"], snippet, body_text),
    }


def generate_reply(category: str, subject: str, recommended_action: str) -> str:
    if category == "Finance":
        return "Bonjour, merci pour votre message. Je vais verifier les elements de facture ou de paiement, puis revenir vers vous rapidement avec une confirmation."
    if category == "Rendez-vous":
        return "Bonjour, merci pour votre message. Je vous confirme la reception de votre demande de rendez-vous et je reviens vers vous avec un creneau adapte."
    if category == "Partenaire":
        return "Bonjour, merci pour votre message. Je prends bien note de votre proposition et je reviens vers vous rapidement pour poursuivre l'echange."
    if category == "Client":
        return "Bonjour, merci pour votre message. Je prends en charge votre demande et je reviens vers vous rapidement avec les elements utiles."
    if category in {"Newsletter", "Notification"} or recommended_action == "Aucune reponse necessaire":
        return "Aucune reponse necessaire."
    if category in {"Planning", "Pro"}:
        return "Bonjour, merci pour votre message. Je prends bien note de votre demande et je reviens vers vous rapidement avec les elements necessaires."
    if category == "Famille":
        return "Merci pour le message. Je regarde mon planning et je vous confirme l'organisation des que possible."
    return f"Bonjour, merci pour votre message concernant \"{subject}\". Je reviens vers vous rapidement."


async def generate_reply_with_ai(
    *,
    subject: str,
    snippet: str,
    body_text: str,
    from_email: str,
    category: str,
    recommended_action: str,
    instruction: Optional[str] = None,
    current_draft: Optional[str] = None,
) -> dict[str, Any]:
    fallback = generate_reply(category, subject, recommended_action)
    prompt = f"""
Redige une reponse email professionnelle, courte, claire et directement envoyable.

Contraintes:
- Reponds uniquement avec le corps de l'email. Pas d'objet, pas de meta-commentaire.
- Reponds au nom de l'utilisateur, pas au nom d'une entreprise, sauf si l'instruction le demande explicitement.
- N'ecris jamais "l'equipe FLARE AI" ou "FLARE AI" dans la reponse.
- N'invente pas de faits, montants, dates, pieces jointes, numeros de telephone ou promesses.
- Ne promets aucune action impossible ou non mentionnee dans le mail source.
- Si l'email est une newsletter ou une notification automatique, reponds exactement: Aucune reponse necessaire.
- Detecte la langue du mail source : si le mail est en francais, reponds en francais. Si en anglais, reponds en anglais. Sinon, reponds en francais par defaut.
- Ton: professionnel, simple, humain.
- Longueur: 3 a 6 phrases maximum.

Email source:
Expediteur: {from_email}
Sujet: {subject}
Categorie: {category}
Action recommandee: {recommended_action}
Extrait: {snippet}
Corps:
{body_text[:2500] or "(corps indisponible)"}

Instruction utilisateur:
{instruction or "Aucune instruction specifique."}

Brouillon actuel a ameliorer si utile:
{current_draft or fallback}
""".strip()

    try:
        llm = get_llm(
            temperature=0.25,
            model_override=settings.GEMINI_ROUTING_MODEL or "gemini-2.5-flash-lite",
            purpose="assistant_fast",
        )
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = str(getattr(response, "content", "") or "").strip()
        if not content:
            raise RuntimeError("empty AI response")
        return {"suggestedReply": content[:2400], "aiUsed": True, "model": settings.GEMINI_ROUTING_MODEL or "gemini-2.5-flash-lite"}
    except Exception:
        logger.exception("Gmail AI reply generation failed, falling back to rule-based reply")
        return {"suggestedReply": fallback, "aiUsed": False, "model": "rule-based"}


def _reply_subject(subject: str) -> str:
    value = (subject or "(Sans objet)").strip()
    return value if value.lower().startswith("re:") else f"Re: {value}"


def _build_reply_raw(
    *,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    in_reply_to: Optional[str] = None,
) -> str:
    message = EmailMessage()
    message["From"] = from_email
    message["To"] = to_email
    message["Subject"] = _reply_subject(subject)
    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
        message["References"] = in_reply_to
    message.set_content(body.strip())
    return base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")


def _decode_body_data(data: str) -> str:
    if not data:
        return ""
    padding = "=" * (-len(data) % 4)
    try:
        raw_bytes = base64.urlsafe_b64decode(f"{data}{padding}".encode("ascii"))
        qp_bytes = quopri.decodestring(raw_bytes)
        decoded = qp_bytes.decode("utf-8", errors="ignore")
        return html.unescape(decoded)
    except Exception:
        return ""


def _html_to_text(value: str) -> str:
    text = re.sub(r"(?is)<head.*?>.*?</head>", " ", value)
    text = re.sub(r"(?is)<(script|style|title|svg|noscript).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n\n", text)
    text = re.sub(r"(?i)</div\s*>", "\n", text)
    text = re.sub(r"(?i)</li\s*>", "\n", text)
    text = re.sub(r"(?i)</tr\s*>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return html.unescape(text.replace("\xa0", " "))


def _clean_extracted_text(value: str) -> str:
    if not value:
        return ""

    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = html.unescape(text)
    text = re.sub(r"(?i)https?://[^\s<>()]+(?:\([^\s<>()]*\)[^\s<>()]*)?", "", text)
    text = re.sub(r"(?i)\bwww\.[^\s<>()]+", "", text)
    text = re.sub(r"\(\s*\)", " ", text)
    text = re.sub(
        r"\b(?:Unsubscribe|Manage preferences|View email in browser|Privacy Policy|Se désabonner|Désabonnement)\b.*",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    text = re.split(
        r"\b(?:Unsubscribe|Manage preferences|View email in browser|Privacy Policy|Se désabonner|Désabonnement)\b",
        text,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    text = re.sub(r"[A-Za-z0-9_-]{48,}", "", text)
    text = re.sub(r"(?:[A-Za-z0-9+/=_-]{16,}[ \t]*){3,}", "", text)
    cleaned_lines: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            cleaned_lines.append("")
            continue
        compact = re.sub(r"[^A-Za-z0-9]", "", stripped)
        if len(compact) >= 40 and len(compact) / max(len(stripped), 1) > 0.72:
            continue
        if re.search(r"(?i)\b(?:utm_|tracking|click|preferences|unsubscribe|hs_email|token=)\b", stripped):
            continue
        cleaned_lines.append(stripped)
    text = "\n".join(cleaned_lines)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.strip()
    return text


def _text_quality_score(value: str) -> int:
    if not value:
        return 0
    score = min(len(value), 1200)
    score -= len(re.findall(r"[A-Za-z0-9_-]{32,}", value)) * 120
    score -= value.lower().count("unsubscribe") * 150
    score -= value.lower().count("manage preferences") * 150
    score -= value.lower().count("http") * 80
    return score


def _extract_html_text(payload: dict[str, Any]) -> str:
    if not payload:
        return ""

    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")
    parts = payload.get("parts") or []

    if mime_type == "text/html" and body_data:
        return _decode_body_data(body_data)

    html_fragments: list[str] = []

    for part in parts:
        part_mime = part.get("mimeType", "")
        part_body = part.get("body", {}).get("data", "")
        if part_mime == "text/html" and part_body:
            html_fragments.append(_decode_body_data(part_body))
        elif part.get("parts"):
            nested = _extract_html_text(part)
            if nested:
                html_fragments.append(nested)

    if html_fragments:
        return "\n".join(html_fragments)

    # fallback to plain text if no html
    if mime_type == "text/plain" and body_data:
        return _decode_body_data(body_data)
        
    return _decode_body_data(body_data)


def _extract_plain_text(payload: dict[str, Any]) -> str:
    if not payload:
        return ""

    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")
    parts = payload.get("parts") or []

    if mime_type == "text/plain" and body_data:
        return _clean_extracted_text(_decode_body_data(body_data))

    text_fragments: list[str] = []
    html_fragments: list[str] = []

    for part in parts:
        part_mime = part.get("mimeType", "")
        part_body = part.get("body", {}).get("data", "")
        if part_mime == "text/plain" and part_body:
            text_fragments.append(_decode_body_data(part_body))
        elif part_mime == "text/html" and part_body:
            html_fragments.append(_decode_body_data(part_body))
        elif part.get("parts"):
            nested = _extract_plain_text(part)
            if nested:
                text_fragments.append(nested)

    plain_text = _clean_extracted_text("\n".join(fragment.strip() for fragment in text_fragments if fragment.strip()))
    if html_fragments:
        html_text = _clean_extracted_text(_html_to_text("\n".join(html_fragments)))
        if html_text and _text_quality_score(html_text) >= _text_quality_score(plain_text):
            return html_text
    if plain_text:
        return plain_text
    return _clean_extracted_text(_decode_body_data(body_data))


def _payload_headers(payload: dict[str, Any]) -> dict[str, str]:
    return _headers_to_dict(payload.get("headers", []))


def _extract_attachment_metadata(payload: dict[str, Any]) -> list[dict[str, Any]]:
    attachments: list[dict[str, Any]] = []

    def walk(part: dict[str, Any]) -> None:
        body = part.get("body") or {}
        filename = (part.get("filename") or "").strip()
        attachment_id = body.get("attachmentId")
        headers = _payload_headers(part)
        disposition = (headers.get("content-disposition") or "").lower()
        is_inline = "inline" in disposition or bool(headers.get("content-id"))

        if filename and attachment_id:
            attachments.append({
                "attachmentId": attachment_id,
                "partId": part.get("partId", ""),
                "filename": filename,
                "mimeType": part.get("mimeType", "application/octet-stream"),
                "size": int(body.get("size") or 0),
                "inline": is_inline,
            })

        for nested in part.get("parts") or []:
            walk(nested)

    if payload:
        walk(payload)
    return attachments


def _find_attachment_metadata(payload: dict[str, Any], attachment_id: str) -> Optional[dict[str, Any]]:
    for attachment in _extract_attachment_metadata(payload):
        if attachment.get("attachmentId") == attachment_id:
            return attachment
    return None


def _build_message_payload(
    message_id: str,
    detail: dict[str, Any],
    *,
    include_body: bool = False,
    body_max_chars: int = 4000,
    include_attachments: bool = False,
) -> dict[str, Any]:
    payload = detail.get("payload", {}) or {}
    headers = _headers_to_dict(payload.get("headers", []))
    subject = _decode_mime_header(headers.get("subject", "(Sans objet)"))
    from_value = _decode_mime_header(headers.get("from", ""))
    reply_to = _decode_mime_header(headers.get("reply-to", from_value))
    date_value = headers.get("date", "")
    snippet = _clean_extracted_text(detail.get("snippet", ""))
    body_text = _extract_plain_text(payload)
    analysis = analyze_mail(subject, snippet, from_value, date_value, body_text)

    message: dict[str, Any] = {
        "id": message_id,
        "threadId": detail.get("threadId", ""),
        "labelIds": detail.get("labelIds", []) or [],
        "from": from_value,
        "email": _extract_email(from_value),
        "replyTo": _extract_email(reply_to),
        "messageIdHeader": headers.get("message-id", ""),
        "subject": subject,
        "snippet": snippet,
        "date": _normalize_date(date_value),
        "category": analysis["category"],
        "priority": analysis["priority"],
        "status": analysis["status"],
        "summary": analysis["summary"],
        "recommendedAction": analysis["recommendedAction"],
        "suggestedReply": generate_reply(analysis["category"], subject, analysis["recommendedAction"]),
        "score": analysis["score"],
        "bucket": analysis["bucket"],
        "reasons": analysis["reasons"],
        "isUnread": "UNREAD" in (detail.get("labelIds", []) or []),
        "isStarred": "STARRED" in (detail.get("labelIds", []) or []),
        "isImportant": "IMPORTANT" in (detail.get("labelIds", []) or []),
    }

    attachments = _extract_attachment_metadata(payload) if include_attachments else []
    message["hasAttachments"] = bool(attachments)
    message["attachmentCount"] = len(attachments)

    if include_body:
        message["bodyText"] = body_text[:body_max_chars]
        message["bodyTruncated"] = len(body_text) > body_max_chars
        message["bodyHtml"] = _extract_html_text(payload)
    if include_attachments:
        message["attachments"] = attachments

    return message


def _load_message_context(gmail: Any, message_id: str) -> dict[str, Any]:
    detail = (
        gmail.users()
        .messages()
        .get(
            userId="me",
            id=message_id,
            format="full",
            metadataHeaders=["From", "Reply-To", "Subject", "Date", "Message-ID"],
        )
        .execute()
    )
    return _build_message_payload(message_id, detail, include_body=True, body_max_chars=4000, include_attachments=True)


def _format_message(message_id: str, detail: dict[str, Any]) -> dict[str, Any]:
    return _build_message_payload(message_id, detail)


@router.get("/status")
def gmail_status(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user_id = _require_user_id(authorization)
    record = gmail_token_store.get(db, user_id)
    if not record:
        return {"connected": False}
    return {"connected": True, "email": record.account_email}


@router.get("/auth-url")
def gmail_auth_url(
    return_url: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user_id(authorization)
    _cleanup_states()
    safe_return_url = _frontend_return_url(return_url)
    code_verifier = secrets.token_urlsafe(64)
    state = _build_oauth_state(user_id, safe_return_url, code_verifier)
    _oauth_states[state] = {
        "user_id": user_id,
        "return_url": safe_return_url,
        "code_verifier": code_verifier,
        "created_at": time.time(),
    }
    authorization_url, _ = _flow(state=state, code_verifier=code_verifier).authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="false",
    )
    return {"url": authorization_url}


@router.get("/callback")
def gmail_callback(request: Request, db: Session = Depends(get_db)):
    state = request.query_params.get("state", "")
    state_payload = _oauth_states.pop(state, None) or _parse_oauth_state(state)
    if not state_payload:
        return _redirect_with_gmail_status(_frontend_return_url(None), "error", "missing-or-expired-state")

    flow = _flow(state=state, code_verifier=state_payload.get("code_verifier"))
    try:
        flow.fetch_token(authorization_response=_canonical_authorization_response(request))
    except Exception as exc:
        logger.exception("Gmail OAuth token exchange failed")
        return _redirect_with_gmail_status(state_payload["return_url"], "error", f"token-exchange:{_safe_oauth_error(exc)}")

    credentials = flow.credentials
    if not credentials.refresh_token:
        logger.warning("Google OAuth completed without refresh token for user %s", state_payload["user_id"])
        return _redirect_with_gmail_status(state_payload["return_url"], "missing-refresh-token")

    try:
        gmail = build("gmail", "v1", credentials=credentials, cache_discovery=False)
        profile = gmail.users().getProfile(userId="me").execute()
        gmail_email = profile.get("emailAddress", "")
    except Exception:
        logger.exception("Unable to read Gmail profile after OAuth")
        return _redirect_with_gmail_status(state_payload["return_url"], "profile-error")

    gmail_token_store.save(db, state_payload["user_id"], gmail_email, credentials.refresh_token)
    logger.info("Gmail connected for user %s (%s)", state_payload["user_id"], gmail_email)
    return _redirect_with_gmail_status(state_payload["return_url"], "connected")


@router.get("/messages")
def gmail_messages(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user_id = _require_user_id(authorization)
    record = gmail_token_store.get(db, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Gmail is not connected.")

    try:
        gmail = build("gmail", "v1", credentials=_credentials(record.refresh_token), cache_discovery=False)
        listed = (
            gmail.users()
            .messages()
            .list(userId="me", maxResults=GMAIL_FETCH_LIMIT, q="-category:promotions -category:social")
            .execute()
        )
        buckets = {"priority": [], "review": [], "low": []}
        for item in listed.get("messages", [])[:GMAIL_FETCH_LIMIT]:
            detail = (
                gmail.users()
                .messages()
                .get(
                    userId="me",
                    id=item["id"],
                    format="metadata",
                    metadataHeaders=["From", "Reply-To", "Subject", "Date", "Message-ID"],
                )
                .execute()
            )
            formatted = _format_message(item["id"], detail)
            bucket = formatted.get("bucket", "review")
            if bucket not in buckets:
                bucket = "review"
            buckets[bucket].append(formatted)

        for bucket_messages in buckets.values():
            bucket_messages.sort(key=lambda message: message.get("score", 0), reverse=True)

        messages = buckets["priority"] + buckets["review"] + buckets["low"]
        return {
            "priority": buckets["priority"],
            "review": buckets["review"],
            "low": buckets["low"],
            "counts": {
                "priority": len(buckets["priority"]),
                "review": len(buckets["review"]),
                "low": len(buckets["low"]),
                "total": len(messages),
            },
            "messages": messages,
        }
    except Exception as exc:
        logger.exception("Unable to fetch Gmail messages")
        raise HTTPException(status_code=502, detail="Impossible de charger Gmail pour le moment.") from exc


@router.get("/messages/{message_id}")
def gmail_message_detail(
    message_id: str,
    body_max_chars: int = Query(20000, ge=1000, le=50000),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(authorization)
    record = gmail_token_store.get(db, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Gmail is not connected.")

    try:
        gmail = build("gmail", "v1", credentials=_credentials(record.refresh_token), cache_discovery=False)
        detail = (
            gmail.users()
            .messages()
            .get(
                userId="me",
                id=message_id,
                format="full",
                metadataHeaders=["From", "Reply-To", "Subject", "Date", "Message-ID"],
            )
            .execute()
        )
        return _build_message_payload(
            message_id,
            detail,
            include_body=True,
            body_max_chars=body_max_chars,
            include_attachments=True,
        )
    except HttpError as exc:
        logger.exception("Unable to fetch Gmail message detail")
        if exc.resp.status == 404:
            raise HTTPException(status_code=404, detail="Mail Gmail introuvable.") from exc
        raise HTTPException(status_code=502, detail="Impossible de charger ce mail Gmail pour le moment.") from exc
    except Exception as exc:
        logger.exception("Unable to fetch Gmail message detail")
        raise HTTPException(status_code=502, detail="Impossible de charger ce mail Gmail pour le moment.") from exc


@router.get("/messages/{message_id}/attachments/{attachment_id}")
def gmail_message_attachment(
    message_id: str,
    attachment_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(authorization)
    record = gmail_token_store.get(db, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Gmail is not connected.")

    try:
        gmail = build("gmail", "v1", credentials=_credentials(record.refresh_token), cache_discovery=False)
        detail = (
            gmail.users()
            .messages()
            .get(
                userId="me",
                id=message_id,
                format="full",
                metadataHeaders=["From", "Reply-To", "Subject", "Date", "Message-ID"],
            )
            .execute()
        )
        payload = detail.get("payload", {}) or {}
        attachment_meta = _find_attachment_metadata(payload, attachment_id)
        if not attachment_meta:
            raise HTTPException(status_code=404, detail="Piece jointe introuvable pour ce mail.")

        attachment_payload = (
            gmail.users()
            .messages()
            .attachments()
            .get(userId="me", messageId=message_id, id=attachment_id)
            .execute()
        )

        data_base64 = attachment_payload.get("data", "")
        if not data_base64:
            raise HTTPException(status_code=404, detail="Contenu de la piece jointe indisponible.")

        return {
            "attachmentId": attachment_id,
            "filename": attachment_meta.get("filename", "piece-jointe"),
            "mimeType": attachment_meta.get("mimeType", "application/octet-stream"),
            "size": int(attachment_meta.get("size") or attachment_payload.get("size") or 0),
            "dataBase64": data_base64,
        }
    except HTTPException:
        raise
    except HttpError as exc:
        logger.exception("Unable to fetch Gmail attachment")
        if exc.resp.status == 404:
            raise HTTPException(status_code=404, detail="Piece jointe Gmail introuvable.") from exc
        raise HTTPException(status_code=502, detail="Impossible de charger la piece jointe Gmail pour le moment.") from exc
    except Exception as exc:
        logger.exception("Unable to fetch Gmail attachment")
        raise HTTPException(status_code=502, detail="Impossible de charger la piece jointe Gmail pour le moment.") from exc


@router.post("/analyze")
def gmail_analyze(payload: GmailAnalyzePayload):
    return analyze_mail(payload.subject, payload.snippet, payload.from_email)


@router.post("/generate-reply")
async def gmail_generate_reply(
    payload: GmailReplyPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(authorization)
    record = gmail_token_store.get(db, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Gmail is not connected.")
    if not payload.message_id:
        raise HTTPException(status_code=400, detail="message_id is required.")

    try:
        gmail = build("gmail", "v1", credentials=_credentials(record.refresh_token), cache_discovery=False)
        context = _load_message_context(gmail, payload.message_id)
    except Exception as exc:
        logger.exception("Unable to load Gmail message context for reply generation")
        raise HTTPException(status_code=502, detail="Impossible de charger le contexte du mail pour generer une reponse.") from exc

    return await generate_reply_with_ai(
        subject=context["subject"],
        snippet=context["snippet"],
        body_text=context.get("bodyText", ""),
        from_email=context["from"],
        category=context["category"],
        recommended_action=context["recommendedAction"],
        instruction=payload.instruction,
        current_draft=payload.currentDraft,
    )


@router.post("/send-reply")
def gmail_send_reply(
    payload: GmailSendReplyPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user_id(authorization)
    record = gmail_token_store.get(db, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Gmail is not connected.")
    if GMAIL_SEND_SCOPE not in _configured_scopes():
        raise HTTPException(status_code=409, detail="Gmail send scope is not configured. Reconnect Gmail after adding gmail.send.")
    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Reply body is required.")
    if len(body) > 5000:
        raise HTTPException(status_code=400, detail="Reply body is too long.")

    try:
        _cleanup_send_dedup()
        gmail = build("gmail", "v1", credentials=_credentials(record.refresh_token), cache_discovery=False)
        context = _load_message_context(gmail, payload.message_id)
        to_email = _extract_email(context.get("replyTo") or context.get("email") or context.get("from", ""))
        if not to_email or "@" not in to_email:
            raise HTTPException(status_code=400, detail="Recipient email is required.")
        idempotency_key = (payload.idempotency_key or hashlib.sha256(f"{payload.message_id}:{body}".encode("utf-8")).hexdigest()).strip()
        dedup_key = f"{user_id}:{idempotency_key}"
        if dedup_key in _send_reply_dedup:
            return {"sent": True, "duplicate": True, "threadId": context.get("threadId")}
        raw = _build_reply_raw(
            from_email=record.account_email,
            to_email=to_email,
            subject=context["subject"],
            body=body,
            in_reply_to=context.get("messageIdHeader"),
        )
        send_body: dict[str, Any] = {"raw": raw}
        if context.get("threadId"):
            send_body["threadId"] = context["threadId"]
        sent = gmail.users().messages().send(userId="me", body=send_body).execute()
        _send_reply_dedup[dedup_key] = time.time()
        logger.info("Gmail reply sent for user %s to %s, source=%s", user_id, to_email, payload.message_id)
        return {
            "sent": True,
            "id": sent.get("id"),
            "threadId": sent.get("threadId") or context.get("threadId"),
        }
    except HTTPException:
        raise
    except HttpError as exc:
        logger.exception("Gmail API send failed")
        if exc.resp.status in {401, 403}:
            raise HTTPException(
                status_code=409,
                detail="Gmail n'autorise pas encore l'envoi pour cette connexion. Reconnectez Gmail pour activer l'envoi.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Impossible d'envoyer la reponse Gmail pour le moment.",
        ) from exc
    except Exception as exc:
        logger.exception("Unable to send Gmail reply")
        raise HTTPException(
            status_code=502,
            detail="Impossible d'envoyer la reponse Gmail. Reconnectez Gmail si le scope d'envoi vient d'etre ajoute.",
        ) from exc


@router.post("/disconnect")
def gmail_disconnect(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user_id = _require_user_id(authorization)
    gmail_token_store.disconnect(db, user_id)
    return {"connected": False}
