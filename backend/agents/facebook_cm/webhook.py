"""
Gestionnaire de Webhook Facebook Messenger.
Traite les evenements entrants de l'API Meta Graph.
"""
import json
import logging
from typing import Any, Optional

from .agent import get_cm_agent
from .tools import send_text_message, _load_page_connection

logger = logging.getLogger(__name__)


def _resolve_page_id(entry: dict[str, Any], event: dict[str, Any]) -> str:
    return str(
        event.get("recipient", {}).get("id")
        or entry.get("id")
        or ""
    ).strip()


def _is_page_bot_active(page_id: str) -> bool:
    """Verifie si le bot est actif sur cette page (is_active == 'true')."""
    if not page_id:
        return False
    connection = _load_page_connection(page_id)
    if not connection:
        return False
    return str(getattr(connection, "is_active", "false")).lower() == "true"


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

            # Ignorer les echo messages (messages envoyes par le bot/la page eux-memes)
            if event.get("message", {}).get("is_echo"):
                continue
            # Ignorer si le sender est la page (reponse du bot renvoyee)
            if sender_id == page_id:
                continue

            # Verifier que le bot est actif sur cette page
            if page_id and not _is_page_bot_active(page_id):
                logger.info(
                    "Message ignore — bot desactive sur page=%s (sender=%s)",
                    page_id, sender_id,
                )
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
                    try:
                        send_text_message(
                            sender_id,
                            "Desole, un souci technique est survenu. Reessaie dans quelques instants ou ecris-nous encore.",
                            page_id=page_id,
                        )
                    except Exception as fallback_exc:
                        logger.error(
                            "Erreur fallback Messenger %s sur page=%s: %s",
                            sender_id,
                            page_id or "?",
                            fallback_exc,
                        )

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
                    try:
                        send_text_message(
                            sender_id,
                            "Desole, un souci technique est survenu. Reessaie dans quelques instants ou ecris-nous encore.",
                            page_id=page_id,
                        )
                    except Exception as fallback_exc:
                        logger.error(
                            "Erreur fallback postback %s sur page=%s: %s",
                            sender_id,
                            page_id or "?",
                            fallback_exc,
                        )

            elif "message" in event and "attachments" in event.get("message", {}):
                attachments = event["message"].get("attachments", [])
                att_types = [a.get("type", "unknown") for a in attachments]
                logger.info("Attachment(s) recu de %s sur page=%s: %s", sender_id, page_id or "?", att_types)

                if "audio" in att_types:
                    send_text_message(
                        sender_id,
                        "J'ai bien recu ton message vocal. Pour l'instant, merci d'utiliser les messages texte. Comment puis-je t'aider ?",
                        page_id=page_id,
                    )
                elif any(t in att_types for t in ("image", "video", "file")):
                    # Traiter comme un message texte avec contexte
                    try:
                        await cm_agent.handle_message(
                            psid=sender_id,
                            message_text="[Le client a envoye une image/fichier. Reponds en accusant reception et demande comment tu peux l'aider.]",
                            page_id=page_id,
                            auto_reply=True,
                        )
                    except Exception as exc:
                        logger.error("Erreur traitement attachment %s: %s", sender_id, exc)
                elif "fallback" not in att_types:
                    # Stickers ou types inconnus — accuser reception
                    try:
                        send_text_message(
                            sender_id,
                            "Merci pour ton message ! Comment puis-je t'aider ?",
                            page_id=page_id,
                        )
                    except Exception as exc:
                        logger.warning("Erreur envoi accuse reception sticker %s sur page=%s: %s", sender_id, page_id or "?", exc)


def parse_webhook_body(body: bytes) -> dict:
    """Parse et valide le corps d'un webhook Meta."""
    return json.loads(body.decode("utf-8"))
