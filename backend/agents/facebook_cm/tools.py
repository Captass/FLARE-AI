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
        return {"error": "Aucun token Messenger configure pour cette page."}

    response = httpx.post(
        MESSENGER_API,
        params={"access_token": access_token},
        json=payload,
        timeout=10.0,
    )
    return response.json()


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


CATALOGUE = {
    "pack_essentiel": {
        "nom": "Pack Essentiel",
        "prix": "500EUR/mois",
        "description": "Community management basique : 3 posts/semaine sur 1 reseau social, rapport mensuel.",
        "inclus": ["Creation de contenu", "Publication", "Moderation", "Rapport mensuel"],
    },
    "pack_pro": {
        "nom": "Pack Pro",
        "prix": "1 200EUR/mois",
        "description": "CM complet sur 2 reseaux + publicite Meta Ads avec budget inclus.",
        "inclus": ["5 posts/semaine", "2 reseaux sociaux", "Meta Ads (budget 300EUR)", "Rapport hebdomadaire", "Stories quotidiennes"],
    },
    "pack_premium": {
        "nom": "Pack Premium",
        "prix": "2 500EUR/mois",
        "description": "Solution complete : CM, production video, publicite avancee, 3 reseaux.",
        "inclus": ["Illimite posts", "3 reseaux", "Production video (2 videos/mois)", "Meta + Google Ads", "Suivi quotidien", "Rapport personnalise"],
    },
    "production_video": {
        "nom": "Production Video",
        "prix": "Sur devis (a partir de 800EUR)",
        "description": "Clip, spot publicitaire, video corporate, motion design.",
        "inclus": ["Tournage", "Montage", "Color grading", "Musique", "Sous-titres"],
    },
    "identite_visuelle": {
        "nom": "Identite Visuelle",
        "prix": "Sur devis (a partir de 1 500EUR)",
        "description": "Logo, charte graphique, templates reseaux sociaux.",
        "inclus": ["Logo vectoriel", "Palette couleurs", "Typographie", "Charte graphique PDF", "10 templates RS"],
    },
}


def get_catalog_item(pack_name: str) -> Optional[dict]:
    return CATALOGUE.get(pack_name)


def get_full_catalog() -> dict:
    return CATALOGUE
