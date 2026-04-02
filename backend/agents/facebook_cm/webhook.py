"""
Gestionnaire de Webhook Facebook Messenger.
Traite les evenements entrants de l'API Meta Graph.
"""
import json
import logging
from typing import Any

from .agent import get_cm_agent

logger = logging.getLogger(__name__)


def _resolve_page_id(entry: dict[str, Any], event: dict[str, Any]) -> str:
    return str(
        event.get("recipient", {}).get("id")
        or entry.get("id")
        or ""
    ).strip()


async def process_webhook_event(payload: dict) -> None:
    """
    Traite un evenement webhook Meta Graph.
    Dispatche les messages aux bons handlers.
    """
    cm_agent = get_cm_agent()

    for entry in payload.get("entry", []):
        for event in entry.get("messaging", []):
            sender_id = event.get("sender", {}).get("id")
            page_id = _resolve_page_id(entry, event)
            if not sender_id:
                continue

            if "message" in event and "text" in event["message"]:
                message_text = event["message"]["text"]
                logger.info("Message recu de %s sur page=%s", sender_id, page_id or "?")

                try:
                    await cm_agent.handle_message(
                        psid=sender_id,
                        message_text=message_text,
                        page_id=page_id,
                        auto_reply=True,
                    )
                except Exception as exc:
                    logger.error("Erreur traitement message %s: %s", sender_id, exc)

            elif "postback" in event:
                postback_payload = event["postback"].get("payload", "")
                logger.info("Postback de %s sur page=%s: %s", sender_id, page_id or "?", postback_payload)

                try:
                    await cm_agent.handle_message(
                        psid=sender_id,
                        message_text=f"[POSTBACK: {postback_payload}]",
                        page_id=page_id,
                        auto_reply=True,
                    )
                except Exception as exc:
                    logger.error("Erreur traitement postback %s: %s", sender_id, exc)

            elif "message" in event and "attachments" in event.get("message", {}):
                for attachment in event["message"].get("attachments", []):
                    if attachment.get("type") == "audio":
                        logger.info("Message vocal recu de %s sur page=%s", sender_id, page_id or "?")
                        from .tools import send_text_message

                        send_text_message(
                            sender_id,
                            "J'ai bien recu ton message vocal. Pour l'instant, merci d'utiliser les messages texte. Comment puis-je t'aider ?",
                            page_id=page_id,
                        )


def parse_webhook_body(body: bytes) -> dict:
    """Parse et valide le corps d'un webhook Meta."""
    return json.loads(body.decode("utf-8"))
