"""
Router Webhooks — Réception des événements Facebook Messenger.
"""
import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request, Response

from core.config import settings
from agents.facebook_cm.tools import verify_webhook_signature
from agents.facebook_cm.webhook import process_webhook_event, parse_webhook_body

router = APIRouter(prefix="/webhook", tags=["Webhooks"])
logger = logging.getLogger(__name__)


@router.get("/facebook")
async def facebook_verify(request: Request):
    """
    Vérification du webhook Meta Graph.
    Facebook appelle cet endpoint lors de la configuration du webhook.
    """
    query = request.query_params
    hub_mode = query.get("hub.mode") or query.get("hub_mode")
    hub_verify_token = query.get("hub.verify_token") or query.get("hub_verify_token")
    hub_challenge = query.get("hub.challenge") or query.get("hub_challenge")

    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info("Webhook Facebook vérifié avec succès")
        return Response(content=hub_challenge, media_type="text/plain")

    raise HTTPException(
        status_code=403,
        detail="Vérification du webhook échouée. Vérifiez META_VERIFY_TOKEN dans .env",
    )


@router.post("/facebook")
async def facebook_webhook(request: Request):
    """
    Réception des événements Messenger.
    Dispatche de manière asynchrone vers l'Agent CM Facebook.
    """
    # Vérification de la signature HMAC
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_webhook_signature(body, signature):
        logger.warning("Signature webhook invalide — requête rejetée")
        raise HTTPException(status_code=403, detail="Signature invalide.")

    try:
        payload = parse_webhook_body(body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payload invalide : {e}")

    # Traitement asynchrone en arrière-plan
    asyncio.ensure_future(process_webhook_event(payload))

    # Réponse immédiate 200 (requis par Meta, < 20 secondes)
    return {"status": "ok"}
