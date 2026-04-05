"""
Outils de l'agent CM Facebook.
Connexion a l'API Meta Messenger avec resolution de token par page.
"""
import logging
import hashlib
import hmac
from typing import Optional

import httpx

from core.config import settings
from core.database import FacebookPageConnection, SessionLocal
from core.encryption_service import encryption_service

logger = logging.getLogger(__name__)
MESSENGER_GRAPH_VERSION = str(settings.META_GRAPH_VERSION or "v25.0").strip() or "v25.0"
MESSENGER_API = f"https://graph.facebook.com/{MESSENGER_GRAPH_VERSION}/me/messages"


def _load_page_connection(page_id: Optional[str]) -> Optional[FacebookPageConnection]:
    resolved_page_id = str(page_id or "").strip()
    if not resolved_page_id:
        return None

    db = SessionLocal()
    try:
        connection = (
            db.query(FacebookPageConnection)
            .filter(
                FacebookPageConnection.page_id == resolved_page_id,
                FacebookPageConnection.is_active == "true",
            )
            .order_by(FacebookPageConnection.updated_at.desc())
            .first()
        )
        if connection:
            db.expunge(connection)
            return connection

        fallback = (
            db.query(FacebookPageConnection)
            .filter(FacebookPageConnection.page_id == resolved_page_id)
            .order_by(FacebookPageConnection.updated_at.desc())
            .first()
        )
        if fallback:
            db.expunge(fallback)
        return fallback
    finally:
        db.close()


def _resolve_page_access_token(
    *,
    page_id: Optional[str] = None,
    page_access_token: Optional[str] = None,
) -> str:
    explicit = str(page_access_token or "").strip()
    if explicit:
        return explicit

    resolved_page_id = str(page_id or "").strip()
    connection = _load_page_connection(resolved_page_id)
    decrypted = encryption_service.decrypt(connection.page_access_token_encrypted or "") if connection else ""
    if decrypted:
        return decrypted

    if resolved_page_id:
        logger.warning(
            "[Facebook CM] Aucun token d'acces pour page_id=%s (connexion absente ou token non decrypte). "
            "Le message ne pourra pas etre envoye.",
            resolved_page_id,
        )
        return ""

    return str(settings.META_ACCESS_TOKEN or "").strip()


def _send_api_request(
    payload: dict,
    *,
    page_id: Optional[str] = None,
    page_access_token: Optional[str] = None,
) -> dict:
    access_token = _resolve_page_access_token(page_id=page_id, page_access_token=page_access_token)
    if not access_token:
        logger.error("[Facebook CM] Impossible d'envoyer le message : aucun token pour page_id=%s", page_id)
        return {"error": "Aucun token Messenger configure pour cette page."}

    logger.info("[Facebook CM] Envoi de message a Facebook pour page_id=%s. Payload=%s...", page_id, str(payload)[:100])
    
    response = httpx.post(
        MESSENGER_API,
        params={"access_token": access_token},
        json=payload,
        timeout=10.0,
    )
    
    result = response.json()
    if response.status_code >= 400 or "error" in result:
        logger.error(
            "[Facebook CM] ERREUR Meta API lors de l'envoi du message : HTTP_STATUS=%s, RESPONSE=%s",
            response.status_code,
            result
        )
    return result


def send_text_message(
    recipient_id: str,
    text: str,
    *,
    page_id: Optional[str] = None,
    page_access_token: Optional[str] = None,
) -> dict:
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text[:2000]},
        "messaging_type": "RESPONSE",
    }
    return _send_api_request(payload, page_id=page_id, page_access_token=page_access_token)


def send_image_message(
    recipient_id: str,
    image_url: str,
    caption: str = "",
    *,
    page_id: Optional[str] = None,
    page_access_token: Optional[str] = None,
) -> dict:
    payload = {
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "image",
                "payload": {
                    "url": image_url,
                    "is_reusable": True,
                },
            }
        },
        "messaging_type": "RESPONSE",
    }
    result = _send_api_request(payload, page_id=page_id, page_access_token=page_access_token)

    if caption and "error" not in result:
        send_text_message(
            recipient_id,
            caption,
            page_id=page_id,
            page_access_token=page_access_token,
        )

    return result


def send_quick_replies(
    recipient_id: str,
    text: str,
    options: list[str],
    *,
    page_id: Optional[str] = None,
    page_access_token: Optional[str] = None,
) -> dict:
    quick_replies = [
        {
            "content_type": "text",
            "title": opt[:20],
            "payload": opt.upper().replace(" ", "_"),
        }
        for opt in options[:13]
    ]
    payload = {
        "recipient": {"id": recipient_id},
        "message": {
            "text": text,
            "quick_replies": quick_replies,
        },
        "messaging_type": "RESPONSE",
    }
    return _send_api_request(payload, page_id=page_id, page_access_token=page_access_token)


def get_user_profile(
    psid: str,
    *,
    page_id: Optional[str] = None,
    page_access_token: Optional[str] = None,
) -> dict:
    access_token = _resolve_page_access_token(page_id=page_id, page_access_token=page_access_token)
    if not access_token:
        return {"first_name": "Prospect", "last_name": ""}

    url = f"https://graph.facebook.com/{MESSENGER_GRAPH_VERSION}/{psid}"
    response = httpx.get(
        url,
        params={
            "fields": "first_name,last_name,profile_pic",
            "access_token": access_token,
        },
        timeout=5.0,
    )
    return response.json()


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    if not settings.META_APP_SECRET:
        logger.error("META_APP_SECRET is missing. Rejecting Messenger webhook signature validation.")
        return False

    expected = "sha256=" + hmac.new(
        settings.META_APP_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
