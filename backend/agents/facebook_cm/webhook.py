"""
Gestionnaire de Webhook Facebook Messenger.
Traite les evenements entrants de l'API Meta Graph.
"""
import json
import logging
from typing import Any, Optional

from .agent import get_cm_agent
from .tools import _load_page_connection, _resolve_page_access_token, send_text_message

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
    if str(getattr(connection, "is_active", "false")).lower() != "true":
        return False
    return bool(_resolve_page_access_token(page_id=page_id))


def _conversation_id_for_event(page_id: str, sender_id: str) -> str:
    resolved_page_id = str(page_id or "").strip()
    resolved_sender = str(sender_id or "").strip()
    if resolved_page_id:
        return f"messenger_{resolved_page_id}_{resolved_sender}"
    return f"messenger_{resolved_sender}"


async def process_webhook_event(payload: dict) -> None:
    """
    Traite un evenement webhook Meta Graph.
    Dispatche les messages aux bons handlers.
    """
    try:
        cm_agent = get_cm_agent()
        agent_init_error: Exception | None = None
    except Exception as exc:
        cm_agent = None
        agent_init_error = exc
        logger.exception("Impossible d'initialiser l'agent Messenger Facebook: %s", exc)

    def _send_checked(recipient_id: str, text: str, *, page_id: str) -> None:
        result = send_text_message(recipient_id, text, page_id=page_id)
        if isinstance(result, dict) and result.get("error"):
            raise RuntimeError(str(result.get("error") or "Envoi Messenger echoue."))

    def _send_unavailable_reply(recipient_id: str, *, page_id: str, reason: str) -> None:
        try:
            _send_checked(
                recipient_id,
                "Desole, un souci technique est survenu. Reessaie dans quelques instants ou ecris-nous encore.",
                page_id=page_id,
            )
        except Exception as fallback_exc:
            logger.error(
                "Erreur fallback Messenger %s sur page=%s apres indisponibilite agent (%s): %s",
                recipient_id,
                page_id or "?",
                reason,
                fallback_exc,
            )

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
                message_mid = str(event.get("message", {}).get("mid") or "").strip() or None
                conversation_id = _conversation_id_for_event(page_id, sender_id)
                logger.info("Message recu de %s sur page=%s", sender_id, page_id or "?")

                if agent_init_error or cm_agent is None:
                    _send_unavailable_reply(sender_id, page_id=page_id, reason="agent_init")
                    continue

                try:
                    await cm_agent.handle_message(
                        psid=sender_id,
                        message_text=message_text,
                        page_id=page_id,
                        auto_reply=True,
                        source_message_id=message_mid,
                        source_conversation_id=conversation_id,
                    )
                except Exception as exc:
                    logger.error("Erreur traitement message %s: %s", sender_id, exc)
                    try:
                        _send_checked(
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
                postback_mid = str(event.get("postback", {}).get("mid") or "").strip() or None
                conversation_id = _conversation_id_for_event(page_id, sender_id)
                logger.info("Postback de %s sur page=%s: %s", sender_id, page_id or "?", postback_payload)

                if agent_init_error or cm_agent is None:
                    _send_unavailable_reply(sender_id, page_id=page_id, reason="agent_init")
                    continue

                try:
                    await cm_agent.handle_message(
                        psid=sender_id,
                        message_text=f"[POSTBACK: {postback_payload}]",
                        page_id=page_id,
                        auto_reply=True,
                        source_message_id=postback_mid,
                        source_conversation_id=conversation_id,
                    )
                except Exception as exc:
                    logger.error("Erreur traitement postback %s: %s", sender_id, exc)
                    try:
                        _send_checked(
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
                    try:
                        _send_checked(
                            sender_id,
                            "J'ai bien recu ton message vocal. Pour l'instant, merci d'utiliser les messages texte. Comment puis-je t'aider ?",
                            page_id=page_id,
                        )
                    except Exception as exc:
                        logger.warning("Erreur envoi accuse reception audio %s sur page=%s: %s", sender_id, page_id or "?", exc)
                elif any(t in att_types for t in ("image", "video", "file")):
                    # Traiter comme un message texte avec contexte
                    if agent_init_error or cm_agent is None:
                        _send_unavailable_reply(sender_id, page_id=page_id, reason="agent_init")
                        continue
                    try:
                        attachment_mid = str(event.get("message", {}).get("mid") or "").strip() or None
                        conversation_id = _conversation_id_for_event(page_id, sender_id)
                        await cm_agent.handle_message(
                            psid=sender_id,
                            message_text="[Le client a envoye une image/fichier. Reponds en accusant reception et demande comment tu peux l'aider.]",
                            page_id=page_id,
                            auto_reply=True,
                            source_message_id=attachment_mid,
                            source_conversation_id=conversation_id,
                        )
                    except Exception as exc:
                        logger.error("Erreur traitement attachment %s: %s", sender_id, exc)
                elif "fallback" not in att_types:
                    # Stickers ou types inconnus — accuser reception
                    try:
                        _send_checked(
                            sender_id,
                            "Merci pour ton message ! Comment puis-je t'aider ?",
                            page_id=page_id,
                        )
                    except Exception as exc:
                        logger.warning("Erreur envoi accuse reception sticker %s sur page=%s: %s", sender_id, page_id or "?", exc)


def parse_webhook_body(body: bytes) -> dict:
    """Parse et valide le corps d'un webhook Meta."""
    return json.loads(body.decode("utf-8"))
