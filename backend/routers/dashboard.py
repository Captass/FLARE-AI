"""
Router Dashboard â€” Vue d'ensemble du systÃ¨me FLARE AI.
AgrÃ¨ge les stats de tous les modules en un seul endpoint.
"""
import asyncio
import hashlib
import logging
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Form, Header, HTTPException, Query
from fastapi.responses import Response

from core.auth import get_user_id_from_header, get_user_identity
from core.config import settings
from core.database import (
    SessionLocal, Conversation, Message,
    CoreMemoryFact, ProspectingCampaign, ProspectLead, Skill
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    from_date: Optional[str] = Query(None, description="Debut de periode (ISO 8601)"),
    to_date: Optional[str] = Query(None, description="Fin de periode (ISO 8601)"),
    authorization: str | None = Header(None),
):
    """
    Retourne les statistiques scopees au compte ou a l'organisation active.
    """
    scope_id = get_user_id_from_header(authorization)
    if scope_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)

        def _parse_dt(value: str) -> datetime:
            return datetime.fromisoformat(value.replace("Z", "").split(".")[0])

        try:
            period_end = _parse_dt(to_date) if to_date else now
        except Exception:
            period_end = now
        try:
            period_start = _parse_dt(from_date) if from_date else week_start
        except Exception:
            period_start = week_start

        scoped_conversations = db.query(Conversation).filter(Conversation.user_id == scope_id)
        scoped_messages = db.query(Message).join(
            Conversation, Message.conversation_id == Conversation.id
        ).filter(Conversation.user_id == scope_id)
        scoped_facts = db.query(CoreMemoryFact).filter(CoreMemoryFact.user_id == scope_id)
        scoped_campaigns = db.query(ProspectingCampaign).filter(ProspectingCampaign.user_id == scope_id)
        scoped_skills = db.query(Skill).filter(Skill.user_id == scope_id)

        total_conversations = scoped_conversations.filter(Conversation.status != "deleted").count()
        active_conversations = scoped_conversations.filter(
            Conversation.status == "active",
            Conversation.platform == "web",
        ).count()
        messenger_conversations = scoped_conversations.filter(
            Conversation.platform == "messenger",
            Conversation.status != "deleted",
        ).count()
        recent_conversations = scoped_conversations.filter(
            Conversation.updated_at >= week_start,
            Conversation.status != "deleted",
        ).count()

        total_messages = scoped_messages.count()
        messages_today = scoped_messages.filter(Message.timestamp >= today_start).count()
        messages_week = scoped_messages.filter(Message.timestamp >= week_start).count()

        period_messages = scoped_messages.filter(
            Message.timestamp >= period_start,
            Message.timestamp <= period_end,
        ).count()
        period_conversations = scoped_conversations.filter(
            Conversation.updated_at >= period_start,
            Conversation.updated_at <= period_end,
            Conversation.status != "deleted",
        ).count()
        period_leads = db.query(ProspectLead).join(
            ProspectingCampaign, ProspectLead.campaign_id == ProspectingCampaign.id
        ).filter(
            ProspectingCampaign.user_id == scope_id,
            ProspectLead.created_at >= period_start,
            ProspectLead.created_at <= period_end,
        ).count()

        total_facts = scoped_facts.count()
        facts_by_category: dict[str, int] = {}
        for fact in scoped_facts.all():
            facts_by_category[fact.category] = facts_by_category.get(fact.category, 0) + 1

        total_campaigns = scoped_campaigns.count()
        running_campaigns = scoped_campaigns.filter(ProspectingCampaign.status == "running").count()
        completed_campaigns = scoped_campaigns.filter(ProspectingCampaign.status == "completed").count()
        total_leads = db.query(ProspectLead).join(
            ProspectingCampaign, ProspectLead.campaign_id == ProspectingCampaign.id
        ).filter(ProspectingCampaign.user_id == scope_id).count()
        total_emails_sent = scoped_campaigns.with_entities(ProspectingCampaign.emails_sent).all()
        emails_sent_total = sum(row[0] or 0 for row in total_emails_sent)
        last_campaign = scoped_campaigns.order_by(ProspectingCampaign.created_at.desc()).first()

        total_skills = scoped_skills.count()
        active_skills = scoped_skills.filter(Skill.is_active == "true").count()
        skills_by_category: dict[str, int] = {}
        for skill in scoped_skills.all():
            skills_by_category[skill.category] = skills_by_category.get(skill.category, 0) + 1

        cm_active_conversations = scoped_conversations.filter(
            Conversation.platform == "messenger",
            Conversation.status == "active",
        ).count()

        return {
            "system": {
                "version": "2.0.0",
                "llm_provider": settings.LLM_PROVIDER,
                "llm_model": settings.OLLAMA_MODEL if settings.LLM_PROVIDER == "ollama" else settings.OPENAI_MODEL,
                "status": "en_ligne",
                "uptime": "disponible",
                "google_workspace": bool(settings.GOOGLE_SERVICE_ACCOUNT_JSON),
                "meta_facebook": bool(settings.META_ACCESS_TOKEN),
                "smtp": bool(settings.SMTP_USER),
            },
            "conversations": {
                "total": total_conversations,
                "active": active_conversations,
                "messenger": messenger_conversations,
                "this_week": recent_conversations,
            },
            "messages": {
                "total": total_messages,
                "today": messages_today,
                "this_week": messages_week,
            },
            "memory": {
                "total_facts": total_facts,
                "by_category": facts_by_category,
            },
            "prospecting": {
                "total_campaigns": total_campaigns,
                "running": running_campaigns,
                "completed": completed_campaigns,
                "total_leads": total_leads,
                "emails_sent": emails_sent_total,
                "last_campaign": {
                    "id": last_campaign.id,
                    "sector": last_campaign.sector,
                    "status": last_campaign.status,
                    "leads_found": last_campaign.leads_found,
                    "emails_sent": last_campaign.emails_sent,
                    "created_at": last_campaign.created_at.isoformat() if last_campaign.created_at else None,
                } if last_campaign else None,
            },
            "skills": {
                "total": total_skills,
                "active": active_skills,
                "by_category": skills_by_category,
            },
            "agents": {
                "cm_facebook": {
                    "name": "Agent CM Facebook",
                    "status": "en_ligne",
                    "icon": "facebook",
                    "conversations_actives": cm_active_conversations,
                    "description": "Community management Messenger",
                },
                "prosp_swarm": {
                    "name": "Groupe de Prospection",
                    "status": "running" if running_campaigns > 0 else "idle",
                    "icon": "users",
                    "campaigns_running": running_campaigns,
                    "total_leads": total_leads,
                    "emails_sent": emails_sent_total,
                    "description": "9 agents de prospection email",
                },
            },
            "period": {
                "messages": period_messages,
                "conversations": period_conversations,
                "leads": period_leads,
                "from_date": period_start.isoformat(),
                "to_date": period_end.isoformat(),
            },
        }
    finally:
        db.close()

@router.get("/agents")
async def get_agents_status():
    """Retourne le statut dÃ©taillÃ© de tous les agents."""
    db = SessionLocal()
    try:
        # CM Facebook
        cm_conversations = db.query(Conversation).filter(
            Conversation.platform == "messenger"
        ).order_by(Conversation.updated_at.desc()).limit(5).all()

        # Prosp Swarm
        campaigns = db.query(ProspectingCampaign).order_by(
            ProspectingCampaign.created_at.desc()
        ).limit(10).all()

        return {
            "cm_facebook": {
                "status": "en_ligne",
                "total_messenger_conversations": db.query(Conversation).filter(
                    Conversation.platform == "messenger"
                ).count(),
                "recent_conversations": [
                    {
                        "id": c.id,
                        "title": c.title,
                        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                        "status": c.status,
                    }
                    for c in cm_conversations
                ],
            },
            "prosp_swarm": {
                "status": "running" if any(c.status == "running" for c in campaigns) else "idle",
                "campaigns": [
                    {
                        "id": c.id,
                        "sector": c.sector,
                        "city": c.city,
                        "status": c.status,
                        "leads_found": c.leads_found,
                        "emails_sent": c.emails_sent,
                        "responses": c.responses,
                        "created_at": c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in campaigns
                ],
            },
        }
    finally:
        db.close()


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()


def _strip_prefix(value: str, pattern: str) -> str:
    return re.sub(pattern, "", _clean_text(value), flags=re.IGNORECASE).strip()


def _parse_int(value: Any) -> int:
    cleaned = re.sub(r"[^\d-]", "", _clean_text(value))
    return int(cleaned) if cleaned else 0


def _parse_float(value: Any) -> float:
    cleaned = _clean_text(value).replace(" ", "").replace(",", ".")
    match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    return float(match.group(0)) if match else 0.0


def _accent_from_label(label: str) -> str:
    if any(token in label for token in ["Messages", "A Reprendre", "Prets A Acheter", "Demandes De Prix"]):
        return "orange"
    if any(token in label for token in ["Temps Moyen", "Tokens Totaux", "Cout Total", "Cout Moyen", "Tokens Par Message"]):
        return "navy"
    return "neutral"


def _find_table_after_heading(soup: BeautifulSoup, heading_text: str):
    heading = next(
        (node for node in soup.find_all("h2") if _clean_text(node.get_text()) == heading_text),
        None,
    )
    if not heading:
        return None

    table = heading.find_next_sibling("table")
    if table:
        return table

    node = heading.next_sibling
    while node is not None:
        if getattr(node, "name", None) == "table":
            return node
        node = getattr(node, "next_sibling", None)
    return None


def _table_rows(table) -> list[list[str]]:
    if table is None:
        return []
    rows: list[list[str]] = []
    for row in table.find_all("tr")[1:]:
        cells = [_clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all("td")]
        if cells:
            rows.append(cells)
    return rows


def _parse_conversation_cards(soup: BeautifulSoup) -> list[dict[str, Any]]:
    conversations: list[dict[str, Any]] = []
    for card in soup.select(".conversation-card"):
        subtitle = _clean_text(card.select_one(".conversation-sub").get_text(" ", strip=True) if card.select_one(".conversation-sub") else "")
        parts = [_clean_text(part) for part in subtitle.split("|")]
        status = parts[0] if len(parts) > 0 else ""
        mode_text = parts[1] if len(parts) > 1 else ""
        psid = _clean_text(
            card.select_one("input[name='psid']").get("value", "") if card.select_one("input[name='psid']") else (parts[2] if len(parts) > 2 else "")
        )
        active_mode = "human" if "humain" in mode_text.lower() else "agent" if "agent" in mode_text.lower() else ""
        available_modes: list[str] = []

        for form in card.select(".mode-controls form"):
            mode_input = form.select_one("input[name='mode']")
            button = form.select_one("button")
            mode_value = _clean_text(mode_input.get("value", "") if mode_input else "")
            disabled = bool(button and button.has_attr("disabled"))
            if disabled and mode_value:
                active_mode = mode_value
            elif mode_value:
                available_modes.append(mode_value)

        exchanges = []
        for exchange in card.select(".exchange"):
            exchanges.append({
                "time": _clean_text(exchange.select_one(".exchange-meta").get_text(" ", strip=True) if exchange.select_one(".exchange-meta") else ""),
                "customerMessage": _strip_prefix(
                    exchange.select_one(".bubble.customer").get_text(" ", strip=True) if exchange.select_one(".bubble.customer") else "",
                    r"^Client\s*:\s*",
                ),
                "agentReply": _strip_prefix(
                    exchange.select_one(".bubble.agent").get_text(" ", strip=True) if exchange.select_one(".bubble.agent") else "",
                    r"^(Agent|Humain)\s*:\s*",
                ),
            })

        conversations.append({
            "psid": psid or _clean_text(card.select_one("h3").get_text(" ", strip=True) if card.select_one("h3") else ""),
            "customer": _clean_text(card.select_one("h3").get_text(" ", strip=True) if card.select_one("h3") else "Client"),
            "status": status,
            "mode": active_mode or mode_text.lower(),
            "humanTakeover": active_mode == "human" or "humain" in mode_text.lower(),
            "lastMessage": _strip_prefix(
                card.select_one(".conversation-last").get_text(" ", strip=True) if card.select_one(".conversation-last") else "",
                r"^Dernier message\s*:\s*",
            ),
            "availableModes": available_modes,
            "exchanges": exchanges,
        })

    return conversations


def _parse_messenger_dashboard_html(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    summary = []
    for stat in soup.select(".grid .stat"):
        label = _clean_text(stat.select_one(".label").get_text(" ", strip=True) if stat.select_one(".label") else "")
        value = _clean_text(stat.select_one(".value").get_text(" ", strip=True) if stat.select_one(".value") else "")
        sublabel = _clean_text(stat.select_one(".sub").get_text(" ", strip=True) if stat.select_one(".sub") else "")
        if label:
            summary.append({
                "label": label,
                "value": value,
                "sublabel": sublabel,
                "accent": _accent_from_label(label),
            })

    period_stats = []
    for cells in _table_rows(_find_table_after_heading(soup, "Cumul Des Depenses")):
        period_stats.append({
            "label": cells[0] if len(cells) > 0 else "Periode",
            "messages": _parse_int(cells[1] if len(cells) > 1 else 0),
            "tokens": _parse_int(cells[2] if len(cells) > 2 else 0),
            "costUsd": _parse_float(cells[3] if len(cells) > 3 else 0),
            "costLabel": cells[3] if len(cells) > 3 else "$0.0000",
            "quotes": _parse_int(cells[4] if len(cells) > 4 else 0),
            "purchases": _parse_int(cells[5] if len(cells) > 5 else 0),
            "needsHuman": _parse_int(cells[6] if len(cells) > 6 else 0),
        })

    priority_queue = []
    for cells in _table_rows(_find_table_after_heading(soup, "A Traiter En Priorite")):
        priority_queue.append({
            "time": cells[0] if len(cells) > 0 else "",
            "priority": cells[1] if len(cells) > 1 else "",
            "customer": cells[2] if len(cells) > 2 else "Client",
            "message": cells[3] if len(cells) > 3 else "",
            "status": cells[4] if len(cells) > 4 else "",
            "mode": cells[5] if len(cells) > 5 else "",
            "tokens": _parse_int(cells[6] if len(cells) > 6 else 0),
            "costUsd": _parse_float(cells[7] if len(cells) > 7 else 0),
            "costLabel": cells[7] if len(cells) > 7 else "$0.0000",
        })

    archive_status = next(
        (
            _clean_text(node.get_text(" ", strip=True))
            for node in soup.select(".box p")
            if "archive 24h" in _clean_text(node.get_text(" ", strip=True)).lower()
        ),
        "",
    )

    return {
        "summary": summary,
        "periodStats": period_stats,
        "priorityQueue": priority_queue,
        "conversations": _parse_conversation_cards(soup),
        "archiveStatus": archive_status,
    }


def _build_recent_messages(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recent_messages = []
    for record in records:
        recent_messages.append({
            "psid": _clean_text(
                record.get("psid")
                or record.get("sender_psid")
                or record.get("customer_psid")
                or record.get("sender_id")
            ),
            "time": record.get("received_at", ""),
            "customer": _clean_text(record.get("customer_name")) or "Client",
            "message": _clean_text(record.get("customer_message")),
            "reply": _clean_text(record.get("ai_reply")),
            "status": _clean_text(record.get("lead_status")) or "new",
            "mode": "human" if bool(record.get("needs_human")) else "agent",
            "needsHuman": bool(record.get("needs_human")),
            "readyToBuy": bool(record.get("order_signal")),
            "tokens": int(record.get("total_tokens") or 0),
            "costUsd": float(record.get("estimated_cost_usd") or 0.0),
            "costLabel": f"${float(record.get('estimated_cost_usd') or 0.0):.4f}",
            "latencyMs": int(record.get("latency_ms") or 0),
            "provider": _clean_text(record.get("llm_provider")) or "unknown",
            "model": _clean_text(record.get("llm_model")) or "unknown",
            "intent": _clean_text(record.get("intent")) or "general",
        })
    return recent_messages


def _build_customer_highlights(
    records: list[dict[str, Any]],
    conversations: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[_clean_text(record.get("customer_name")) or "Client"].append(record)

    conversation_map = {item["customer"]: item for item in conversations}
    highlights: list[dict[str, Any]] = []
    status_counter: Counter[str] = Counter()
    intent_counter: Counter[str] = Counter()
    provider_counter: dict[tuple[str, str], dict[str, Any]] = {}

    for customer, entries in grouped.items():
        entries.sort(key=lambda item: item.get("received_at", ""), reverse=True)
        latest = entries[0]
        total_cost = sum(float(item.get("estimated_cost_usd") or 0.0) for item in entries)
        total_tokens = sum(int(item.get("total_tokens") or 0) for item in entries)
        needs_human = any(bool(item.get("needs_human")) for item in entries)
        ready_to_buy = any(bool(item.get("order_signal")) for item in entries)
        status = _clean_text(latest.get("lead_status")) or "new"

        highlights.append({
            "customer": customer,
            "status": status,
            "needsHuman": needs_human,
            "readyToBuy": ready_to_buy,
            "messageCount": len(entries),
            "totalCostUsd": total_cost,
            "totalTokens": total_tokens,
            "lastMessageAt": latest.get("received_at", ""),
            "lastMessage": _clean_text(latest.get("customer_message")),
            "lastReply": _clean_text(latest.get("ai_reply")),
            "mode": conversation_map.get(customer, {}).get("mode", "agent"),
            "psid": conversation_map.get(customer, {}).get("psid", customer),
        })
        status_counter[status] += 1

        for item in entries:
            intent_counter[_clean_text(item.get("intent")) or "general"] += 1
            key = (
                _clean_text(item.get("llm_provider")) or "unknown",
                _clean_text(item.get("llm_model")) or "unknown",
            )
            if key not in provider_counter:
                provider_counter[key] = {
                    "provider": key[0],
                    "model": key[1],
                    "messages": 0,
                    "tokens": 0,
                    "costUsd": 0.0,
                }
            provider_counter[key]["messages"] += 1
            provider_counter[key]["tokens"] += int(item.get("total_tokens") or 0)
            provider_counter[key]["costUsd"] += float(item.get("estimated_cost_usd") or 0.0)

    highlights.sort(
        key=lambda item: (
            not item["needsHuman"],
            not item["readyToBuy"],
            item["status"] not in {"hot", "qualified"},
            item["lastMessageAt"],
        )
    )

    status_breakdown = [
        {"label": label, "count": count}
        for label, count in status_counter.most_common()
    ]
    intent_breakdown = [
        {"label": label, "count": count}
        for label, count in intent_counter.most_common()
    ]
    provider_breakdown = sorted(
        provider_counter.values(),
        key=lambda item: (item["costUsd"], item["tokens"], item["messages"]),
        reverse=True,
    )
    return highlights, status_breakdown, intent_breakdown, provider_breakdown


def _parse_allowed_emails(raw: str) -> set[str]:
    return {item.strip().lower() for item in str(raw or "").split(",") if item.strip()}


def _messenger_operator_emails() -> set[str]:
    return _parse_allowed_emails(settings.ADMIN_EMAILS) | _parse_allowed_emails(settings.DEV_EMAILS)


def _active_organization_slug(authorization: str | None) -> str | None:
    """Retourne l'identifiant de scope pour Messenger Direct (user_id par defaut)."""
    resolved_scope_id = get_user_id_from_header(authorization)
    if resolved_scope_id == "anonymous":
        return None
    if resolved_scope_id.startswith("org:"):
        return resolved_scope_id.split(":", 1)[1].strip().lower() or None
    return resolved_scope_id


def _messenger_dashboard_access_scope(authorization: str | None) -> str:
    user_id, user_email = get_user_identity(authorization)
    if user_id == "anonymous":
        return "public"
    normalized_email = user_email.strip().lower()
    if normalized_email in _messenger_operator_emails():
        return "operator"

    return "authenticated"


def _can_view_full_messenger_data(authorization: str | None) -> bool:
    return _messenger_dashboard_access_scope(authorization) == "operator"


def _require_authenticated_dashboard_access(authorization: str | None) -> None:
    access_scope = _messenger_dashboard_access_scope(authorization)
    if access_scope == "public":
        raise HTTPException(status_code=401, detail="Connexion requise pour cette action Messenger.")
    if access_scope != "operator":
        raise HTTPException(status_code=403, detail="Compte autorise requis pour cette action Messenger.")


def _messenger_direct_headers() -> dict[str, str]:
    dashboard_key = (settings.MESSENGER_DIRECT_DASHBOARD_KEY or "").strip()
    if not dashboard_key:
        raise HTTPException(status_code=503, detail="La cle interne du cockpit Messenger n'est pas configuree.")
    return {
        "Accept": "application/json",
        "X-FLARE-Dashboard-Key": dashboard_key,
    }


async def _fetch_messenger_dashboard_bundle(
    organization_slug: str | None = None,
    page_id: str | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    base_url = settings.MESSENGER_DIRECT_URL.rstrip("/")
    timeout = httpx.Timeout(20.0, connect=10.0)
    headers = _messenger_direct_headers()
    params = {}
    if organization_slug:
        params["organization_slug"] = organization_slug
    if page_id:
        params["page_id"] = page_id

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        state_response, export_response = await asyncio.gather(
            client.get(f"{base_url}/dashboard/internal", headers=headers, params=params),
            client.get(f"{base_url}/dashboard/export.json?range=24h", headers=headers, params=params),
        )

    if state_response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Le dashboard Messenger ne repond pas.")
    if export_response.status_code >= 400:
        raise HTTPException(status_code=502, detail="L'export Messenger 24h ne repond pas.")

    try:
        dashboard_state = state_response.json()
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Le dashboard interne Messenger est invalide.") from error

    try:
        records = export_response.json()
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Le JSON Messenger est invalide.") from error

    if not isinstance(dashboard_state, dict):
        dashboard_state = {}

    # Contract normalization:
    # - Preferred shape: native JSON fields (summary/periodStats/priorityQueue/conversations/archiveStatus/lastUpdated)
    # - Legacy fallback: HTML-only payload from direct service.
    normalized_state: dict[str, Any] = dict(dashboard_state)
    if (
        not isinstance(normalized_state.get("summary"), list)
        and isinstance(normalized_state.get("html"), str)
    ):
        parsed_html_state = _parse_messenger_dashboard_html(normalized_state.get("html", ""))
        normalized_state.update(parsed_html_state)

    summary = normalized_state.get("summary")
    period_stats = normalized_state.get("periodStats")
    priority_queue = normalized_state.get("priorityQueue")
    conversations = normalized_state.get("conversations")

    normalized_state["summary"] = summary if isinstance(summary, list) else []
    normalized_state["periodStats"] = period_stats if isinstance(period_stats, list) else []
    normalized_state["priorityQueue"] = priority_queue if isinstance(priority_queue, list) else []
    normalized_state["conversations"] = conversations if isinstance(conversations, list) else []
    normalized_state["archiveStatus"] = _clean_text(normalized_state.get("archiveStatus"))
    normalized_state["lastUpdated"] = (
        _clean_text(normalized_state.get("lastUpdated"))
        or _clean_text(normalized_state.get("last_updated"))
        or datetime.utcnow().isoformat()
    )

    return normalized_state, records if isinstance(records, list) else []


def _build_messenger_totals(summary: list[dict[str, Any]], conversations: list[dict[str, Any]], records: list[dict[str, Any]]) -> dict[str, Any]:
    summary_lookup = {item["label"]: item["value"] for item in summary}
    return {
        "messages24h": _parse_int(summary_lookup.get("Messages", len(records))),
        "contacts": _parse_int(summary_lookup.get("Contacts", len(conversations))),
        "humanModeContacts": _parse_int(summary_lookup.get("Mode Humain", sum(1 for item in conversations if item["humanTakeover"]))),
        "needsAttentionContacts": _parse_int(summary_lookup.get("A Reprendre", 0)),
        "readyToBuyContacts": _parse_int(summary_lookup.get("Prets A Acheter", 0)),
        "quoteRequests": _parse_int(summary_lookup.get("Demandes De Prix", 0)),
        "avgLatencyMs": _parse_int(summary_lookup.get("Temps Moyen", 0)),
        "totalTokens": _parse_int(summary_lookup.get("Tokens Totaux", 0)),
        "totalCostUsd": _parse_float(summary_lookup.get("Cout Total", 0)),
        "avgCostUsd": _parse_float(summary_lookup.get("Cout Moyen", 0)),
        "tokensPerMessage": _parse_int(summary_lookup.get("Tokens Par Message", 0)),
    }


def _public_contact_alias(psid: Any = None, customer: Any = None) -> tuple[str, str]:
    identity = _clean_text(psid) or _clean_text(customer) or "unknown"
    digest = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:8].upper()
    return f"public-{digest.lower()}", f"Client {digest[:4]}"


def _public_signal_summary(
    *,
    status: Any = "",
    message: Any = "",
    priority: Any = "",
    needs_human: bool = False,
    ready_to_buy: bool = False,
    intent: Any = "",
) -> str:
    normalized = " ".join(
        [
            _clean_text(status),
            _clean_text(message),
            _clean_text(priority),
            _clean_text(intent),
        ]
    ).lower()

    if needs_human or any(token in normalized for token in ["support", "humain", "conseiller", "reprendre"]):
        return "Demande de reprise humaine a traiter."
    if ready_to_buy or any(token in normalized for token in ["hot", "acheter", "commande", "validation", "rendez"]):
        return "Interet commercial fort detecte."
    if any(token in normalized for token in ["prix", "devis", "tarif"]):
        return "Question prix ou devis a traiter."
    if any(token in normalized for token in ["offre", "catalogue", "choix"]):
        return "Choix d'offre ou de formule en cours."
    if "service" in normalized:
        return "Besoin de service a qualifier."
    return "Signal commercial a verifier."


def _public_reply_summary(needs_human: bool = False, ready_to_buy: bool = False) -> str:
    if needs_human:
        return "FLARE recommande une reprise humaine sur ce cas."
    if ready_to_buy:
        return "Le bot garde la conversation dans un tunnel commercial avance."
    return "Le bot suit la conversation et conserve le contexte utile."


def _sanitize_public_messenger_payload(payload: dict[str, Any]) -> dict[str, Any]:
    def alias_for(psid: Any = None, customer: Any = None) -> tuple[str, str]:
        return _public_contact_alias(psid=psid, customer=customer)

    sanitized_priority_queue: list[dict[str, Any]] = []
    for item in payload.get("priorityQueue", []):
        _, customer_label = alias_for(customer=item.get("customer"))
        sanitized_priority_queue.append(
            {
                **item,
                "customer": customer_label,
                "message": _public_signal_summary(
                    status=item.get("status"),
                    message=item.get("message"),
                    priority=item.get("priority"),
                ),
            }
        )

    sanitized_recent_messages: list[dict[str, Any]] = []
    for item in payload.get("recentMessages", []):
        public_id, customer_label = alias_for(psid=item.get("psid"), customer=item.get("customer"))
        sanitized_recent_messages.append(
            {
                **item,
                "psid": public_id,
                "customer": customer_label,
                "message": _public_signal_summary(
                    status=item.get("status"),
                    message=item.get("message"),
                    needs_human=bool(item.get("needsHuman")),
                    ready_to_buy=bool(item.get("readyToBuy")),
                    intent=item.get("intent"),
                ),
                "reply": _public_reply_summary(
                    needs_human=bool(item.get("needsHuman")),
                    ready_to_buy=bool(item.get("readyToBuy")),
                ),
            }
        )

    sanitized_conversations: list[dict[str, Any]] = []
    for item in payload.get("conversations", []):
        public_id, customer_label = alias_for(psid=item.get("psid"), customer=item.get("customer"))
        sanitized_conversations.append(
            {
                **item,
                "psid": public_id,
                "customer": customer_label,
                "lastMessage": _public_signal_summary(
                    status=item.get("status"),
                    message=item.get("lastMessage"),
                ),
                "availableModes": [],
                "exchanges": [
                    {
                        "time": exchange.get("time"),
                        "customerMessage": _public_signal_summary(
                            status=item.get("status"),
                            message=exchange.get("customerMessage"),
                        ),
                        "agentReply": _public_reply_summary(
                            needs_human=bool(item.get("humanTakeover")),
                            ready_to_buy="hot" in _clean_text(item.get("status")).lower(),
                        ),
                    }
                    for exchange in item.get("exchanges", [])
                ],
            }
        )

    sanitized_highlights: list[dict[str, Any]] = []
    for item in payload.get("customerHighlights", []):
        public_id, customer_label = alias_for(psid=item.get("psid"), customer=item.get("customer"))
        sanitized_highlights.append(
            {
                **item,
                "psid": public_id,
                "customer": customer_label,
                "lastMessage": _public_signal_summary(
                    status=item.get("status"),
                    message=item.get("lastMessage"),
                    needs_human=bool(item.get("needsHuman")),
                    ready_to_buy=bool(item.get("readyToBuy")),
                ),
                "lastReply": _public_reply_summary(
                    needs_human=bool(item.get("needsHuman")),
                    ready_to_buy=bool(item.get("readyToBuy")),
                ),
            }
        )

    return {
        **payload,
        "priorityQueue": sanitized_priority_queue,
        "recentMessages": sanitized_recent_messages,
        "conversations": sanitized_conversations,
        "customerHighlights": sanitized_highlights,
        "urls": {
            "json24h": "",
            "csv24h": "",
            "csvAll": "",
            "jsonAll": "",
        },
    }


def _empty_messenger_payload(access_scope: str) -> dict[str, Any]:
    return {
        "summary": [],
        "periodStats": [],
        "priorityQueue": [],
        "recentMessages": [],
        "conversations": [],
        "archiveStatus": "",
        "lastUpdated": datetime.utcnow().isoformat(),
        "totals": {
            "messages24h": 0,
            "contacts": 0,
            "humanModeContacts": 0,
            "needsAttentionContacts": 0,
            "readyToBuyContacts": 0,
            "quoteRequests": 0,
            "avgLatencyMs": 0,
            "totalTokens": 0,
            "totalCostUsd": 0.0,
            "avgCostUsd": 0.0,
            "tokensPerMessage": 0,
        },
        "statusBreakdown": [],
        "intentBreakdown": [],
        "providerBreakdown": [],
        "customerHighlights": [],
        "access": {
            "scope": access_scope,
            "canViewSensitive": access_scope == "operator",
            "canExport": False,
            "canSwitchMode": False,
            "message": "Connectez-vous pour acceder aux donnees Messenger.",
        },
        "urls": {
            "json24h": "",
            "csv24h": "",
            "csvAll": "",
            "jsonAll": "",
        },
    }


@router.get("/messenger")
async def get_messenger_dashboard_data(
    authorization: str | None = Header(None),
    page_id: str | None = Query(None, description="Filtre par ID de Page Facebook")
):
    """Expose une vue native FLARE des donnÃ©es du chatbot Messenger prÃªt."""
    organization_slug = _active_organization_slug(authorization)
    access_scope = _messenger_dashboard_access_scope(authorization)
    if not organization_slug:
        return _empty_messenger_payload(access_scope)

    parsed, records = await _fetch_messenger_dashboard_bundle(
        organization_slug=organization_slug,
        page_id=page_id
    )
    recent_messages = _build_recent_messages(records)
    customer_highlights, status_breakdown, intent_breakdown, provider_breakdown = _build_customer_highlights(
        records,
        parsed.get("conversations", []),
    )
    payload = {
        "summary": parsed.get("summary", []),
        "periodStats": parsed.get("periodStats", []),
        "priorityQueue": parsed.get("priorityQueue", []),
        "recentMessages": recent_messages,
        "conversations": parsed.get("conversations", []),
        "archiveStatus": parsed.get("archiveStatus", ""),
        "lastUpdated": parsed.get("lastUpdated") or datetime.utcnow().isoformat(),
        "totals": _build_messenger_totals(parsed.get("summary", []), parsed.get("conversations", []), records),
        "statusBreakdown": status_breakdown,
        "intentBreakdown": intent_breakdown,
        "providerBreakdown": provider_breakdown,
        "customerHighlights": customer_highlights,
        "access": {
            "scope": access_scope,
            "canViewSensitive": access_scope == "operator",
            "canExport": access_scope == "operator",
            "canSwitchMode": access_scope == "operator",
            "message": (
                "Compte operateur autorise : toutes les donnees et actions Messenger sont disponibles."
                if access_scope == "operator"
                else "Mode decouverte actif : les noms clients, messages bruts, exports et reprises humaines sont reserves a un compte operateur autorise."
            ),
        },
        "urls": {
            "json24h": "/dashboard/messenger/export.json?range=24h",
            "csv24h": "/dashboard/messenger/export.csv?range=24h",
            "csvAll": "/dashboard/messenger/export.csv?range=all",
            "jsonAll": "/dashboard/messenger/export.json?range=all",
        },
    }
    if not _can_view_full_messenger_data(authorization):
        return _sanitize_public_messenger_payload(payload)
    return payload


async def _proxy_messenger_export(
    file_type: str,
    range_value: str,
    organization_slug: str | None = None,
) -> Response:
    if range_value not in {"24h", "all"}:
        raise HTTPException(status_code=400, detail="La plage exportee est invalide.")
    if file_type not in {"json", "csv"}:
        raise HTTPException(status_code=400, detail="Le format exporte est invalide.")

    base_url = settings.MESSENGER_DIRECT_URL.rstrip("/")
    timeout = httpx.Timeout(20.0, connect=10.0)
    headers = _messenger_direct_headers()
    params = {"range": range_value}
    if organization_slug:
        params["organization_slug"] = organization_slug
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(
            f"{base_url}/dashboard/export.{file_type}",
            headers=headers,
            params=params,
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="L'export Messenger est indisponible.")

    headers = {
        "Content-Disposition": response.headers.get(
            "content-disposition",
            f'attachment; filename="messenger-dashboard-{range_value}.{file_type}"',
        ),
        "Cache-Control": "no-store",
    }
    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "application/octet-stream"),
        headers=headers,
    )


@router.get("/messenger/export.json")
async def proxy_messenger_export_json(range: str = Query("24h"), authorization: str | None = Header(None)):
    _require_authenticated_dashboard_access(authorization)
    return await _proxy_messenger_export("json", range, organization_slug=_active_organization_slug(authorization))


@router.get("/messenger/export.csv")
async def proxy_messenger_export_csv(range: str = Query("24h"), authorization: str | None = Header(None)):
    _require_authenticated_dashboard_access(authorization)
    return await _proxy_messenger_export("csv", range, organization_slug=_active_organization_slug(authorization))


@router.post("/messenger/contact-mode")
async def update_messenger_contact_mode(
    psid: str = Form(...),
    mode: str = Form(...),
    authorization: str | None = Header(None),
):
    _require_authenticated_dashboard_access(authorization)
    if mode not in {"human", "agent"}:
        raise HTTPException(status_code=400, detail="Le mode de conversation est invalide.")

    base_url = settings.MESSENGER_DIRECT_URL.rstrip("/")
    timeout = httpx.Timeout(20.0, connect=10.0)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        **_messenger_direct_headers(),
    }
    form_payload = {"psid": psid, "mode": mode}
    organization_slug = _active_organization_slug(authorization)
    if organization_slug:
        form_payload["organization_slug"] = organization_slug
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.post(
            f"{base_url}/dashboard/contact-mode",
            data=form_payload,
            headers=headers,
        )

    if response.status_code >= 400:
        try:
            err_detail = response.json().get("detail", response.text[:200])
        except Exception:
            err_detail = response.text[:200] if response.text else "Erreur inconnue"
        logger.error("contact-mode failed psid=%s mode=%s status=%s detail=%s", psid, mode, response.status_code, err_detail)
        raise HTTPException(status_code=502, detail=f"Le changement de mode Messenger a echoue : {err_detail}")

    return {"status": "ok", "psid": psid, "mode": mode}
