import asyncio
import csv
import datetime as dt
import hashlib
import hmac
import io
import json
import logging
import mimetypes
import os
import re
import sqlite3
import time
from html import escape as html_escape
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlparse, urlunparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles


logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger("messenger_direct")
DASHBOARD_ACCESS_HEADER = "X-FLARE-Dashboard-Key"
PRODUCTION_BACKEND_FALLBACK_URL = "https://flare-backend-jyyz.onrender.com"

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "runtime_config.json"
DB_PATH = BASE_DIR / "messenger_runtime.db"
ENV_PATH = BASE_DIR / ".env"
CATALOG_MEDIA_DIR = BASE_DIR / "catalog_media"
CATALOG_MANIFEST_PATH = CATALOG_MEDIA_DIR / "catalog_manifest.json"
MEDIA_CACHE_DIR = BASE_DIR / "media_cache"

load_dotenv(ENV_PATH)


def load_config() -> dict[str, str]:
    file_config: dict[str, str] = {}
    if CONFIG_PATH.exists():
        file_config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    def pick(env_name: str, file_key: str, default: str = "") -> str:
        return os.getenv(env_name, file_config.get(file_key, default))

    return {
        "app_env": pick("APP_ENV", "app_env", "development"),
        "meta_verify_token": pick("META_VERIFY_TOKEN", "meta_verify_token"),
        "meta_page_id": pick("META_PAGE_ID", "meta_page_id"),
        "meta_page_access_token": pick("META_PAGE_ACCESS_TOKEN", "meta_page_access_token"),
        "meta_app_secret": pick("META_APP_SECRET", "meta_app_secret"),
        "meta_graph_version": pick("META_GRAPH_VERSION", "meta_graph_version", "v25.0"),
        "telegram_bot_token": pick("TELEGRAM_BOT_TOKEN", "telegram_bot_token"),
        "telegram_chat_id": pick("TELEGRAM_CHAT_ID", "telegram_chat_id"),
        "google_api_key": pick("GOOGLE_API_KEY", "google_api_key"),
        "google_genai_model": pick("GOOGLE_GENAI_MODEL", "google_genai_model", "gemini-2.5-flash-lite"),
        "archive_bucket_name": pick("ARCHIVE_BUCKET_NAME", "archive_bucket_name"),
        "backend_url": pick("BACKEND_URL", "backend_url"),
        "flare_chat_url": pick("FLARE_CHAT_URL", "flare_chat_url"),
        "flare_backend_webhook_url": pick("FLARE_BACKEND_WEBHOOK_URL", "flare_backend_webhook_url"),
        "flare_chat_mode": pick("FLARE_CHAT_MODE", "flare_chat_mode", "rapide"),
        "google_sheet_id": pick("GOOGLE_SHEET_ID", "google_sheet_id"),
        "google_service_account_json": pick("GOOGLE_SERVICE_ACCOUNT_JSON", "google_service_account_json"),
        "service_public_url": pick("SERVICE_PUBLIC_URL", "service_public_url"),
        "dashboard_access_key": pick("DASHBOARD_ACCESS_KEY", "dashboard_access_key"),
    }


CONFIG = load_config()
DASHBOARD_ACCESS_HEADER = "X-FLARE-Dashboard-Key"

MODEL_PRICING_PER_MILLION = {
    "gemini-2.5-flash-lite": {"input": 0.10, "output": 0.40},
    "gemini-2.5-flash-lite-preview-09-2025": {"input": 0.10, "output": 0.40},
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50},
}


app = FastAPI(title="Chatbot Facebook Direct Service", version="1.0.0")
CATALOG_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/catalog-media", StaticFiles(directory=str(CATALOG_MEDIA_DIR)), name="catalog-media")
GCP_TOKEN_CACHE: dict[str, Any] = {"access_token": "", "expires_at": 0.0}
TELEGRAM_NOTIFY_COOLDOWN_SECONDS = 6 * 3600
GOOGLE_SHEETS_ROW_CACHE_TTL_SECONDS = 60
MAX_DIRECT_MESSENGER_VIDEO_BYTES = 80 * 1024 * 1024
REMOTE_VIDEO_DOWNLOAD_TIMEOUT_SECONDS = 180
LOCAL_VIDEO_UPLOAD_TIMEOUT_SECONDS = 240
GOOGLE_SHEETS_HEADERS = {
    "contacts": [
        "psid",
        "first_name",
        "last_name",
        "display_name",
        "profile_pic",
        "preferred_language",
        "source_channel",
        "first_contact_at",
        "last_contact_at",
        "current_status",
        "current_mode",
        "assigned_to",
        "tags",
        "contact_details",
        "notes",
    ],
    "conversations": [
        "conversation_id",
        "psid",
        "opened_at",
        "last_message_at",
        "last_customer_message",
        "last_agent_reply",
        "conversation_status",
        "lead_stage",
        "priority",
        "needs_human",
        "current_mode",
        "last_telegram_reason",
        "last_telegram_notified_at",
        "owner",
        "notes",
    ],
    "messages": [
        "message_mid",
        "received_at",
        "psid",
        "direction",
        "customer_name",
        "message_text",
        "reply_text",
        "intent",
        "lead_status",
        "needs_human",
        "order_signal",
        "llm_provider",
        "llm_model",
        "prompt_tokens",
        "output_tokens",
        "total_tokens",
        "estimated_cost_usd",
        "latency_ms",
        "tags",
    ],
    "leads": [
        "lead_id",
        "psid",
        "created_at",
        "customer_name",
        "service_requested",
        "lead_stage",
        "lead_temperature",
        "budget_range",
        "location",
        "contact_details",
        "next_action",
        "next_action_due_at",
        "owner",
        "updated_at",
        "notes",
    ],
    "devis": [
        "quote_id",
        "psid",
        "created_at",
        "customer_name",
        "service_requested",
        "request_summary",
        "quote_status",
        "urgency",
        "responsible_notified_at",
        "contact_details",
        "follow_up_date",
        "amount_estimate",
        "owner",
        "updated_at",
        "notes",
    ],
    "rendez_vous": [
        "meeting_id",
        "psid",
        "created_at",
        "customer_name",
        "request_reason",
        "preferred_date",
        "preferred_time",
        "meeting_status",
        "responsible_notified_at",
        "scheduled_at",
        "contact_details",
        "owner",
        "updated_at",
        "notes",
    ],
    "kpi_journalier": [
        "day_key",
        "new_contacts",
        "active_conversations",
        "messages_received",
        "replies_sent",
        "human_escalations",
        "leads_created",
        "devis_requested",
        "rendez_vous_requested",
        "order_signals",
        "tokens_total",
        "cost_total_usd",
        "avg_latency_ms",
        "notes",
    ],
}
GOOGLE_SHEETS_CACHE: dict[str, Any] = {
    "access_token": "",
    "expires_at": 0.0,
    "row_maps": {},
}


def dashboard_access_key() -> str:
    return str(CONFIG.get("dashboard_access_key") or "").strip()


def _normalize_url_base(value: str) -> str:
    candidate = str(value or "").strip().rstrip("/")
    if not candidate:
        return ""
    parsed = urlparse(candidate)
    if not parsed.scheme or not parsed.netloc:
        return ""
    path = parsed.path.rstrip("/")
    for suffix in ("/webhook/facebook/relay", "/api/webhook/facebook", "/webhook/facebook", "/chat"):
        if path.endswith(suffix):
            path = path[: -len(suffix)]
            break
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", "")).rstrip("/")


def backend_base_url() -> str:
    explicit = str(CONFIG.get("flare_backend_webhook_url") or "").strip()
    if explicit:
        normalized = _normalize_url_base(explicit)
        if normalized:
            return normalized

    configured_backend = str(CONFIG.get("backend_url") or "").strip()
    if configured_backend:
        normalized = _normalize_url_base(configured_backend)
        if normalized:
            return normalized

    if str(CONFIG.get("app_env") or "").strip().lower() == "production":
        return PRODUCTION_BACKEND_FALLBACK_URL

    flare_chat_url = str(CONFIG.get("flare_chat_url") or "").strip()
    if not flare_chat_url:
        return ""

    return _normalize_url_base(flare_chat_url)


def backend_relay_targets(signature: str) -> list[tuple[str, dict[str, str]]]:
    base_url = backend_base_url()
    if not base_url:
        return []

    targets: list[tuple[str, dict[str, str]]] = []
    relay_key = dashboard_access_key()
    if relay_key:
        targets.append(
            (
                f"{base_url}/webhook/facebook/relay",
                {
                    "Content-Type": "application/json",
                    DASHBOARD_ACCESS_HEADER: relay_key,
                },
            )
        )

    signature_headers = {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
    }
    targets.append((f"{base_url}/webhook/facebook", signature_headers))
    targets.append((f"{base_url}/api/webhook/facebook", signature_headers))
    return targets


def _iter_payload_page_ids(payload: dict[str, Any]) -> list[str]:
    page_ids: list[str] = []
    for entry in payload.get("entry", []):
        entry_page_id = str(entry.get("id") or "").strip()
        for messaging in entry.get("messaging", []):
            if messaging.get("delivery") or messaging.get("read"):
                continue
            if messaging.get("message", {}).get("is_echo"):
                continue
            page_id = str(messaging.get("recipient", {}).get("id") or entry_page_id).strip()
            if page_id:
                page_ids.append(page_id)
    return page_ids


def payload_can_be_processed_locally(payload: dict[str, Any]) -> bool:
    page_ids = _iter_payload_page_ids(payload)
    if not page_ids:
        return True
    for page_id in page_ids:
        page_context = resolve_page_context(page_id)
        if bool(page_context.get("is_active")) and bool(str(page_context.get("page_access_token") or "").strip()):
            return True
    return False


def has_dashboard_access(request: Request) -> bool:
    expected = dashboard_access_key()
    if not expected:
        LOGGER.error("Dashboard access key is missing. Internal dashboard routes are disabled.")
        return False

    provided = request.headers.get(DASHBOARD_ACCESS_HEADER, "").strip()
    return bool(provided) and hmac.compare_digest(provided, expected)


def require_dashboard_access(request: Request) -> None:
    if not has_dashboard_access(request):
        raise HTTPException(status_code=403, detail="Dashboard access denied.")


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS contacts (
                psid TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                contact_name TEXT DEFAULT '',
                phone_number TEXT DEFAULT '',
                email TEXT DEFAULT '',
                profile_pic TEXT,
                last_message TEXT,
                intent TEXT,
                lead_status TEXT,
                needs_human INTEGER DEFAULT 0,
                order_signal INTEGER DEFAULT 0,
                human_takeover INTEGER DEFAULT 0,
                telegram_last_reason TEXT DEFAULT '',
                telegram_last_notified_at TEXT DEFAULT '',
                tags TEXT,
                last_seen_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                message_mid TEXT PRIMARY KEY,
                received_at TEXT,
                psid TEXT,
                customer_name TEXT,
                customer_message TEXT,
                ai_reply TEXT,
                intent TEXT,
                lead_status TEXT,
                needs_human INTEGER DEFAULT 0,
                order_signal INTEGER DEFAULT 0,
                tags TEXT,
                llm_provider TEXT DEFAULT '',
                llm_model TEXT DEFAULT '',
                prompt_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                estimated_cost_usd REAL DEFAULT 0,
                latency_ms INTEGER DEFAULT 0,
                raw_payload TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_stats (
                day_key TEXT PRIMARY KEY,
                message_count INTEGER DEFAULT 0,
                needs_human_count INTEGER DEFAULT 0,
                order_signal_count INTEGER DEFAULT 0,
                pricing_count INTEGER DEFAULT 0,
                prompt_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                total_cost_usd REAL DEFAULT 0,
                avg_latency_ms REAL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS page_connections (
                page_id TEXT PRIMARY KEY,
                page_name TEXT,
                organization_slug TEXT DEFAULT '',
                page_access_token TEXT,
                is_active INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                connected_at TEXT,
                updated_at TEXT
            )
            """
        )
        ensure_column(conn, "events", "llm_provider", "TEXT DEFAULT ''")
        ensure_column(conn, "events", "llm_model", "TEXT DEFAULT ''")
        ensure_column(conn, "events", "prompt_tokens", "INTEGER DEFAULT 0")
        ensure_column(conn, "events", "output_tokens", "INTEGER DEFAULT 0")
        ensure_column(conn, "events", "total_tokens", "INTEGER DEFAULT 0")
        ensure_column(conn, "events", "estimated_cost_usd", "REAL DEFAULT 0")
        ensure_column(conn, "events", "latency_ms", "INTEGER DEFAULT 0")
        ensure_column(conn, "contacts", "human_takeover", "INTEGER DEFAULT 0")
        ensure_column(conn, "contacts", "telegram_last_reason", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "telegram_last_notified_at", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "contact_name", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "phone_number", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "email", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "page_id", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "page_name", "TEXT DEFAULT ''")
        ensure_column(conn, "contacts", "organization_slug", "TEXT DEFAULT ''")
        ensure_column(conn, "events", "page_id", "TEXT DEFAULT ''")
        ensure_column(conn, "events", "page_name", "TEXT DEFAULT ''")
        ensure_column(conn, "events", "organization_slug", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "organization_slug", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "page_name", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "page_access_token", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "is_active", "INTEGER DEFAULT 1")
        ensure_column(conn, "page_connections", "status", "TEXT DEFAULT 'active'")
        ensure_column(conn, "page_connections", "connected_at", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "updated_at", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "bot_name", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "tone", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "language", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "greeting_message", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "company_description", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "products_summary", "TEXT DEFAULT ''")
        ensure_column(conn, "page_connections", "special_instructions", "TEXT DEFAULT ''")
        ensure_column(conn, "daily_stats", "message_count", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "needs_human_count", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "order_signal_count", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "pricing_count", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "prompt_tokens", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "output_tokens", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "total_tokens", "INTEGER DEFAULT 0")
        ensure_column(conn, "daily_stats", "total_cost_usd", "REAL DEFAULT 0")
        ensure_column(conn, "daily_stats", "avg_latency_ms", "REAL DEFAULT 0")
        conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
async def startup() -> None:
    init_db()
    await rehydrate_contacts()
    daily_count = await rehydrate_daily_stats()
    await rehydrate_recent_events(24, rebuild_daily_totals=(daily_count == 0))
    try:
        await configure_telegram_webhook()
    except Exception:
        pass


def get_page_connection(page_id: str) -> dict[str, Any] | None:
    resolved_page_id = str(page_id or "").strip()
    if not resolved_page_id:
        return None

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT * FROM page_connections WHERE page_id = ?",
            (resolved_page_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _clean_page_prompt_value(value: Any, limit: int, default: str = "") -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        return default
    return cleaned[:limit]


def upsert_page_connection(
    page_id: str,
    page_name: str,
    organization_slug: str,
    page_access_token: str,
    *,
    is_active: bool = True,
    status: str = "active",
    bot_name: str = "",
    tone: str = "",
    language: str = "",
    greeting_message: str = "",
    company_description: str = "",
    products_summary: str = "",
    special_instructions: str = "",
) -> dict[str, Any]:
    init_db()
    now = utc_now()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute(
            """
            INSERT INTO page_connections (
                page_id, page_name, organization_slug, page_access_token,
                is_active, status, connected_at, updated_at,
                bot_name, tone, language, greeting_message,
                company_description, products_summary, special_instructions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(page_id) DO UPDATE SET
                page_name = excluded.page_name,
                organization_slug = excluded.organization_slug,
                page_access_token = excluded.page_access_token,
                is_active = excluded.is_active,
                status = excluded.status,
                bot_name = excluded.bot_name,
                tone = excluded.tone,
                language = excluded.language,
                greeting_message = excluded.greeting_message,
                company_description = excluded.company_description,
                products_summary = excluded.products_summary,
                special_instructions = excluded.special_instructions,
                updated_at = excluded.updated_at
            """,
            (
                str(page_id or "").strip(),
                str(page_name or "").strip(),
                str(organization_slug or "").strip().lower(),
                str(page_access_token or "").strip(),
                1 if is_active else 0,
                str(status or "active").strip() or "active",
                now,
                now,
                _clean_page_prompt_value(bot_name, 120),
                _clean_page_prompt_value(tone, 40),
                _clean_page_prompt_value(language, 20),
                _clean_page_prompt_value(greeting_message, 1200),
                _clean_page_prompt_value(company_description, 4000),
                _clean_page_prompt_value(products_summary, 6000),
                _clean_page_prompt_value(special_instructions, 3000),
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM page_connections WHERE page_id = ?",
            (str(page_id or "").strip(),),
        ).fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def deactivate_page_connection(page_id: str) -> None:
    resolved_page_id = str(page_id or "").strip()
    if not resolved_page_id:
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            UPDATE page_connections
            SET is_active = 0, status = 'disconnected', updated_at = ?
            WHERE page_id = ?
            """,
            (utc_now(), resolved_page_id),
        )
        conn.commit()
    finally:
        conn.close()


def resolve_page_context(page_id: str = "") -> dict[str, Any]:
    row = get_page_connection(page_id)
    if row:
        raw_is_active = str(row.get("is_active") or "").strip().lower()
        is_active = raw_is_active in {"1", "true", "yes", "on"}
        page_access_token = str(row.get("page_access_token") or "").strip() if is_active else ""
        return {
            "page_id": str(row.get("page_id") or "").strip(),
            "page_name": str(row.get("page_name") or "").strip(),
            "organization_slug": str(row.get("organization_slug") or "").strip().lower(),
            "page_access_token": page_access_token,
            "is_active": is_active,
            "bot_name": str(row.get("bot_name") or "").strip(),
            "tone": str(row.get("tone") or "").strip(),
            "language": str(row.get("language") or "").strip(),
            "greeting_message": str(row.get("greeting_message") or "").strip(),
            "company_description": str(row.get("company_description") or "").strip(),
            "products_summary": str(row.get("products_summary") or "").strip(),
            "special_instructions": str(row.get("special_instructions") or "").strip(),
        }

    return {
        "page_id": str(page_id or "").strip(),
        "page_name": "",
        "organization_slug": "",
        "page_access_token": "",
        "is_active": False,
        "bot_name": "",
        "tone": "",
        "language": "",
        "greeting_message": "",
        "company_description": "",
        "products_summary": "",
        "special_instructions": "",
    }


def extract_page_context(payload: dict[str, Any], messaging: dict[str, Any]) -> dict[str, Any]:
    entry = (payload.get("entry") or [{}])[0] if isinstance(payload, dict) else {}
    page_id = (
        str(messaging.get("recipient", {}).get("id", "")).strip()
        or str(entry.get("id", "")).strip()
        or str(CONFIG.get("meta_page_id") or "").strip()
    )
    return resolve_page_context(page_id)


def utc_now() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def parse_utc(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))


def utc_now_dt() -> dt.datetime:
    return dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)


def archive_bucket_name() -> str:
    return str(CONFIG.get("archive_bucket_name") or "").strip()


def archive_object_name(message_mid: str, received_at: str) -> str:
    safe_mid = re.sub(r"[^A-Za-z0-9._-]", "_", str(message_mid or "event"))
    day = str(received_at or utc_now())[:10]
    return f"events/{day}/{safe_mid}.json"


def daily_stats_object_name(day_key: str) -> str:
    return f"daily-stats/{day_key}.json"


def contact_object_name(psid: str) -> str:
    safe_psid = re.sub(r"[^A-Za-z0-9._-]", "_", str(psid or "contact"))
    return f"contacts/{safe_psid}.json"


async def get_gcp_access_token() -> str:
    cached_token = str(GCP_TOKEN_CACHE.get("access_token") or "")
    expires_at = float(GCP_TOKEN_CACHE.get("expires_at") or 0.0)
    now = time.time()
    if cached_token and expires_at > now + 60:
        return cached_token
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(
            "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
            headers={"Metadata-Flavor": "Google"},
        )
        response.raise_for_status()
        data = response.json()
        token = str(data.get("access_token") or "")
        ttl = int(data.get("expires_in") or 300)
        GCP_TOKEN_CACHE["access_token"] = token
        GCP_TOKEN_CACHE["expires_at"] = now + ttl
        return token


def google_sheet_enabled() -> bool:
    return bool(str(CONFIG.get("google_sheet_id") or "").strip())


def sheet_a1_title(title: str) -> str:
    return "'" + str(title or "").replace("'", "''") + "'"


def sheet_a1_range(title: str, start_cell: str, end_column: str | None = None, row_number: int | None = None) -> str:
    left = f"{sheet_a1_title(title)}!{start_cell}"
    if end_column and row_number:
        return f"{left}:{end_column}{row_number}"
    return left


def quote_sheet_range(value: str) -> str:
    return quote(value, safe="!:$'")


def sheet_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "oui" if value else "non"
    if isinstance(value, float):
        return round(value, 6)
    return value


def to_sheet_row(values: list[Any]) -> list[Any]:
    return [sheet_value(value) for value in values]


async def get_google_sheets_access_token() -> str:
    cached_token = str(GOOGLE_SHEETS_CACHE.get("access_token") or "")
    expires_at = float(GOOGLE_SHEETS_CACHE.get("expires_at") or 0.0)
    now = time.time()
    if cached_token and expires_at > now + 60:
        return cached_token

    service_account_json = str(CONFIG.get("google_service_account_json") or "").strip()
    if service_account_json:
        from google.auth.transport.requests import Request
        from google.oauth2.service_account import Credentials

        creds = Credentials.from_service_account_info(
            json.loads(service_account_json),
            scopes=["https://www.googleapis.com/auth/spreadsheets"],
        )
        creds.refresh(Request())
        token = str(creds.token or "")
        GOOGLE_SHEETS_CACHE["access_token"] = token
        GOOGLE_SHEETS_CACHE["expires_at"] = now + 3300
        return token

    token = await get_gcp_access_token()
    GOOGLE_SHEETS_CACHE["access_token"] = token
    GOOGLE_SHEETS_CACHE["expires_at"] = now + 300
    return token


async def google_sheets_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    token = await get_google_sheets_access_token()
    url = f"https://sheets.googleapis.com/v4/{path.lstrip('/')}"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.request(method.upper(), url, params=params, json=payload, headers=headers)
        response.raise_for_status()
        if not response.content:
            return {}
        return response.json()


def get_cached_sheet_row_map(sheet_name: str) -> dict[str, int] | None:
    entry = (GOOGLE_SHEETS_CACHE.get("row_maps") or {}).get(sheet_name)
    if not entry:
        return None
    if float(entry.get("expires_at") or 0.0) < time.time():
        return None
    return dict(entry.get("rows") or {})


def set_cached_sheet_row_map(sheet_name: str, rows: dict[str, int]) -> None:
    GOOGLE_SHEETS_CACHE.setdefault("row_maps", {})[sheet_name] = {
        "rows": dict(rows),
        "expires_at": time.time() + GOOGLE_SHEETS_ROW_CACHE_TTL_SECONDS,
    }


def invalidate_sheet_row_cache(sheet_name: str) -> None:
    row_maps = GOOGLE_SHEETS_CACHE.get("row_maps") or {}
    row_maps.pop(sheet_name, None)


async def get_sheet_row_map(sheet_name: str) -> dict[str, int]:
    cached = get_cached_sheet_row_map(sheet_name)
    if cached is not None:
        return cached

    sheet_id = str(CONFIG.get("google_sheet_id") or "").strip()
    if not sheet_id:
        return {}
    data = await google_sheets_request(
        "GET",
        f"spreadsheets/{sheet_id}/values/{quote_sheet_range(sheet_a1_range(sheet_name, 'A2:A'))}",
    )
    rows: dict[str, int] = {}
    for index, values in enumerate(data.get("values") or [], start=2):
        key = str((values or [""])[0] or "").strip()
        if key:
            rows[key] = index
    set_cached_sheet_row_map(sheet_name, rows)
    return rows


async def upsert_sheet_row(sheet_name: str, key: str, row_values: list[Any]) -> None:
    sheet_id = str(CONFIG.get("google_sheet_id") or "").strip()
    if not sheet_id or not key:
        return

    row_map = await get_sheet_row_map(sheet_name)
    existing_row = row_map.get(key)
    if existing_row:
        await google_sheets_request(
            "PUT",
            f"spreadsheets/{sheet_id}/values/{quote_sheet_range(sheet_a1_range(sheet_name, f'A{existing_row}', end_column='Z', row_number=existing_row))}",
            params={"valueInputOption": "USER_ENTERED"},
            payload={"values": [to_sheet_row(row_values)]},
        )
        return

    response = await google_sheets_request(
        "POST",
        f"spreadsheets/{sheet_id}/values/{quote_sheet_range(sheet_a1_range(sheet_name, 'A1:Z1'))}:append",
        params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
        payload={"values": [to_sheet_row(row_values)]},
    )
    updated_range = str(((response.get("updates") or {}).get("updatedRange")) or "")
    match = re.search(r"!(?:[A-Z]+)(\d+):", updated_range)
    if match:
        row_map[key] = int(match.group(1))
        set_cached_sheet_row_map(sheet_name, row_map)
    else:
        invalidate_sheet_row_cache(sheet_name)


def get_contact_sheet_snapshot(psid: str) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        contact_row = conn.execute("SELECT * FROM contacts WHERE psid = ?", (psid,)).fetchone()
        latest_event = conn.execute(
            """
            SELECT *
            FROM events
            WHERE psid = ?
            ORDER BY received_at DESC
            LIMIT 1
            """,
            (psid,),
        ).fetchone()
        first_seen = conn.execute("SELECT MIN(received_at) AS value FROM events WHERE psid = ?", (psid,)).fetchone()
        reply_count = conn.execute(
            "SELECT COUNT(*) AS value FROM events WHERE psid = ? AND TRIM(COALESCE(ai_reply, '')) <> ''",
            (psid,),
        ).fetchone()
        event_count = conn.execute("SELECT COUNT(*) AS value FROM events WHERE psid = ?", (psid,)).fetchone()
        return {
            "contact": dict(contact_row) if contact_row else {},
            "latest_event": dict(latest_event) if latest_event else {},
            "first_seen_at": str((first_seen["value"] if first_seen else "") or ""),
            "reply_count": int((reply_count["value"] if reply_count else 0) or 0),
            "event_count": int((event_count["value"] if event_count else 0) or 0),
        }
    finally:
        conn.close()


def get_daily_kpi_snapshot(day_key: str) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        daily_row = conn.execute("SELECT * FROM daily_stats WHERE day_key = ?", (day_key,)).fetchone()
        if not daily_row:
            return {}
        new_contacts = conn.execute(
            "SELECT COUNT(*) AS value FROM events WHERE substr(received_at, 1, 10) = ? GROUP BY psid HAVING MIN(received_at) IS NOT NULL",
            (day_key,),
        ).fetchall()
        active_conversations = conn.execute(
            "SELECT COUNT(DISTINCT psid) AS value FROM events WHERE substr(received_at, 1, 10) = ?",
            (day_key,),
        ).fetchone()
        replies_sent = conn.execute(
            "SELECT COUNT(*) AS value FROM events WHERE substr(received_at, 1, 10) = ? AND TRIM(COALESCE(ai_reply, '')) <> ''",
            (day_key,),
        ).fetchone()
        leads_created = conn.execute(
            """
            SELECT COUNT(DISTINCT psid) AS value
            FROM events
            WHERE substr(received_at, 1, 10) = ?
              AND (intent IN ('pricing', 'appointment', 'order') OR order_signal = 1 OR needs_human = 1)
            """,
            (day_key,),
        ).fetchone()
        appointment_count = conn.execute(
            "SELECT COUNT(*) AS value FROM events WHERE substr(received_at, 1, 10) = ? AND intent = 'appointment'",
            (day_key,),
        ).fetchone()
        return {
            "day_key": day_key,
            "new_contacts": len(new_contacts),
            "active_conversations": int((active_conversations["value"] if active_conversations else 0) or 0),
            "messages_received": int(daily_row["message_count"] or 0),
            "replies_sent": int((replies_sent["value"] if replies_sent else 0) or 0),
            "human_escalations": int(daily_row["needs_human_count"] or 0),
            "leads_created": int((leads_created["value"] if leads_created else 0) or 0),
            "devis_requested": int(daily_row["pricing_count"] or 0),
            "rendez_vous_requested": int((appointment_count["value"] if appointment_count else 0) or 0),
            "order_signals": int(daily_row["order_signal_count"] or 0),
            "tokens_total": int(daily_row["total_tokens"] or 0),
            "cost_total_usd": float(daily_row["total_cost_usd"] or 0.0),
            "avg_latency_ms": int(round(float(daily_row["avg_latency_ms"] or 0.0))),
        }
    finally:
        conn.close()


def build_contact_sheet_row(snapshot: dict[str, Any]) -> list[Any]:
    contact = snapshot.get("contact") or {}
    first_name = str(contact.get("first_name") or "").strip()
    last_name = str(contact.get("last_name") or "").strip()
    display_name = " ".join(x for x in [first_name, last_name] if x).strip() or first_name or "Client"
    current_mode = "humain" if bool(contact.get("human_takeover") or 0) else "agent"
    return [
        str(contact.get("psid") or ""),
        first_name,
        last_name,
        display_name,
        str(contact.get("profile_pic") or ""),
        detect_customer_language(str(contact.get("last_message") or "")),
        "facebook_messenger",
        str(snapshot.get("first_seen_at") or str(contact.get("last_seen_at") or "")),
        str(contact.get("last_seen_at") or ""),
        str(contact.get("lead_status") or ""),
        current_mode,
        "responsable" if current_mode == "humain" else "",
        str(contact.get("tags") or ""),
        "",
        str(contact.get("telegram_last_reason") or ""),
    ]


def build_conversation_sheet_row(snapshot: dict[str, Any]) -> list[Any]:
    contact = snapshot.get("contact") or {}
    event = snapshot.get("latest_event") or {}
    human_takeover = bool(contact.get("human_takeover") or 0)
    priority = "haute" if bool(contact.get("needs_human") or 0) or bool(contact.get("order_signal") or 0) else "normale"
    status = "a reprendre" if human_takeover or bool(contact.get("needs_human") or 0) else "en cours"
    return [
        str(contact.get("psid") or ""),
        str(contact.get("psid") or ""),
        str(snapshot.get("first_seen_at") or str(contact.get("last_seen_at") or "")),
        str(event.get("received_at") or contact.get("last_seen_at") or ""),
        str(event.get("customer_message") or contact.get("last_message") or ""),
        str(event.get("ai_reply") or ""),
        status,
        str(contact.get("lead_status") or ""),
        priority,
        bool(contact.get("needs_human") or 0),
        "humain" if human_takeover else "agent",
        str(contact.get("telegram_last_reason") or ""),
        str(contact.get("telegram_last_notified_at") or ""),
        "responsable" if human_takeover else "",
        str(contact.get("tags") or ""),
    ]


def build_lead_sheet_row(snapshot: dict[str, Any]) -> list[Any]:
    contact = snapshot.get("contact") or {}
    event = snapshot.get("latest_event") or {}
    first_name = str(contact.get("first_name") or "").strip()
    last_name = str(contact.get("last_name") or "").strip()
    customer_name = " ".join(x for x in [first_name, last_name] if x).strip() or first_name or str(event.get("customer_name") or "Client")
    lead_status = str(contact.get("lead_status") or "")
    temperature = "chaud" if bool(contact.get("order_signal") or 0) else "support" if bool(contact.get("needs_human") or 0) else "qualifie"
    next_action = (
        "Contacter le client avec un responsable"
        if bool(contact.get("needs_human") or 0)
        else "Envoyer un devis ou une proposition"
        if str(event.get("intent") or "") in {"pricing", "order"}
        else "Relancer avec une question utile"
    )
    next_due = str(contact.get("telegram_last_notified_at") or event.get("received_at") or "")
    return [
        str(contact.get("psid") or ""),
        str(contact.get("psid") or ""),
        str(snapshot.get("first_seen_at") or event.get("received_at") or ""),
        customer_name,
        str(event.get("customer_message") or contact.get("last_message") or ""),
        lead_status,
        temperature,
        "",
        "",
        "",
        next_action,
        next_due,
        "responsable" if bool(contact.get("needs_human") or 0) or bool(contact.get("human_takeover") or 0) else "",
        str(event.get("received_at") or contact.get("last_seen_at") or ""),
        str(contact.get("tags") or ""),
    ]


def build_quote_sheet_row(snapshot: dict[str, Any]) -> list[Any]:
    contact = snapshot.get("contact") or {}
    event = snapshot.get("latest_event") or {}
    first_name = str(contact.get("first_name") or "").strip()
    last_name = str(contact.get("last_name") or "").strip()
    customer_name = " ".join(x for x in [first_name, last_name] if x).strip() or first_name or str(event.get("customer_name") or "Client")
    created_at = str(event.get("received_at") or contact.get("last_seen_at") or "")
    return [
        f"quote:{contact.get('psid')}",
        str(contact.get("psid") or ""),
        created_at,
        customer_name,
        str(event.get("intent") or contact.get("intent") or ""),
        str(event.get("customer_message") or contact.get("last_message") or ""),
        "a_traiter",
        "haute" if bool(contact.get("needs_human") or 0) or bool(contact.get("order_signal") or 0) else "normale",
        str(contact.get("telegram_last_notified_at") or ""),
        "",
        str(created_at[:10] or ""),
        "",
        "responsable",
        created_at,
        str(contact.get("tags") or ""),
    ]


def build_appointment_sheet_row(snapshot: dict[str, Any]) -> list[Any]:
    contact = snapshot.get("contact") or {}
    event = snapshot.get("latest_event") or {}
    first_name = str(contact.get("first_name") or "").strip()
    last_name = str(contact.get("last_name") or "").strip()
    customer_name = " ".join(x for x in [first_name, last_name] if x).strip() or first_name or str(event.get("customer_name") or "Client")
    created_at = str(event.get("received_at") or contact.get("last_seen_at") or "")
    return [
        f"meeting:{contact.get('psid')}",
        str(contact.get("psid") or ""),
        created_at,
        customer_name,
        str(event.get("customer_message") or contact.get("last_message") or ""),
        "",
        "",
        "a_organiser",
        str(contact.get("telegram_last_notified_at") or ""),
        "",
        "",
        "responsable",
        created_at,
        str(contact.get("tags") or ""),
    ]


def build_message_sheet_row(event_record: dict[str, Any]) -> list[Any]:
    return [
        str(event_record.get("message_mid") or ""),
        str(event_record.get("received_at") or ""),
        str(event_record.get("psid") or ""),
        "client_vers_agent",
        str(event_record.get("customer_name") or ""),
        str(event_record.get("customer_message") or ""),
        str(event_record.get("ai_reply") or ""),
        str(event_record.get("intent") or ""),
        str(event_record.get("lead_status") or ""),
        bool(event_record.get("needs_human") or False),
        bool(event_record.get("order_signal") or False),
        str(event_record.get("llm_provider") or ""),
        str(event_record.get("llm_model") or ""),
        int(event_record.get("prompt_tokens") or 0),
        int(event_record.get("output_tokens") or 0),
        int(event_record.get("total_tokens") or 0),
        float(event_record.get("estimated_cost_usd") or 0.0),
        int(event_record.get("latency_ms") or 0),
        str(event_record.get("tags") or ""),
    ]


def build_kpi_sheet_row(snapshot: dict[str, Any]) -> list[Any]:
    return [
        str(snapshot.get("day_key") or ""),
        int(snapshot.get("new_contacts") or 0),
        int(snapshot.get("active_conversations") or 0),
        int(snapshot.get("messages_received") or 0),
        int(snapshot.get("replies_sent") or 0),
        int(snapshot.get("human_escalations") or 0),
        int(snapshot.get("leads_created") or 0),
        int(snapshot.get("devis_requested") or 0),
        int(snapshot.get("rendez_vous_requested") or 0),
        int(snapshot.get("order_signals") or 0),
        int(snapshot.get("tokens_total") or 0),
        float(snapshot.get("cost_total_usd") or 0.0),
        int(snapshot.get("avg_latency_ms") or 0),
        "",
    ]


async def sync_contact_snapshot_to_google_sheet(psid: str) -> None:
    if not google_sheet_enabled() or not psid:
        return
    snapshot = get_contact_sheet_snapshot(psid)
    contact = snapshot.get("contact") or {}
    if not contact:
        return
    await upsert_sheet_row("contacts", str(contact.get("psid") or ""), build_contact_sheet_row(snapshot))
    await upsert_sheet_row("conversations", str(contact.get("psid") or ""), build_conversation_sheet_row(snapshot))
    await upsert_sheet_row("leads", str(contact.get("psid") or ""), build_lead_sheet_row(snapshot))

    latest_event = snapshot.get("latest_event") or {}
    intent = str(latest_event.get("intent") or contact.get("intent") or "")
    customer_message = str(latest_event.get("customer_message") or contact.get("last_message") or "")
    order_signal = bool(latest_event.get("order_signal") or contact.get("order_signal") or 0)
    needs_human = bool(latest_event.get("needs_human") or contact.get("needs_human") or 0)

    if intent == "pricing" or "devis" in customer_message.lower():
        await upsert_sheet_row("devis", f"quote:{contact.get('psid')}", build_quote_sheet_row(snapshot))
    if intent == "appointment" or any(x in customer_message.lower() for x in ["rdv", "rendez-vous", "meeting", "appel"]):
        await upsert_sheet_row("rendez_vous", f"meeting:{contact.get('psid')}", build_appointment_sheet_row(snapshot))
    if order_signal and needs_human:
        await upsert_sheet_row("devis", f"quote:{contact.get('psid')}", build_quote_sheet_row(snapshot))


async def sync_event_to_google_sheet(event_record: dict[str, Any]) -> None:
    if not google_sheet_enabled():
        return
    await upsert_sheet_row("messages", str(event_record.get("message_mid") or ""), build_message_sheet_row(event_record))
    await sync_contact_snapshot_to_google_sheet(str(event_record.get("psid") or ""))


async def sync_kpi_to_google_sheet(day_key: str) -> None:
    if not google_sheet_enabled() or not day_key:
        return
    snapshot = get_daily_kpi_snapshot(day_key)
    if not snapshot:
        return
    await upsert_sheet_row("kpi_journalier", str(snapshot.get("day_key") or ""), build_kpi_sheet_row(snapshot))


async def safe_sync_google_sheet_for_event(event_record: dict[str, Any], day_key: str) -> None:
    try:
        await sync_event_to_google_sheet(event_record)
        await sync_kpi_to_google_sheet(day_key)
    except Exception:
        return


async def safe_sync_google_sheet_for_contact(psid: str) -> None:
    try:
        await sync_contact_snapshot_to_google_sheet(psid)
    except Exception:
        return


async def archive_event_to_gcs(event_record: dict[str, Any]) -> bool:
    bucket = archive_bucket_name()
    if not bucket:
        return False
    token = await get_gcp_access_token()
    object_name = archive_object_name(str(event_record.get("message_mid") or ""), str(event_record.get("received_at") or utc_now()))
    return await upload_json_to_gcs(bucket, object_name, event_record, token)


async def upload_json_to_gcs(bucket: str, object_name: str, payload: dict[str, Any], token: str | None = None) -> bool:
    token = token or await get_gcp_access_token()
    url = f"https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={quote(object_name, safe='')}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            content=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
        response.raise_for_status()
    return True


async def list_gcs_object_names(prefix: str, since: dt.datetime | None = None) -> list[str]:
    bucket = archive_bucket_name()
    if not bucket:
        return []
    token = await get_gcp_access_token()
    names: list[str] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        page_token = ""
        while True:
            url = f"https://storage.googleapis.com/storage/v1/b/{bucket}/o?prefix={quote(prefix, safe='')}"
            if page_token:
                url += f"&pageToken={quote(page_token, safe='')}"
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            data = response.json()
            for item in data.get("items") or []:
                name = str(item.get("name") or "")
                if not name:
                    continue
                if since is not None and "/" in name:
                    parts = name.split("/")
                    if len(parts) > 1:
                        try:
                            day_value = dt.datetime.fromisoformat(parts[1]).replace(tzinfo=dt.timezone.utc)
                            if day_value.date() < since.date():
                                continue
                        except Exception:
                            pass
                names.append(name)
            page_token = str(data.get("nextPageToken") or "")
            if not page_token:
                break
    return names


async def list_archived_event_names(since: dt.datetime) -> list[str]:
    names: list[str] = []
    current = since.date()
    today = dt.datetime.utcnow().date()
    while current <= today:
        names.extend(await list_gcs_object_names(f"events/{current.isoformat()}/"))
        current += dt.timedelta(days=1)
    return names


async def fetch_archived_event(name: str) -> dict[str, Any] | None:
    bucket = archive_bucket_name()
    if not bucket or not name:
        return None
    token = await get_gcp_access_token()
    url = f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{quote(name, safe='')}?alt=media"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
        return response.json()


def daily_key_from_received_at(received_at: str) -> str:
    return str(received_at or utc_now())[:10]


def upsert_daily_stats(
    day_key: str,
    message_count: int,
    needs_human_count: int,
    order_signal_count: int,
    pricing_count: int,
    prompt_tokens: int,
    output_tokens: int,
    total_tokens: int,
    total_cost_usd: float,
    latency_ms: int,
) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        existing = conn.execute(
            "SELECT message_count, avg_latency_ms FROM daily_stats WHERE day_key = ?",
            (day_key,),
        ).fetchone()
        prev_count = int(existing[0] or 0) if existing else 0
        prev_avg = float(existing[1] or 0.0) if existing else 0.0
        new_count = prev_count + int(message_count or 0)
        new_avg = ((prev_avg * prev_count) + float(latency_ms or 0)) / max(new_count, 1)
        conn.execute(
            """
            INSERT INTO daily_stats (
                day_key, message_count, needs_human_count, order_signal_count, pricing_count,
                prompt_tokens, output_tokens, total_tokens, total_cost_usd, avg_latency_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(day_key) DO UPDATE SET
                message_count = daily_stats.message_count + excluded.message_count,
                needs_human_count = daily_stats.needs_human_count + excluded.needs_human_count,
                order_signal_count = daily_stats.order_signal_count + excluded.order_signal_count,
                pricing_count = daily_stats.pricing_count + excluded.pricing_count,
                prompt_tokens = daily_stats.prompt_tokens + excluded.prompt_tokens,
                output_tokens = daily_stats.output_tokens + excluded.output_tokens,
                total_tokens = daily_stats.total_tokens + excluded.total_tokens,
                total_cost_usd = daily_stats.total_cost_usd + excluded.total_cost_usd,
                avg_latency_ms = excluded.avg_latency_ms
            """,
            (
                day_key,
                int(message_count or 0),
                int(needs_human_count or 0),
                int(order_signal_count or 0),
                int(pricing_count or 0),
                int(prompt_tokens or 0),
                int(output_tokens or 0),
                int(total_tokens or 0),
                float(total_cost_usd or 0.0),
                float(new_avg),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_daily_stats_record(day_key: str) -> dict[str, Any] | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM daily_stats WHERE day_key = ?", (day_key,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


async def archive_daily_stats_to_gcs(day_key: str) -> bool:
    bucket = archive_bucket_name()
    row = get_daily_stats_record(day_key)
    if not bucket or not row:
        return False
    token = await get_gcp_access_token()
    return await upload_json_to_gcs(bucket, daily_stats_object_name(day_key), row, token)


def get_contact_record(psid: str) -> dict[str, Any] | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM contacts WHERE psid = ?", (psid,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


async def archive_contact_to_gcs(psid: str) -> bool:
    bucket = archive_bucket_name()
    row = get_contact_record(psid)
    if not bucket or not row:
        return False
    token = await get_gcp_access_token()
    return await upload_json_to_gcs(bucket, contact_object_name(psid), row, token)


async def rehydrate_contacts() -> int:
    if not archive_bucket_name():
        return 0
    loaded = 0
    try:
        names = await list_gcs_object_names("contacts/")
        for name in names:
            row = await fetch_archived_event(name)
            if not row:
                continue
            conn = sqlite3.connect(DB_PATH)
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO contacts (
                        psid, first_name, last_name, contact_name, phone_number, email, profile_pic, last_message, intent, lead_status,
                        needs_human, order_signal, human_takeover, telegram_last_reason,
                        telegram_last_notified_at, tags, last_seen_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(row.get("psid") or ""),
                        str(row.get("first_name") or ""),
                        str(row.get("last_name") or ""),
                        str(row.get("contact_name") or ""),
                        str(row.get("phone_number") or ""),
                        str(row.get("email") or ""),
                        str(row.get("profile_pic") or ""),
                        str(row.get("last_message") or ""),
                        str(row.get("intent") or ""),
                        str(row.get("lead_status") or ""),
                        int(row.get("needs_human") or 0),
                        int(row.get("order_signal") or 0),
                        int(row.get("human_takeover") or 0),
                        str(row.get("telegram_last_reason") or ""),
                        str(row.get("telegram_last_notified_at") or ""),
                        str(row.get("tags") or ""),
                        str(row.get("last_seen_at") or ""),
                    ),
                )
                conn.commit()
                loaded += 1
            finally:
                conn.close()
    except Exception:
        return loaded
    return loaded


async def rehydrate_daily_stats() -> int:
    if not archive_bucket_name():
        return 0
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("DELETE FROM daily_stats")
        conn.commit()
    finally:
        conn.close()
    loaded = 0
    try:
        names = await list_gcs_object_names("daily-stats/")
        for name in names:
            row = await fetch_archived_event(name)
            if not row:
                continue
            conn = sqlite3.connect(DB_PATH)
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO daily_stats (
                        day_key, message_count, needs_human_count, order_signal_count, pricing_count,
                        prompt_tokens, output_tokens, total_tokens, total_cost_usd, avg_latency_ms
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(row.get("day_key") or ""),
                        int(row.get("message_count") or 0),
                        int(row.get("needs_human_count") or 0),
                        int(row.get("order_signal_count") or 0),
                        int(row.get("pricing_count") or 0),
                        int(row.get("prompt_tokens") or 0),
                        int(row.get("output_tokens") or 0),
                        int(row.get("total_tokens") or 0),
                        float(row.get("total_cost_usd") or 0.0),
                        float(row.get("avg_latency_ms") or 0.0),
                    ),
                )
                conn.commit()
                loaded += 1
            finally:
                conn.close()
    except Exception:
        return loaded
    return loaded


async def rehydrate_recent_events(hours: int = 24, rebuild_daily_totals: bool = False) -> None:
    if not archive_bucket_name():
        return
    since = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc) - dt.timedelta(hours=hours)
    try:
        names = await list_archived_event_names(since)
        for name in names:
            event_record = await fetch_archived_event(name)
            if not event_record:
                continue
            received_at = str(event_record.get("received_at") or "")
            if not received_at:
                continue
            if parse_utc(received_at) < since:
                continue
            save_event(
                str(event_record.get("message_mid") or ""),
                received_at,
                str(event_record.get("psid") or ""),
                str(event_record.get("customer_name") or ""),
                str(event_record.get("customer_message") or ""),
                str(event_record.get("ai_reply") or ""),
                str(event_record.get("intent") or ""),
                str(event_record.get("lead_status") or ""),
                bool(event_record.get("needs_human") or False),
                bool(event_record.get("order_signal") or False),
                str(event_record.get("tags") or ""),
                str(event_record.get("llm_provider") or ""),
                str(event_record.get("llm_model") or ""),
                int(event_record.get("prompt_tokens") or 0),
                int(event_record.get("output_tokens") or 0),
                int(event_record.get("total_tokens") or 0),
                float(event_record.get("estimated_cost_usd") or 0.0),
                int(event_record.get("latency_ms") or 0),
                event_record.get("raw_payload") or {},
                {
                    "page_id": str(event_record.get("page_id") or ""),
                    "page_name": str(event_record.get("page_name") or ""),
                    "organization_slug": str(event_record.get("organization_slug") or ""),
                },
            )
            save_contact(
                str(event_record.get("psid") or ""),
                {
                    "first_name": str(event_record.get("customer_name") or "Client"),
                    "last_name": "",
                    "profile_pic": "",
                },
                str(event_record.get("customer_message") or ""),
                str(event_record.get("intent") or ""),
                str(event_record.get("lead_status") or ""),
                bool(event_record.get("needs_human") or False),
                bool(event_record.get("order_signal") or False),
                str(event_record.get("tags") or ""),
                {
                    "page_id": str(event_record.get("page_id") or ""),
                    "page_name": str(event_record.get("page_name") or ""),
                    "organization_slug": str(event_record.get("organization_slug") or ""),
                },
            )
            if rebuild_daily_totals:
                upsert_daily_stats(
                    daily_key_from_received_at(received_at),
                    1,
                    1 if bool(event_record.get("needs_human") or False) else 0,
                    1 if bool(event_record.get("order_signal") or False) else 0,
                    1 if str(event_record.get("intent") or "") == "pricing" else 0,
                    int(event_record.get("prompt_tokens") or 0),
                    int(event_record.get("output_tokens") or 0),
                    int(event_record.get("total_tokens") or 0),
                    float(event_record.get("estimated_cost_usd") or 0.0),
                    int(event_record.get("latency_ms") or 0),
                )
    except Exception:
        return


def estimate_cost_usd(model: str, prompt_tokens: int, output_tokens: int) -> float:
    pricing = MODEL_PRICING_PER_MILLION.get(model, MODEL_PRICING_PER_MILLION["gemini-2.5-flash-lite"])
    input_cost = (max(prompt_tokens, 0) / 1_000_000) * pricing["input"]
    output_cost = (max(output_tokens, 0) / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


def format_int(value: Any) -> str:
    try:
        return f"{int(value or 0):,}".replace(",", " ")
    except Exception:
        return "0"


def format_money(value: Any) -> str:
    amount = float(value or 0.0)
    return f"${amount:,.4f}" if amount < 1 else f"${amount:,.2f}"


def format_ms(value: Any) -> str:
    try:
        return f"{int(round(float(value or 0)))} ms"
    except Exception:
        return "0 ms"


def badge_class(row: sqlite3.Row) -> str:
    if int(row["needs_human"] or 0):
        return "danger"
    if int(row["order_signal"] or 0):
        return "success"
    if str(row["intent"] or "") == "pricing":
        return "warn"
    return "neutral"


def keyword_score(text: str, keywords: list[str]) -> int:
    normalized = normalize_match_text(text)
    total = 0
    for keyword in keywords:
        token = normalize_match_text(keyword)
        if not token:
            continue
        if " " in token or "'" in token:
            total += 1 if token in normalized else 0
        else:
            total += 1 if re.search(rf"\b{re.escape(token)}\b", normalized) else 0
    return total


def normalize_match_text(text: str) -> str:
    normalized = (text or "").lower().replace("’", "'").replace("-", " ")
    normalized = re.sub(r"[^\w\s']", " ", normalized, flags=re.UNICODE)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def detect_service_route(message: str) -> str:
    lower = (message or "").lower()
    service_keywords = {
        "spot_publicitaire": [
            "spot",
            "spots",
            "spot pub",
            "spots pub",
            "pub",
            "publicitaire",
            "publicitaires",
            "advertising",
            "advert",
            "commercial",
            "spot publicitaire",
            "spots publicitaires",
            "campaign video",
            "dokambarotra",
            "dokam barotra",
            "doka",
        ],
        "video_documentaire": [
            "documentaire",
            "documentaires",
            "film documentaire",
            "films documentaires",
            "video documentaire",
            "videos documentaires",
            "documentary",
            "docu",
            "corporate film",
            "film institutionnel",
            "films institutionnels",
            "fanadihadiana",
            "film fanadihadiana",
        ],
        "livestreaming": [
            "livestream",
            "live stream",
            "livestream multicamera",
            "livestream multicam",
            "streaming",
            "multicam",
            "multicamera",
            "multi-camera",
            "multi camera",
            "regie",
            "regie multicamera",
            "en direct",
            "direct",
            "live",
            "mivantana",
        ],
    }
    best_route = ""
    best_score = 0
    for route, keywords in service_keywords.items():
        score = keyword_score(lower, keywords)
        if score >= best_score and score > 0:
            best_route = route
            best_score = score
    return best_route if best_score > 0 else ""


SERVICE_ROUTE_KEYS = {
    "spot_publicitaire",
    "video_documentaire",
    "livestreaming",
}


def infer_labels(message: str) -> tuple[str, str, bool, bool, str]:
    lower = (message or "").lower()
    service_route = detect_service_route(message)
    selected_offer = detect_service_choice_offer(message)
    greeting_keywords = ["bonjour", "salut", "hello", "bonsoir", "salama", "hey", "hi"]
    pricing_keywords = ["prix", "tarif", "devis", "combien", "quote", "budget", "vidiny"]
    catalogue_keywords = ["catalogue", "catalog", "brochure", "grille"]
    portfolio_keywords = [
        "portfolio",
        "realisations",
        "realisation",
        "exemples",
        "samples",
        "works",
        "show me",
        "example",
        "examples",
        "montre",
        "montrez",
        "voir des exemples",
        "asehoy",
        "asehoy ahy",
        "alefaso",
        "alefaso ohatra",
        "ohatra",
        "santionany",
    ]
    reservation_keywords = ["reserver", "reservation", "book", "booking", "dispo", "availability", "bloquer"]
    order_keywords = ["commande", "commander", "acheter", "payer", "valider", "confirm", "go ahead"]
    appointment_keywords = ["rdv", "rendez-vous", "appel", "meeting", "call", "appointment"]
    human_keywords = [
        "humain",
        "responsable",
        "manager",
        "agent",
        "conseiller",
        "equipe",
        "team",
        "advisor",
        "quelqu'un",
        "someone",
        "urgent",
        "plainte",
        "remboursement",
        "litige",
        "personne",
        "olona",
        "tompon'andraikitra",
    ]
    buying_keywords = [
        "je veux",
        "j'ai besoin",
        "besoin de",
        "mila",
        "te hividy",
        "need",
        "i want",
        "we need",
        "looking for",
    ]

    needs_human = keyword_score(lower, human_keywords) >= 1
    buying_signal = keyword_score(lower, buying_keywords) >= 1

    if needs_human:
        intent = "human"
    elif keyword_score(lower, appointment_keywords) >= 1:
        intent = "appointment"
    elif keyword_score(lower, reservation_keywords) >= 1:
        intent = "reservation"
    elif keyword_score(lower, pricing_keywords) >= 1:
        intent = "pricing"
    elif keyword_score(lower, catalogue_keywords) >= 1:
        intent = "pricing" if service_route else "catalogue"
    elif keyword_score(lower, portfolio_keywords) >= 1:
        intent = "portfolio"
    elif selected_offer and wants_offer_details(message):
        intent = "offer_details"
    elif selected_offer:
        intent = "offer_choice"
    elif keyword_score(lower, order_keywords) >= 1:
        intent = "order"
    elif service_route:
        intent = "service"
    elif keyword_score(lower, greeting_keywords) >= 1 and len(re.findall(r"\w+", lower)) <= 6:
        intent = "greeting"
    else:
        intent = "general"

    order_signal = intent in {"pricing", "reservation", "order", "appointment", "offer_choice"} or (
        intent == "service" and buying_signal
    )
    if needs_human or intent == "human":
        lead_status = "support"
    elif intent in {"order", "reservation", "offer_choice"} or (intent == "service" and buying_signal):
        lead_status = "hot"
    elif intent == "greeting":
        lead_status = "new"
    elif intent == "portfolio":
        lead_status = "nurture"
    else:
        lead_status = "qualified"

    tags_parts: list[str] = []
    offer_tag = str(selected_offer.get("id") or "") if isinstance(selected_offer, dict) else ""
    for value in [intent, lead_status, service_route, offer_tag, "human" if needs_human else "", "order" if order_signal else ""]:
        if value and value not in tags_parts:
            tags_parts.append(value)
    tags = ", ".join(tags_parts)
    return intent, lead_status, needs_human, order_signal, tags


def get_contact_state(psid: str) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM contacts WHERE psid = ?", (psid,)).fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def get_recent_exchange_context(psid: str, limit: int = 4) -> str:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT customer_message, ai_reply
            FROM events
            WHERE psid = ?
            ORDER BY received_at DESC
            LIMIT ?
            """,
            (psid, max(limit, 1)),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return ""

    rendered: list[str] = []
    for row in reversed(rows):
        customer_message = re.sub(r"\s+", " ", str(row["customer_message"] or "").strip())
        ai_reply = re.sub(r"\s+", " ", str(row["ai_reply"] or "").strip())
        if customer_message:
            rendered.append(f"Client: {customer_message[:220]}")
        if ai_reply:
            rendered.append(f"Agent: {ai_reply[:220]}")
    return "\n".join(rendered[-8:])


def load_catalog_manifest() -> dict[str, Any]:
    if not CATALOG_MANIFEST_PATH.exists():
        return {"global_assets": {}, "services": {}}
    try:
        data = json.loads(CATALOG_MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"global_assets": {}, "services": {}}
    if not isinstance(data, dict):
        return {"global_assets": {}, "services": {}}
    global_assets = data.get("global_assets")
    if not isinstance(global_assets, dict):
        data["global_assets"] = {}
    services = data.get("services")
    if not isinstance(services, dict):
        data["services"] = {}
    return data


def get_recent_service_route(psid: str, limit: int = 4) -> str:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT tags, customer_message
            FROM events
            WHERE psid = ?
            ORDER BY received_at DESC
            LIMIT ?
            """,
            (psid, max(limit, 1)),
        ).fetchall()
    finally:
        conn.close()

    for row in rows:
        tags = str(row["tags"] or "")
        for route in SERVICE_ROUTE_KEYS:
            if route in tags:
                return route
        route = detect_service_route(str(row["customer_message"] or ""))
        if route:
            return route
    return ""


def get_recent_offer_choice(psid: str, limit: int = 6) -> dict[str, Any] | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT tags, customer_message
            FROM events
            WHERE psid = ?
            ORDER BY received_at DESC
            LIMIT ?
            """,
            (psid, max(limit, 1)),
        ).fetchall()
    finally:
        conn.close()

    manifest = load_catalog_manifest()
    global_assets = manifest.get("global_assets") if isinstance(manifest, dict) else {}
    offers = [item for item in global_assets.get("service_choice_catalog", []) if isinstance(item, dict)] if isinstance(global_assets, dict) else []
    if not offers:
        return None
    offers_by_id = {str(item.get("id") or ""): dict(item) for item in offers if str(item.get("id") or "").strip()}

    for row in rows:
        tags = str(row["tags"] or "")
        for offer_id, offer in offers_by_id.items():
            if offer_id and offer_id in tags:
                return offer
        offer = detect_service_choice_offer(str(row["customer_message"] or ""))
        if offer:
            return offer
    return None


def build_catalog_asset_url(relative_path: str) -> str:
    service_public_url = str(CONFIG.get("service_public_url") or "").strip().rstrip("/")
    rel = str(relative_path or "").replace("\\", "/").strip().lstrip("/")
    if not service_public_url or not rel:
        return ""
    return f"{service_public_url}/catalog-media/{quote(rel, safe='/')}"


def extract_google_drive_file_id(url: str) -> str:
    raw_url = str(url or "").strip()
    if not raw_url:
        return ""
    parsed = urlparse(raw_url)
    if "drive.google.com" not in parsed.netloc and "docs.google.com" not in parsed.netloc:
        return ""
    query_id = parse_qs(parsed.query).get("id", [""])[0].strip()
    if query_id:
        return query_id
    match = re.search(r"/d/([A-Za-z0-9_-]+)", parsed.path)
    if match:
        return str(match.group(1) or "").strip()
    return ""


def build_external_media_url(asset: dict[str, Any], attachment_type: str) -> str:
    direct_url = str(asset.get("external_url") or asset.get("url") or "").strip()
    if direct_url:
        return direct_url

    drive_url = str(asset.get("drive_url") or asset.get("google_drive_url") or "").strip()
    drive_file_id = str(asset.get("drive_file_id") or "").strip() or extract_google_drive_file_id(drive_url)
    if not drive_file_id:
        return ""

    if attachment_type == "video":
        return f"https://drive.usercontent.google.com/download?id={drive_file_id}&export=download&confirm=t"
    return f"https://drive.usercontent.google.com/download?id={drive_file_id}&export=download"


def wants_service_choice_asset(message: str) -> bool:
    keywords = [
        "services",
        "vos services",
        "nos services",
        "quels services",
        "que faites vous",
        "que fais tu",
        "prestation",
        "prestations",
        "offre",
        "offres",
        "catalogue",
        "catalog",
        "que faites-vous",
        "que proposez-vous",
        "what do you do",
        "what services",
        "inona avy",
        "inona avy ny atao",
        "inona ny atao",
        "inona ny atao nareo",
        "inona no atao nareo",
        "inona avy ny tolotra",
        "tolotra",
    ]
    return keyword_score(message, keywords) >= 1


def wants_company_explanation(message: str) -> bool:
    keywords = [
        "que faites-vous",
        "que faites vous",
        "que fait",
        "que fais tu",
        "que proposez-vous",
        "que proposez vous",
        "qui est ram's flare",
        "c'est quoi ram's flare",
        "what do you do",
        "what is ram's flare",
        "who are you",
        "inona no ataonareo",
        "inona ny atao nareo",
        "inona no atao nareo",
        "inona no ataon'i ram's flare",
        "inona avy ny atao",
        "inona avy ny atao ny ram's flare",
        "inona ny atao ny ram's flare",
        "iza i ram's flare",
        "tolotrareo",
    ]
    return keyword_score(message, keywords) >= 1


def service_route_to_query_label(service_route: str) -> str:
    labels = {
        "spot_publicitaire": "spot publicitaire",
        "video_documentaire": "film documentaire",
        "livestreaming": "livestream multicamera",
    }
    return labels.get(str(service_route or "").strip(), str(service_route or "").replace("_", " ").strip())


def extract_spot_focus_answer(message: str) -> str:
    normalized = normalize_match_text(message)
    if keyword_score(normalized, ["produit", "product", "vokatra"]) >= 1:
        return "produit"
    if keyword_score(normalized, ["campagne", "campaign", "fanentanana"]) >= 1:
        return "campagne"
    if keyword_score(normalized, ["service", "services", "serivisy"]) >= 1:
        return "service"
    return ""


def extract_client_profile_answer(message: str) -> str:
    normalized = normalize_match_text(message)
    if keyword_score(normalized, ["ong", "ngo"]) >= 1:
        return "ong"
    if keyword_score(normalized, ["entreprise", "business", "company", "societe", "organisation", "orinasa"]) >= 1:
        return "entreprise"
    if keyword_score(normalized, ["personnel", "personnelle", "particulier", "personal", "manokana", "olona", "olon tsotra", "olontsotra"]) >= 1:
        return "projet_personnel"
    return ""


def wants_offer_details(message: str) -> bool:
    normalized = normalize_match_text(message)
    detail_keywords = [
        "detail",
        "details",
        "detaille",
        "plus d info",
        "plus d informations",
        "expliquer",
        "explique",
        "contenu",
        "inclus",
        "compris",
        "ao anatiny",
        "inona no ao anatiny",
        "inona ny ao anatiny",
        "inona no ao",
        "ao amin ilay offre",
        "ao anatin ilay offre",
    ]
    return keyword_score(normalized, detail_keywords) >= 1


def extract_phone_number(message: str) -> str:
    raw = str(message or "").strip()
    if not raw:
        return ""
    patterns = re.findall(r"(\+?\d[\d\s().-]{6,}\d)", raw)
    for candidate in patterns:
        cleaned = re.sub(r"[^\d+]", "", candidate)
        digits = re.sub(r"\D", "", cleaned)
        if len(digits) >= 7:
            return cleaned
    return ""


def extract_email_address(message: str) -> str:
    raw = str(message or "").strip()
    match = re.search(r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", raw, flags=re.IGNORECASE)
    return str(match.group(1) or "").strip() if match else ""


def extract_contact_name(message: str, profile: dict[str, Any] | None = None) -> str:
    raw = str(message or "").strip()
    if "," in raw:
        tail = raw.split(",")[-1].strip()
        if tail and not extract_phone_number(tail) and len(tail) <= 80:
            return tail
    if " - " in raw:
        tail = raw.split(" - ")[-1].strip()
        if tail and not extract_phone_number(tail) and len(tail) <= 80:
            return tail
    first_name = str((profile or {}).get("first_name") or "").strip()
    last_name = str((profile or {}).get("last_name") or "").strip()
    return " ".join(part for part in [first_name, last_name] if part).strip()


def has_contact_details(message: str) -> bool:
    raw = str(message or "").strip()
    normalized = normalize_match_text(raw)
    if extract_phone_number(raw) or extract_email_address(raw):
        return True
    direct_markers = [
        "whatsapp",
        "whats app",
        "telephone",
        "phone",
        "mail",
        "email",
        "mailaka",
        "finday",
        "telefaonina",
    ]
    possessive_markers = [
        "mon numero",
        "mon numero de telephone",
        "mon telephone",
        "my phone number",
        "my number",
        "my contact",
        "laharako",
        "nomeraoko",
        "nomeraon telefaoniko",
        "nomeraon findaiko",
    ]
    return keyword_score(normalized, direct_markers + possessive_markers) >= 1


def build_effective_contact_state(
    contact_state: dict[str, Any] | None,
    profile: dict[str, Any] | None,
    customer_message: str,
    psid: str = "",
) -> dict[str, Any]:
    state = dict(contact_state or {})
    profile = profile or {}
    if psid and not str(state.get("psid") or "").strip():
        state["psid"] = psid

    first_name = str(state.get("first_name") or profile.get("first_name") or "").strip()
    last_name = str(state.get("last_name") or profile.get("last_name") or "").strip()
    if first_name:
        state["first_name"] = first_name
    if last_name:
        state["last_name"] = last_name

    parsed_name = extract_contact_name(customer_message, profile)
    parsed_phone = extract_phone_number(customer_message)
    parsed_email = extract_email_address(customer_message)
    existing_name = str(state.get("contact_name") or "").strip()
    fallback_name = " ".join(part for part in [first_name, last_name] if part).strip()

    if parsed_name:
        state["contact_name"] = parsed_name
    elif existing_name:
        state["contact_name"] = existing_name
    elif fallback_name:
        state["contact_name"] = fallback_name

    if parsed_phone:
        state["phone_number"] = parsed_phone
    if parsed_email:
        state["email"] = parsed_email

    return state


def classify_pending_question(ai_reply: str) -> str:
    normalized = normalize_match_text(ai_reply)
    if not normalized:
        return ""
    if keyword_score(normalized, ["c est bien cette offre que vous voulez", "io tokoa ve ilay offre tianao", "is that the exact offer you want"]) >= 1:
        return "offer_confirmation"
    if keyword_score(normalized, ["laissez votre nom et votre numero de telephone", "leave your name and phone number", "anaranao sy ny nomeraon telefaonina", "anaranao sy ny laharana finday", "anaranao sy ny laharana telefaonina"]) >= 1:
        return "contact_capture"
    if keyword_score(normalized, ["type de projet", "what type of project"]) >= 1 and keyword_score(normalized, ["spot pub", "film documentaire", "livestream"]) >= 1:
        return "project_type"
    if keyword_score(normalized, ["produit, un service ou une campagne", "product, a service or a campaign", "produit service sa campagne"]) >= 1:
        return "spot_target"
    if keyword_score(normalized, ["entreprise, une ong ou un projet personnel", "business, an ngo or a personal project", "orinasa, ong sa projet personnel"]) >= 1:
        return "doc_client_type"
    if keyword_score(normalized, ["entreprise ou un projet personnel", "entreprise ou pour un projet personnel", "entreprise ou un besoin personnel", "business or a personal project", "business or a personal need", "orinasa sa filana manokana"]) >= 1:
        return "client_type"
    if keyword_score(normalized, ["c est pour quand", "quelle date", "what date", "daty"]) >= 1:
        return "date"
    return ""


def get_recent_dialog_state(psid: str, limit: int = 6) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT customer_message, ai_reply, tags, intent, received_at
            FROM events
            WHERE psid = ?
            ORDER BY received_at DESC
            LIMIT ?
            """,
            (psid, max(limit, 1)),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return {
            "pending_question": "",
            "recent_service_route": "",
            "recent_offer": None,
            "last_ai_reply": "",
            "last_intent": "",
            "last_customer_message": "",
        }

    last_row = rows[0]
    return {
        "pending_question": classify_pending_question(str(last_row["ai_reply"] or "")),
        "recent_service_route": get_recent_service_route(psid),
        "recent_offer": get_recent_offer_choice(psid),
        "last_ai_reply": str(last_row["ai_reply"] or ""),
        "last_intent": str(last_row["intent"] or ""),
        "last_customer_message": str(last_row["customer_message"] or ""),
    }


def contextualize_customer_message(psid: str, customer_message: str, dialog_state: dict[str, Any] | None = None) -> str:
    raw_message = re.sub(r"\s+", " ", str(customer_message or "").strip())
    if not raw_message:
        return ""

    state = dialog_state or get_recent_dialog_state(psid)
    pending_question = str(state.get("pending_question") or "").strip()
    recent_service_route = str(state.get("recent_service_route") or "").strip()
    recent_offer = state.get("recent_offer") if isinstance(state, dict) else None
    confirmation_only = keyword_score(raw_message, ["oui", "ok", "okay", "je confirme", "confirm", "c'est ca", "c est ca", "marina", "eny", "ie"])
    selected_offer = detect_service_choice_offer(raw_message)
    explicit_service_route = detect_service_route(raw_message)
    spot_focus = extract_spot_focus_answer(raw_message)
    client_profile = extract_client_profile_answer(raw_message)
    contact_details = has_contact_details(raw_message)

    if recent_offer and confirmation_only >= 1 and not selected_offer:
        return f"je confirme {str(recent_offer.get('label') or 'cette offre')}"

    if recent_offer and contact_details and not selected_offer:
        return f"je confirme {str(recent_offer.get('label') or 'cette offre')} et voici mon contact {raw_message}"

    if recent_service_route and contact_details and not selected_offer and not explicit_service_route:
        return f"je veux avancer pour {service_route_to_query_label(recent_service_route)} et voici mon contact {raw_message}"

    if pending_question == "contact_capture" and contact_details:
        if recent_offer:
            return f"je confirme {str(recent_offer.get('label') or 'cette offre')} et voici mon contact {raw_message}"
        if recent_service_route:
            return f"je veux avancer pour {service_route_to_query_label(recent_service_route)} et voici mon contact {raw_message}"

    if pending_question == "project_type" and explicit_service_route:
        return f"je veux un devis pour {service_route_to_query_label(explicit_service_route)}"

    if pending_question == "spot_target" and recent_service_route == "spot_publicitaire" and spot_focus:
        return f"je veux un devis pour spot publicitaire pour un {spot_focus}"

    if recent_service_route and client_profile and not explicit_service_route:
        if client_profile == "entreprise":
            return f"je veux un devis pour {service_route_to_query_label(recent_service_route)} pour une entreprise"
        if client_profile == "ong":
            return f"je veux un devis pour {service_route_to_query_label(recent_service_route)} pour une ONG"
        if client_profile == "projet_personnel":
            return f"je veux un devis pour {service_route_to_query_label(recent_service_route)} pour un projet personnel"

    if pending_question in {"client_type", "doc_client_type"} and recent_service_route and client_profile:
        if client_profile == "entreprise":
            return f"je veux un devis pour {service_route_to_query_label(recent_service_route)} pour une entreprise"
        if client_profile == "ong":
            return f"je veux un devis pour {service_route_to_query_label(recent_service_route)} pour une ONG"
        if client_profile == "projet_personnel":
            return f"je veux un devis pour {service_route_to_query_label(recent_service_route)} pour un projet personnel"

    return raw_message


def score_asset_relevance(asset: dict[str, Any], customer_message: str) -> int:
    score = 0
    trigger_keywords = [str(item) for item in asset.get("trigger_keywords", []) if str(item or "").strip()]
    score += keyword_score(customer_message, trigger_keywords) * 4

    searchable = " ".join(
        [
            str(asset.get("label") or ""),
            str(asset.get("description") or ""),
            " ".join(trigger_keywords),
        ]
    ).lower()
    message_tokens = {token for token in re.findall(r"[a-z0-9']+", (customer_message or "").lower()) if len(token) >= 4}
    for token in message_tokens:
        if token in searchable:
            score += 1
    return score


def detect_service_choice_offer(customer_message: str) -> dict[str, Any] | None:
    manifest = load_catalog_manifest()
    global_assets = manifest.get("global_assets") if isinstance(manifest, dict) else {}
    if not isinstance(global_assets, dict):
        return None
    offers = [item for item in global_assets.get("service_choice_catalog", []) if isinstance(item, dict)]
    if not offers:
        return None
    normalized_message = normalize_match_text(customer_message)
    best_match: tuple[int, int, dict[str, Any]] | None = None
    for index, asset in enumerate(offers):
        trigger_keywords = [normalize_match_text(item) for item in asset.get("trigger_keywords", []) if normalize_match_text(item)]
        if not trigger_keywords:
            continue
        score = keyword_score(normalized_message, trigger_keywords)
        if score <= 0:
            continue
        candidate = (score, -index, dict(asset))
        if best_match is None or candidate > best_match:
            best_match = candidate
    return best_match[2] if best_match else None


def normalize_catalog_asset(
    asset: dict[str, Any],
    service_route: str,
    service_label: str,
    service_description: str,
) -> dict[str, Any] | None:
    asset = dict(asset)

    attachment_type = str(asset.get("attachment_type") or "").strip().lower()
    relative_file = str(asset.get("file") or "").replace("\\", "/").strip().lstrip("/")
    local_file_path = ""
    suffix = ""
    if relative_file:
        local_file = (CATALOG_MEDIA_DIR / relative_file).resolve()
        try:
            local_file.relative_to(CATALOG_MEDIA_DIR.resolve())
        except Exception:
            return None
        if local_file.exists() and local_file.is_file():
            local_file_path = str(local_file)
            suffix = local_file.suffix.lower()

    if attachment_type not in {"image", "video"}:
        if not suffix:
            external_candidate = str(asset.get("external_url") or asset.get("url") or asset.get("drive_url") or asset.get("google_drive_url") or "").strip()
            suffix = Path(urlparse(external_candidate).path).suffix.lower()
        attachment_type = "video" if suffix in {".mp4", ".mov", ".m4v", ".webm"} else "image"

    public_url = build_external_media_url(asset, attachment_type)
    if not public_url and local_file_path:
        public_url = build_catalog_asset_url(relative_file)
    if not public_url:
        return None

    return {
        "service_route": service_route,
        "service_label": service_label,
        "service_description": service_description,
        "asset_id": str(asset.get("id") or relative_file),
        "attachment_type": attachment_type,
        "url": public_url,
        "source_url": str(asset.get("drive_url") or asset.get("google_drive_url") or asset.get("external_url") or public_url),
        "local_path": local_file_path,
        "label": str(asset.get("label") or ""),
        "description": str(asset.get("description") or ""),
        "trigger_keywords": [str(item) for item in asset.get("trigger_keywords", []) if str(item or "").strip()],
    }


def pick_catalog_assets(
    intent: str,
    customer_message: str,
    psid: str,
    raw_customer_message: str = "",
) -> list[dict[str, Any]]:
    manifest = load_catalog_manifest()
    global_assets = manifest.get("global_assets") if isinstance(manifest, dict) else {}
    services = manifest.get("services") if isinstance(manifest, dict) else {}
    if not isinstance(global_assets, dict):
        global_assets = {}
    if not isinstance(services, dict):
        return []

    raw_message = str(raw_customer_message or customer_message or "").strip()
    selected_offer = detect_service_choice_offer(customer_message)
    explicit_service_route = detect_service_route(customer_message)
    recent_service_route = get_recent_service_route(psid)
    pricing_trigger_message = raw_message or customer_message
    explicit_pricing_request = keyword_score(
        pricing_trigger_message,
        ["prix", "tarif", "devis", "combien", "quote", "budget", "vidiny"],
    ) >= 1
    explicit_gallery_request = (
        intent == "catalogue"
        or wants_company_explanation(raw_message or customer_message)
        or wants_service_choice_asset(raw_message or customer_message)
    )
    service_route = explicit_service_route
    asset_pool: list[dict[str, Any]] = []
    service_label = ""
    service_description = ""
    send_all = False

    if selected_offer:
        return []

    if explicit_gallery_request and not explicit_service_route:
        service_route = "service_choice"
        service_label = "Choix d'offres"
        service_description = "Galerie complete des offres a montrer d'abord au prospect pour qu'il choisisse une offre precise."
        asset_pool = [item for item in global_assets.get("service_choice_catalog", []) if isinstance(item, dict)]
        send_all = True
    elif explicit_service_route or recent_service_route:
        service_route = explicit_service_route or recent_service_route
        entry = services.get(service_route)
        if not isinstance(entry, dict):
            return []
        service_label = str(entry.get("service_label") or service_route)
        service_description = str(entry.get("service_description") or "")
        if intent == "pricing" and explicit_pricing_request:
            asset_pool = [item for item in entry.get("catalog_images", []) if isinstance(item, dict)]
        elif intent == "portfolio":
            asset_pool = [item for item in entry.get("portfolio_videos", []) if isinstance(item, dict)]
            if not asset_pool:
                asset_pool = [item for item in entry.get("portfolio_images", []) if isinstance(item, dict)]
            if not asset_pool:
                asset_pool = [item for item in entry.get("catalog_images", []) if isinstance(item, dict)]
    else:
        return []

    if not asset_pool:
        return []

    if send_all:
        normalized_assets = [
            normalize_catalog_asset(asset, service_route, service_label, service_description)
            for asset in asset_pool
        ]
        return [asset for asset in normalized_assets if asset]

    scored_assets = [
        (score_asset_relevance(item, customer_message), -index, item)
        for index, item in enumerate(asset_pool)
    ]
    _, _, asset = max(scored_assets, key=lambda item: (item[0], item[1]))
    normalized = normalize_catalog_asset(asset, service_route, service_label, service_description)
    return [normalized] if normalized else []


def pick_catalog_asset(
    intent: str,
    customer_message: str,
    psid: str,
) -> dict[str, Any] | None:
    assets = pick_catalog_assets(intent, customer_message, psid)
    return assets[0] if assets else None


def build_media_hint(media_assets: list[dict[str, Any]] | None) -> str:
    if not media_assets:
        return "Aucun media automatique prevu."
    if len(media_assets) > 1:
        lines = [
            "Une galerie de plusieurs offres va etre envoyee AVANT ton message.",
            "Apres l'envoi des images, ton message doit demander au prospect quelle offre il veut choisir ou confirmer.",
            "Le message doit etre bref et orienter vers une reponse du type: Offre 1, Offre 2, Flash Video Express, Pack Boost Business, Story Pro Impact, Sur Mesure Pro, Gold Sur Mesure Pro.",
        ]
        for index, asset in enumerate(media_assets, start=1):
            lines.append(
                f"Offre {index}: {str(asset.get('label') or asset.get('asset_id') or 'offre')} - "
                f"{str(asset.get('description') or 'description non precisee')}"
            )
        return " ".join(lines)

    media_asset = media_assets[0]
    label = str(media_asset.get("label") or media_asset.get("asset_id") or "media")
    description = str(media_asset.get("description") or "")
    attachment_type = str(media_asset.get("attachment_type") or "media")
    service_label = str(media_asset.get("service_label") or media_asset.get("service_route") or "service")
    service_description = str(media_asset.get("service_description") or "")
    return (
        f"Media automatique prevu apres ton message: {attachment_type} '{label}' pour le service '{service_label}'. "
        f"Description du media: {description or 'non precisee'}. "
        f"Description du service: {service_description or 'non precisee'}. "
        "Si c'est pertinent, annonce brievement que tu envoies le bon catalogue ou le bon exemple."
    )


def set_contact_takeover(psid: str, enabled: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            INSERT INTO contacts (psid, human_takeover, telegram_last_reason, telegram_last_notified_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(psid) DO UPDATE SET
                human_takeover = excluded.human_takeover,
                telegram_last_reason = excluded.telegram_last_reason,
                telegram_last_notified_at = excluded.telegram_last_notified_at,
                last_seen_at = excluded.last_seen_at
            """,
            (
                psid,
                1 if enabled else 0,
                "" if not enabled else None,
                "" if not enabled else None,
                utc_now(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def remember_telegram_notification(psid: str, reason: str) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            INSERT INTO contacts (psid, telegram_last_reason, telegram_last_notified_at, last_seen_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(psid) DO UPDATE SET
                telegram_last_reason = excluded.telegram_last_reason,
                telegram_last_notified_at = excluded.telegram_last_notified_at,
                last_seen_at = excluded.last_seen_at
            """,
            (psid, reason, utc_now(), utc_now()),
        )
        conn.commit()
    finally:
        conn.close()


def build_problem_summary(intent: str, customer_message: str, needs_human: bool, order_signal: bool) -> str:
    lower = (customer_message or "").lower()
    if intent == "pricing" or "devis" in lower:
        return "Besoin de devis ou de prix."
    if intent == "portfolio":
        return "Besoin de realisations ou de preuves."
    if intent in {"appointment", "reservation"}:
        return "Besoin de reservation ou de rendez-vous."
    if order_signal or intent == "order":
        return "Prêt à commander."
    if needs_human or intent == "human":
        return "Besoin d'une reprise humaine."
    cleaned = re.sub(r"\s+", " ", (customer_message or "").strip())
    if not cleaned:
        return "Besoin à vérifier."
    cleaned = cleaned[:110].rstrip(" .,:;!-")
    if not cleaned:
        return "Besoin à vérifier."
    return cleaned[0].upper() + cleaned[1:] + "."


def build_problem_summary(intent: str, customer_message: str, needs_human: bool, order_signal: bool) -> str:
    lower = (customer_message or "").lower()
    if intent == "pricing" or "devis" in lower:
        return "Besoin de devis ou de prix."
    if intent == "portfolio":
        return "Besoin de realisations ou de preuves."
    if intent in {"appointment", "reservation"}:
        return "Besoin de reservation ou de rendez-vous."
    if order_signal or intent == "order":
        return "Pret a commander."
    if needs_human or intent == "human":
        return "Besoin d'une reprise humaine."
    cleaned = re.sub(r"\s+", " ", (customer_message or "").strip())
    if not cleaned:
        return "Besoin a verifier."
    cleaned = cleaned[:110].rstrip(" .,:;!-")
    if not cleaned:
        return "Besoin a verifier."
    return cleaned[0].upper() + cleaned[1:] + "."


def build_telegram_keyboard(psid: str, human_takeover: bool) -> dict[str, Any]:
    human_label = "Reprise humaine active" if human_takeover else "Prendre le relais"
    agent_label = "Rendre a l'agent" if human_takeover else "Agent actif"
    return {
        "inline_keyboard": [
            [{"text": human_label, "callback_data": f"takeover:{psid}"}],
            [{"text": agent_label, "callback_data": f"release:{psid}"}],
        ]
    }


async def telegram_api_call(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"https://api.telegram.org/bot{CONFIG['telegram_bot_token']}/{method}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def configure_telegram_webhook() -> None:
    token = str(CONFIG.get("telegram_bot_token") or "").strip()
    public_url = str(CONFIG.get("service_public_url") or "").strip().rstrip("/")
    if not token or not public_url:
        return
    await telegram_api_call(
        "setWebhook",
        {
            "url": f"{public_url}/webhook/telegram",
            "allowed_updates": ["callback_query"],
        },
    )


def detect_customer_language(message: str) -> str:
    text = (message or "").strip()
    lower = text.lower()

    def marker_count(markers: list[str]) -> int:
        total = 0
        for marker in markers:
            if " " in marker:
                total += 1 if marker in lower else 0
            else:
                total += 1 if re.search(rf"\b{re.escape(marker)}\b", lower) else 0
        return total

    if any("\u3040" <= ch <= "\u30ff" or "\u4e00" <= ch <= "\u9fff" for ch in text):
        return "japonais"

    malagasy_markers = [
        "salama",
        "mila",
        "ohatrinona",
        "firy",
        "ho an'ny",
        "aho",
        "tiako",
        "tiko",
        "azafady",
        "mba",
        "ve",
        "ilay",
        "izany",
        "zany",
        "anatiny",
        "horonantsary",
        "dokambarotra",
        "teny",
        "tanjona",
        "misaotra",
        "manao ahoana",
        "afaka",
        "ianareo",
        "ianao",
        "tompoko",
        "fanazavana",
        "fampahafantarana",
        "inona",
        "avy",
        "atao",
        "tolotra",
        "ataonareo",
        "nareo",
        "eny",
        "ie",
        "daty",
        "anarana",
        "laharana",
        "misy",
        "tianao",
        "sary",
        "asehoy",
        "ahy",
        "ohatra",
        "dokam",
        "barotra",
    ]
    english_markers = ["hello", "hi", "quote", "company", "promotional", "video", "need", "advertising"]
    spanish_markers = ["hola", "quiero", "presupuesto", "empresa", "servicio", "publicitario", "video", "spot"]
    french_markers = ["bonjour", "salut", "devis", "entreprise", "communication", "publicitaire", "video"]

    if marker_count(malagasy_markers) >= 1:
        return "malgache"
    if marker_count(english_markers) >= 2:
        return "anglais"
    if marker_count(spanish_markers) >= 2:
        return "espagnol"
    if marker_count(french_markers) >= 1:
        return "francais"
    return "meme langue que le message du client"


def is_language_neutral_message(message: str) -> bool:
    raw = str(message or "").strip()
    if not raw:
        return True
    if extract_phone_number(raw) or extract_email_address(raw):
        return True
    normalized = normalize_match_text(raw)
    short_confirmation_markers = [
        "oui",
        "ok",
        "okay",
        "confirm",
        "je confirme",
        "c est ca",
        "c'est ca",
        "eny",
        "ie",
        "marina",
    ]
    if len(normalized.split()) <= 3 and keyword_score(normalized, short_confirmation_markers) >= 1:
        return True
    return bool(re.fullmatch(r"[\d\s()+.\-_/]+", raw))


def response_matches_language(text: str, target_language: str) -> bool:
    content = (text or "").strip()
    lower = content.lower()

    def marker_count(markers: list[str]) -> int:
        total = 0
        for marker in markers:
            if " " in marker:
                total += 1 if marker in lower else 0
            else:
                total += 1 if re.search(rf"\b{re.escape(marker)}\b", lower) else 0
        return total

    if not content or target_language == "meme langue que le message du client":
        return True
    if target_language == "japonais":
        return any("\u3040" <= ch <= "\u30ff" or "\u4e00" <= ch <= "\u9fff" for ch in content)
    if target_language == "malgache":
        malagasy_markers = [
            "salama",
            "misaotra",
            "ianao",
            "ianareo",
            "afaka",
            "mba",
            "inona",
            "mila",
            "izahay",
            "isika",
            "ho anao",
            "tompoko",
            "eny",
            "daty",
            "anarana",
            "laharana",
            "sary",
            "asehoy",
            "ahy",
            "ohatra",
        ]
        return marker_count(malagasy_markers) >= 2
    if target_language == "anglais":
        english_markers = ["hello", "hi", "quote", "your", "you", "we", "can", "please", "video", "company"]
        return marker_count(english_markers) >= 2
    if target_language == "espagnol":
        spanish_markers = ["hola", "presupuesto", "puedes", "podrias", "empresa", "video", "spot", "quieres", "necesitas"]
        return marker_count(spanish_markers) >= 2
    if target_language == "francais":
        french_markers = ["bonjour", "devis", "vous", "votre", "nous", "pouvez", "video", "entreprise"]
        return marker_count(french_markers) >= 2
    return True


async def get_profile(psid: str, page_context: dict[str, Any] | None = None) -> dict[str, Any]:
    resolved_page_context = page_context or resolve_page_context()
    access_token = str(resolved_page_context.get("page_access_token") or "").strip()
    if not access_token:
        return {}
    url = (
        f"https://graph.facebook.com/{psid}"
        f"?fields=first_name,last_name,profile_pic"
        f"&access_token={access_token}"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception:
            return {"first_name": "Client", "last_name": "", "profile_pic": ""}


def build_sales_system_prompt() -> str:
    return "\n".join(
        [
            "Tu es FLARE AI, l'agent IA commercial de RAM'S FLARE sur Facebook Messenger.",
            "Tu agis comme un vendeur rapide, rassurant, convaincant et efficace.",
            "Ton objectif est de faire avancer la conversation vers un devis, une commande, un rendez-vous ou une reprise humaine si necessaire.",
            "RAM'S FLARE est une agence de communication et une maison de production audiovisuelle fondee en 2001.",
            "RAM'S FLARE propose notamment : strategie de communication, elaboration de strategies, marketing et communication, CCC (changement de comportement), sensibilisation, spots publicitaires, films documentaires, regie multicameras, livestreaming, location de studio de tournage, et creation musicale.",
            "Quand le client demande qui est RAM'S FLARE ou ce que fait RAM'S FLARE, reponds clairement en t'appuyant sur ces informations.",
            "Quand c'est pertinent, relie toujours le besoin du client a l'un de ces services de RAM'S FLARE.",
            "Reponds uniquement avec le texte final a envoyer au client.",
            "Adapte toujours la langue de reponse a celle du client.",
            "Tu peux repondre en francais, malgache, anglais, espagnol, japonais et dans toute autre langue comprise dans le message du client.",
            "Si le client ecrit dans une langue claire, reponds dans cette langue.",
            "Si le client melange plusieurs langues, utilise la langue dominante du message.",
            "Si la langue n'est pas claire, reponds en francais simple.",
            "Si une langue detectee est fournie dans le contexte utilisateur, suis-la strictement.",
            "Utilise une langue simple, naturelle, humaine et professionnelle.",
            "Fais des reponses tres courtes: 1 a 2 phrases courtes, et 280 caracteres si possible.",
            "Va droit au besoin du client et termine par une prochaine action claire ou une question utile.",
            "Si une phrase n'apporte rien, supprime-la.",
            "Les gens ne liront pas un long message: sois bref, clair et utile.",
            "N'ouvre pas automatiquement tes messages par merci, misaotra ou une formule qui donne l'impression de vouloir terminer vite la conversation.",
            "Ne coupe jamais brutalement l'echange. Laisse toujours une suite claire, professionnelle et accueillante.",
            "Tu ne fais pas seulement de l'assistance: tu guides le client vers la meilleure prochaine etape commerciale.",
            "Mets en avant la valeur pour le client avec des mots simples: clarte, impact, image de marque, resultats, gain de temps.",
            "Montre de l'enthousiasme avec sobriete quand le besoin est interessant ou urgent.",
            "Quand le besoin est clair, ne pose pas une question large: pose directement la question la plus utile pour faire avancer le devis ou la commande.",
            "Quand le client montre une intention d'achat, adopte une posture de closer: confirme l'interet, rassure, puis fais avancer immediatement.",
            "Pour une demande de devis, de rendez-vous, d'appel, de reservation ou de commande, dis clairement qu'un responsable de RAM'S FLARE va etre prevenu pour organiser la suite.",
            "Pour ces demandes, invite le client a laisser ses coordonnees pour que RAM'S FLARE puisse revenir avec une reponse precise, claire et detaillee.",
            "Si la demande doit etre mieux comprise, propose soit un rendez-vous ou un appel, soit au client de detailler sa demande ici ou par mail.",
            "Pour ces demandes, ne tourne pas en rond et ne repose pas plusieurs fois des questions vagues.",
            "Si une seule precision est necessaire, pose une seule question concrete et utile.",
            "En malgache, quand tu parles d'un rendez-vous ou d'une rencontre avec le client, privilegie 'isika' plutot que 'izahay' quand cela parle d'une action commune.",
            "Ne promets jamais un prix, un delai, une disponibilite ou un stock non confirmes.",
            "Si le client demande un prix, ne donne pas de tarif invente: explique en une phrase que le prix depend du besoin, puis pose une question de cadrage precise.",
            "Si le client demande un devis, valorise brievement le projet puis demande l'information la plus importante qui manque.",
            "Si le client semble pret a acheter, fais avancer vers commande, devis ou prise de contact sans perdre de temps.",
            "Si la demande est floue, pose une seule question de clarification a fort impact.",
            "Une seule question a la fois. Pas de rafale de questions.",
            "Evite les formulations trop passives comme 'je peux vous aider'. Prefere des formulations orientees action et resultat.",
            "Evite les reponses generiques. Chaque reponse doit sembler ecrite pour ce client et son besoin.",
            "Evite les phrases vides, les repetitons et les reponses qui parlent sans faire avancer.",
            "Si le client est presse, reponds de facon encore plus concise.",
            "Si le cas est sensible, complexe, urgent ou litigieux, dis calmement qu'un responsable de RAM'S FLARE va reprendre.",
            "Pour un catalogue ou une presentation des services, confirme que c'est disponible puis oriente vers le besoin principal pour envoyer ce qu'il faut.",
            "Pour une objection budget, rassure d'abord puis oriente vers une formule adaptee ou un besoin prioritaire.",
            "N'utilise pas de listes, pas de markdown, pas de texte interne, pas d'emojis.",
            "N'invente jamais d'information.",
        ]
    )


def requires_responsible_followup(intent: str, customer_message: str, order_signal: bool) -> bool:
    lower = (customer_message or "").lower()
    return intent in {"pricing", "appointment"} or order_signal or any(
        x in lower for x in ["devis", "rdv", "rendez-vous", "appel", "meeting", "reservation", "reserver"]
    )


def build_action_hint(intent: str, customer_message: str, order_signal: bool) -> str:
    if requires_responsible_followup(intent, customer_message, order_signal):
        return "Action attendue: informer clairement le client qu'un responsable de RAM'S FLARE va etre prevenu pour organiser la suite de facon professionnelle."
    return "Action attendue: repondre clairement et faire avancer la conversation sans tourner en rond."


def ensure_responsible_followup(text: str, language: str, required: bool) -> str:
    if not required:
        return text.strip()
    lower = (text or "").lower()
    if any(marker in lower for marker in ["responsable", "tompon'andraikitra", "manager", "responsable", "contactera", "hifandray"]):
        return text.strip()

    handoff_by_language = {
        "malgache": "Hampahafantarina avy hatrany ny tompon'andraikitra iray ao amin'ny RAM'S FLARE mba handamina ny tohiny.",
        "anglais": "A RAM'S FLARE manager will be informed right away to organize the next steps with you.",
        "espagnol": "Un responsable de RAM'S FLARE sera informado de inmediato para organizar la continuación contigo.",
        "japonais": "RAM'S FLAREの担当者にすぐ共有し、今後の流れを調整いたします。",
        "francais": "Un responsable de RAM'S FLARE va etre prevenu rapidement pour organiser la suite avec vous.",
        "meme langue que le message du client": "Un responsable de RAM'S FLARE va etre prevenu rapidement pour organiser la suite avec vous.",
    }
    handoff = handoff_by_language.get(language, handoff_by_language["francais"])
    cleaned = text.strip().rstrip()
    if cleaned.count("?") > 1:
        cleaned = cleaned.split("?", 1)[0].strip() + "?"
    if cleaned.endswith((".", "!", "?")):
        return f"{cleaned} {handoff}".strip()
    return f"{cleaned}. {handoff}".strip()


def ensure_responsible_followup(text: str, language: str, required: bool) -> str:
    cleaned = text.strip().rstrip()
    if language == "malgache":
        cleaned = cleaned.replace("mihaona izahay", "mihaona isika")
        cleaned = cleaned.replace("hifankahita izahay", "hifankahita isika")
        cleaned = cleaned.replace("hihaona izahay", "hihaona isika")
        cleaned = cleaned.replace("Misaotra anao nifandray tamin'i RAM'S FLARE. ", "")
        cleaned = cleaned.replace("Misaotra anao amin'ny hafatrao. ", "")
        cleaned = cleaned.replace("Misaotra amin'ny hafatrao. ", "")
        cleaned = cleaned.replace("Misaotra tamin'ny hafatrao. ", "")

    if not required:
        return cleaned

    lower = cleaned.lower()
    if cleaned.count("?") > 1:
        cleaned = cleaned.split("?", 1)[0].strip() + "?"

    handoff_by_language = {
        "malgache": {
            "responsible": "Hampahafantarina avy hatrany ny tompon'andraikitra iray ao amin'ny RAM'S FLARE mba handamina ny tohiny miaraka aminao.",
            "details": "Azafady, avelao ny laharana na ny mailakao, ary raha ilaina dia azonao hazavaina eto na amin'ny mailaka ny antsipirian'ny fangatahanao mba hahafahanay miverina aminao amin'ny valiny mazava, marina ary feno.",
        },
        "anglais": {
            "responsible": "A RAM'S FLARE manager will be informed right away to organize the next steps with you.",
            "details": "Please leave your contact details, and if needed you can also explain your request here or by email so we can come back to you with a clear and precise answer.",
        },
        "espagnol": {
            "responsible": "Un responsable de RAM'S FLARE sera informado de inmediato para organizar la continuacion contigo.",
            "details": "Por favor, deja tus datos de contacto y, si lo deseas, tambien puedes detallar tu solicitud aqui o por correo para que podamos volver hacia ti con una respuesta clara y precisa.",
        },
        "japonais": {
            "responsible": "RAM'S FLAREの担当者にすぐ共有し、今後の流れを調整いたします。",
            "details": "ご連絡先を残していただき、必要であればご要望をこちらまたはメールで詳しくお送りください。正確で分かりやすい回答を差し上げます。",
        },
        "francais": {
            "responsible": "Un responsable de RAM'S FLARE va etre prevenu rapidement pour organiser la suite avec vous.",
            "details": "Merci de laisser vos coordonnees et, si besoin, de detailler votre demande ici ou par mail afin que nous revenions vers vous avec une reponse precise, claire et detaillee.",
        },
        "meme langue que le message du client": {
            "responsible": "Un responsable de RAM'S FLARE va etre prevenu rapidement pour organiser la suite avec vous.",
            "details": "Merci de laisser vos coordonnees et, si besoin, de detailler votre demande ici ou par mail afin que nous revenions vers vous avec une reponse precise, claire et detaillee.",
        },
    }
    handoff_parts = handoff_by_language.get(language, handoff_by_language["francais"])
    has_responsible = any(marker in lower for marker in [
        "responsable", "tompon'andraikitra", "manager", "contactera", "hifandray",
        "organiser la suite", "handamina ny tohiny", "va vous contacter",
        "organiser votre rendez-vous", "ho avy ny olona tompon'andraikitra",
        "will be informed", "sera informado"
    ])
    has_contact = any(marker in lower for marker in ["coordonn", "mail", "email", "telephone", "numero", "laharana", "mailaka"])
    has_detail = any(marker in lower for marker in ["detail", "decrire", "expliquer", "mail", "email", "hazavaina", "antsipiriany", "detaillez"])

    contact_only_by_language = {
        "malgache": "Azafady, avelao ny laharana na ny mailakao mba hahafahanay miverina aminao.",
        "anglais": "Please leave your contact details so we can come back to you properly.",
        "espagnol": "Por favor, deja tus datos de contacto para que podamos volver hacia ti correctamente.",
        "japonais": "ご連絡先を残していただければ、こちらから折り返しいたします。",
        "francais": "Merci de laisser vos coordonnees afin que nous revenions vers vous correctement.",
        "meme langue que le message du client": "Merci de laisser vos coordonnees afin que nous revenions vers vous correctement.",
    }
    detail_only_by_language = {
        "malgache": "Raha ilaina dia azonao hazavaina eto na amin'ny mailaka ny antsipirian'ny fangatahanao mba hahafahanay mamaly mazava sy marina.",
        "anglais": "If needed, you can also explain your request here or by email so we can answer clearly and precisely.",
        "espagnol": "Si lo deseas, tambien puedes detallar tu solicitud aqui o por correo para que podamos responder con claridad y precision.",
        "japonais": "必要であれば、ご要望をこちらまたはメールで詳しくお送りください。明確にご案内いたします。",
        "francais": "Si besoin, vous pouvez aussi detailler votre demande ici ou par mail afin que nous revenions vers vous avec une reponse precise.",
        "meme langue que le message du client": "Si besoin, vous pouvez aussi detailler votre demande ici ou par mail afin que nous revenions vers vous avec une reponse precise.",
    }

    segments = [cleaned]
    if not has_responsible:
        segments.append(handoff_parts["responsible"])
    if not (has_contact and has_detail):
        if has_contact and not has_detail:
            segments.append(detail_only_by_language.get(language, detail_only_by_language["francais"]))
        elif has_detail and not has_contact:
            segments.append(contact_only_by_language.get(language, contact_only_by_language["francais"]))
        else:
            segments.append(handoff_parts["details"])

    return " ".join(segment.strip() for segment in segments if segment.strip())


def ensure_responsible_followup(text: str, language: str, required: bool) -> str:
    cleaned = text.strip().rstrip()
    if language == "malgache":
        cleaned = cleaned.replace("mihaona izahay", "mihaona isika")
        cleaned = cleaned.replace("hifankahita izahay", "hifankahita isika")
        cleaned = cleaned.replace("hihaona izahay", "hihaona isika")
        cleaned = cleaned.replace("Misaotra anao nifandray tamin'i RAM'S FLARE. ", "")
        cleaned = cleaned.replace("Misaotra anao amin'ny hafatrao. ", "")
        cleaned = cleaned.replace("Misaotra amin'ny hafatrao. ", "")
        cleaned = cleaned.replace("Misaotra tamin'ny hafatrao. ", "")

    if not required:
        return cleaned

    lower = cleaned.lower()
    if cleaned.count("?") > 1:
        cleaned = cleaned.split("?", 1)[0].strip() + "?"

    handoff_by_language = {
        "malgache": {
            "responsible": "Hampahafantarina avy hatrany ny ekipa RAM'S FLARE mba handamina ny tohiny miaraka aminao.",
            "details": "Azafady, avelao ny laharana na ny mailakao, na hazavao eto na amin'ny mailaka ny fangatahanao.",
        },
        "anglais": {
            "responsible": "The RAM'S FLARE team will be informed right away to organize the next steps with you.",
            "details": "Please leave your contact details, or explain your request here or by email.",
        },
        "espagnol": {
            "responsible": "Un responsable de RAM'S FLARE sera informado de inmediato para organizar la continuacion contigo.",
            "details": "Por favor, deja tus datos de contacto o detalla tu solicitud aqui o por correo.",
        },
        "japonais": {
            "responsible": "RAM'S FLAREの担当者にすぐ共有し、今後の流れを調整いたします。",
            "details": "ご連絡先を残すか、ご要望をこちらまたはメールでお送りください。",
        },
        "francais": {
            "responsible": "L'equipe RAM'S FLARE va etre prevenue rapidement pour organiser la suite avec vous.",
            "details": "Merci de laisser vos coordonnees, ou de detailler votre demande ici ou par mail.",
        },
        "meme langue que le message du client": {
            "responsible": "L'equipe RAM'S FLARE va etre prevenue rapidement pour organiser la suite avec vous.",
            "details": "Merci de laisser vos coordonnees, ou de detailler votre demande ici ou par mail.",
        },
    }
    handoff_parts = handoff_by_language.get(language, handoff_by_language["francais"])
    has_responsible = any(marker in lower for marker in [
        "responsable", "tompon'andraikitra", "manager", "equipe", "team", "contactera", "hifandray",
        "organiser la suite", "handamina ny tohiny", "va vous contacter",
        "organiser votre rendez-vous", "ho avy ny olona tompon'andraikitra",
        "will be informed", "sera informado"
    ])
    has_contact = any(marker in lower for marker in ["coordonn", "mail", "email", "telephone", "numero", "laharana", "mailaka"])
    has_detail = any(marker in lower for marker in ["detail", "decrire", "expliquer", "mail", "email", "hazavaina", "antsipiriany", "detaillez"])

    contact_only_by_language = {
        "malgache": "Azafady, avelao ny laharana na ny mailakao.",
        "anglais": "Please leave your contact details.",
        "espagnol": "Por favor, deja tus datos de contacto.",
        "japonais": "ご連絡先を残してください。",
        "francais": "Merci de laisser vos coordonnees.",
        "meme langue que le message du client": "Merci de laisser vos coordonnees.",
    }
    detail_only_by_language = {
        "malgache": "Raha ilaina dia azonao hazavaina eto na amin'ny mailaka ny fangatahanao.",
        "anglais": "If needed, explain your request here or by email.",
        "espagnol": "Si lo deseas, detalla tu solicitud aqui o por correo.",
        "japonais": "必要であれば、ご要望をこちらまたはメールでお送りください。",
        "francais": "Si besoin, detaillez votre demande ici ou par mail.",
        "meme langue que le message du client": "Si besoin, detaillez votre demande ici ou par mail.",
    }

    segments = [cleaned]
    if not has_responsible:
        segments.append(handoff_parts["responsible"])
    if not (has_contact and has_detail):
        if has_contact and not has_detail:
            segments.append(detail_only_by_language.get(language, detail_only_by_language["francais"]))
        elif has_detail and not has_contact:
            segments.append(contact_only_by_language.get(language, contact_only_by_language["francais"]))
        else:
            segments.append(handoff_parts["details"])

    return " ".join(segment.strip() for segment in segments if segment.strip())


def build_sales_system_prompt() -> str:
    return "\n".join(
        [
            "Tu es FLARE AI, l'agent IA commercial de RAM'S FLARE sur Facebook Messenger.",
            "RAM'S FLARE est une agence de communication et une maison de production audiovisuelle fondee en 2001.",
            "Services principaux : strategie de communication, marketing et communication, CCC, sensibilisation, spots publicitaires, films documentaires, regie multicameras, livestreaming, location de studio, creation musicale.",
            "Reponds dans la langue du client.",
            "Sois commercial, rapide, professionnel, clair et rassurant.",
            "Ecris 1 ou 2 phrases courtes, 240 caracteres environ si possible.",
            "Va droit au besoin du client. Pas de blabla, pas de listes, pas de markdown, pas d'emojis.",
            "N'invente jamais un prix, un delai, une disponibilite ou une information non confirmee.",
            "Pour un devis, un rendez-vous, une commande, un appel ou une demande hors de tes capacites, dis qu'un responsable de RAM'S FLARE va etre prevenu.",
            "Dans ces cas, demande les coordonnees du client ou propose de detailler la demande ici ou par mail.",
            "Si une precision manque, pose une seule question utile.",
            "En malgache, pour une rencontre commune, prefere 'isika' a 'izahay'.",
            "Retourne uniquement le texte final a envoyer au client.",
        ]
    )


def requires_responsible_followup(intent: str, customer_message: str, order_signal: bool, needs_human: bool = False) -> bool:
    lower = (customer_message or "").lower()
    return needs_human or intent in {"pricing", "appointment", "order"} or order_signal or any(
        x in lower for x in ["devis", "rdv", "rendez-vous", "appel", "meeting", "reservation", "reserver", "responsable"]
    )


def build_action_hint(intent: str, customer_message: str, order_signal: bool, needs_human: bool = False) -> str:
    if requires_responsible_followup(intent, customer_message, order_signal, needs_human):
        return (
            "Action attendue: repondre tres brievement, informer qu'un responsable de RAM'S FLARE "
            "va etre prevenu, puis demander soit les coordonnees du client soit le detail de sa demande ici ou par mail."
        )
    return "Action attendue: repondre clairement en 1 ou 2 phrases et faire avancer la conversation avec une seule question utile si necessaire."


def build_fallback_reply(language: str) -> str:
    replies = {
        "malgache": "Voaray ny hafatrao.",
        "anglais": "Your message has been received.",
        "espagnol": "Hemos recibido tu mensaje.",
        "japonais": "メッセージを受け取りました。",
        "francais": "Nous avons bien recu votre demande.",
        "meme langue que le message du client": "Nous avons bien recu votre demande.",
    }
    return replies.get(language, replies["francais"])


def _page_context_prompt_preferences(page_context: dict[str, Any] | None) -> dict[str, str]:
    source = page_context or {}
    return {
        "page_name": _clean_page_prompt_value(source.get("page_name"), 200),
        "organization_slug": _clean_page_prompt_value(source.get("organization_slug"), 120),
        "bot_name": _clean_page_prompt_value(source.get("bot_name"), 120),
        "tone": _clean_page_prompt_value(source.get("tone"), 40),
        "language": _clean_page_prompt_value(source.get("language"), 20),
        "greeting_message": _clean_page_prompt_value(source.get("greeting_message"), 1200),
        "company_description": _clean_page_prompt_value(source.get("company_description"), 4000),
        "products_summary": _clean_page_prompt_value(source.get("products_summary"), 6000),
        "special_instructions": _clean_page_prompt_value(source.get("special_instructions"), 3000),
    }


def _has_dynamic_page_prompt(preferences: dict[str, str]) -> bool:
    dynamic_fields = (
        "company_description",
        "products_summary",
        "special_instructions",
        "greeting_message",
        "bot_name",
        "tone",
        "language",
    )
    return any(str(preferences.get(field) or "").strip() for field in dynamic_fields)


def build_sales_system_prompt(page_context: dict[str, Any] | None = None) -> str:
    fallback_lines = [
        "Tu es FLARE AI, l'assistant commercial Facebook Messenger de RAM'S FLARE.",
        "Ta mission n'est pas de discuter longtemps. Ta mission est de convertir la conversation en commande, reservation, devis, lead qualifie ou handoff humain.",
        "RAM'S FLARE est une agence de communication et maison de production audiovisuelle a Madagascar.",
        "Services actuels a proposer: spot publicitaire, film documentaire et livestream multicamera.",
        "Les offres envoyees en galerie correspondent a des offres de publicites video. Ne les presente pas comme tout le metier de RAM'S FLARE.",
        "Preuves video disponibles: spot publicitaire et film documentaire.",
        "Pour le livestream multicamera, n'invente jamais de preuve video. Dis simplement que RAM'S FLARE en a deja realise plusieurs.",
        "Quand c'est utile, rappelle brievement que RAM'S FLARE a deja realise plus de 300 projets, dont spots pub, films documentaires, livestreams et organisations evenementielles.",
        "Tu reponds toujours dans la langue du prospect. Le prospect peut ecrire en francais, malgache ou anglais.",
        "Tu suis toujours ce flow commercial: 1. Accueillir 2. Comprendre 3. Montrer 4. Proposer 5. Pousser 6. Capturer 7. Confirmer.",
        "Definition du flow: Accueillir = ouverture breve. Comprendre = identifier le besoin. Montrer = preuve, galerie ou catalogue. Proposer = orienter vers l'offre adaptee. Pousser = CTA clair. Capturer = recuperer le numero de telephone, le nom ou l'information utile. Confirmer = verifier le choix ou la prochaine etape.",
        "Regle d'or: chaque message doit etre court, clair et oriente action. Si une etape manque, la vente baisse. Pas de preuve = pas de confiance. Pas d'offre = pas de decision. Pas de capture = pas de client.",
        "Tu dois toujours verifier mentalement trois choses: est-ce que tu guides ? est-ce que tu vends ? est-ce que tu captures ? Si non, corrige ton message.",
        "Tu n'es pas un bot FAQ. Tu guides, rassures, qualifies et fais avancer la vente.",
        "Reste humain, proche du client, simple et rassurant.",
        "Chaque reponse doit etre courte, naturelle, rassurante, professionnelle, avec 1 a 2 phrases courtes.",
        "Une seule question a la fois. Une seule action a la fois.",
        "Si le prospect pose une question, reponds d'abord a sa question en une phrase, puis reprends le flow commercial avec une seule prochaine action claire.",
        "Toujours finir par une prochaine action claire: devis rapide, voir un exemple, choisir une offre ou laisser son numero de telephone.",
        "Quand le besoin est identifie, recommande la solution la plus adaptee au lieu de reciter tout le catalogue.",
        "Quand une galerie d'offres est envoyee avant ton message, ne redescris pas tout longuement. Demande simplement au prospect quelle offre il choisit ou souhaite confirmer.",
        "Quand le prospect hesite ou demande des realisations, montre 1 ou 2 preuves pertinentes maximum, jamais plus.",
        "Quand le prospect demande un prix, ne dis jamais seulement que cela depend. Demande une seule variable de cadrage puis pousse vers devis rapide.",
        "Quand le prospect veut acheter vite, raccourcis le flow et collecte seulement le minimum utile pour avancer.",
        "Quand le prospect demande un humain, quand le cas est urgent, complexe, sensible ou litigieux, dis que l'equipe RAM'S FLARE va reprendre rapidement.",
        "Si le prospect demande ce que fait RAM'S FLARE, explique en une phrase que RAM'S FLARE realise des spots pub, films documentaires et livestreams multicamera, puis annonce que tu peux montrer les offres publicitaires video ou orienter vers le bon service.",
        "Ne pose jamais plusieurs questions dans le meme message.",
        "Ne fais pas de longues explications techniques.",
        "Ne promets jamais un prix, un delai ou une disponibilite non confirmes.",
        "En malgache, pour une action commune, prefere 'isika' a 'izahay'.",
        "Retourne uniquement le texte final a envoyer au client.",
    ]
    preferences = _page_context_prompt_preferences(page_context)
    if not _has_dynamic_page_prompt(preferences):
        return "\n".join(fallback_lines)

    business_name = preferences["page_name"] or preferences["organization_slug"] or "l'entreprise"
    bot_name = preferences["bot_name"] or "L'assistant"
    tone_instruction = {
        "professionnel": "Ton a adopter: professionnel, rassurant et direct.",
        "amical": "Ton a adopter: amical, chaleureux et rassurant.",
        "decontracte": "Ton a adopter: simple, naturel et detendu sans perdre le cadre commercial.",
        "formel": "Ton a adopter: formel, poli et structure.",
    }.get(preferences["tone"], "")

    dynamic_lines = [
        f"Tu es {bot_name}, l'assistant commercial Facebook Messenger de {business_name}.",
        "Ta mission n'est pas de discuter longtemps. Ta mission est de convertir la conversation en commande, reservation, devis, lead qualifie ou handoff humain.",
    ]
    if preferences["company_description"]:
        dynamic_lines.append(f"Description de l'entreprise: {preferences['company_description']}")
    else:
        dynamic_lines.append(fallback_lines[2])
    if preferences["products_summary"]:
        dynamic_lines.append(f"Produits et services a proposer en priorite: {preferences['products_summary']}")
    else:
        dynamic_lines.append(fallback_lines[3])
        dynamic_lines.append(fallback_lines[4])
        dynamic_lines.append(fallback_lines[5])
        dynamic_lines.append(fallback_lines[6])
        dynamic_lines.append(fallback_lines[7])
    dynamic_lines.append("Tu reponds toujours dans la langue du prospect. Le prospect peut ecrire en francais, malgache ou anglais.")
    if preferences["language"]:
        dynamic_lines.append(
            f"Si la langue du prospect n'est pas claire, utilise par defaut {preferences['language']}."
        )
    if tone_instruction:
        dynamic_lines.append(tone_instruction)
    if preferences["greeting_message"]:
        dynamic_lines.append(
            "Quand le prospect ouvre la conversation ou demande un premier contact, "
            f"tu peux t'inspirer de ce message d'accueil sans le recopier mot a mot: {preferences['greeting_message']}"
        )
    if preferences["special_instructions"]:
        dynamic_lines.append(
            f"Consignes specifiques de l'organisation a respecter: {preferences['special_instructions']}"
        )
    dynamic_lines.extend(fallback_lines[9:])
    return "\n".join(dynamic_lines)


def requires_responsible_followup(intent: str, customer_message: str, order_signal: bool, needs_human: bool = False) -> bool:
    lower = (customer_message or "").lower()
    if intent in {"greeting", "catalogue", "offer_choice"}:
        return False
    return needs_human or intent in {"human", "appointment"} or any(
        x in lower for x in ["responsable", "urgent", "litige", "plainte", "remboursement", "manager"]
    )


def build_action_hint(intent: str, customer_message: str, order_signal: bool, needs_human: bool = False) -> str:
    service_route = detect_service_route(customer_message)
    selected_offer = detect_service_choice_offer(customer_message)
    if selected_offer:
        return (
            f"Action attendue: le prospect semble choisir '{str(selected_offer.get('label') or 'une offre')}'. "
            "Confirme brievement que c'est bien cette offre qu'il veut, puis propose de reserver, demander un devis "
            "ou laisser son numero de telephone."
        )
    if wants_company_explanation(customer_message):
        return (
            "Action attendue: expliquer en une phrase que RAM'S FLARE est une agence de communication et maison de production audiovisuelle, "
            "indiquer que tu envoies les offres, puis demander laquelle interesse le prospect."
        )
    if intent == "greeting":
        return (
            "Action attendue: accueillir brievement, comprendre le besoin avec une seule question utile, "
            "et proposer 3 ou 4 choix simples comme spot pub, film documentaire, livestream multicamera ou offres publicitaires."
        )
    if intent == "catalogue" or (not service_route and wants_service_choice_asset(customer_message)):
        return (
            "Action attendue: apres l'envoi de la galerie d'offres, demande clairement au prospect quelle offre il veut, "
            "ou laquelle correspond le mieux a son besoin. Invite-le a repondre par le nom de l'offre ou son numero."
        )
    if intent == "portfolio":
        return (
            "Action attendue: montrer 1 ou 2 exemples tres pertinents maximum, puis proposer soit un devis rapide "
            "soit une question unique pour identifier le besoin principal."
        )
    if intent == "pricing":
        return (
            "Action attendue: ne jamais donner un prix invente. Poser une seule question de cadrage sur le type de projet "
            "et orienter vers un devis rapide."
        )
    if intent in {"reservation", "appointment", "order"} or order_signal:
        return (
            "Action attendue: confirmer l'interet, rassurer, faire avancer vite, informer qu'un responsable de RAM'S FLARE "
            "va etre prevenu si necessaire, puis demander les coordonnees ou la date manquante."
        )
    if requires_responsible_followup(intent, customer_message, order_signal, needs_human):
        return (
            "Action attendue: repondre tres brievement, informer qu'un responsable de RAM'S FLARE "
            "va etre prevenu, puis demander soit les coordonnees du client soit le detail de sa demande ici ou par mail."
        )
    if service_route:
        return (
            f"Action attendue: le besoin semble lie au service {service_route}. Qualifie legerement avec une seule question utile "
            "puis propose devis, exemple, numero de telephone ou confirmation de la suite."
        )
    return (
        "Action attendue: identifier rapidement le besoin commercial avec une seule question utile, puis guider vers "
        "devis, exemple, choix d'offre ou capture du numero de telephone sans tourner en rond."
    )


def build_fallback_reply(language: str, intent: str, needs_human: bool = False) -> str:
    replies = {
        "default": {
            "malgache": "Inona marina no ilainao: spot pub, film documentaire sa livestream multicamera ?",
            "anglais": "What do you need exactly: an ad spot, a documentary film or a multicamera livestream?",
            "espagnol": "Que necesitas exactamente: spot publicitario, cobertura de evento, livestream, sesion de fotos o estudio?",
            "japonais": "どのサービスをご希望ですか。広告動画、イベント撮影、ライブ配信、写真撮影、またはスタジオ予約ですか。",
            "francais": "De quel type de projet avez-vous besoin: spot pub, film documentaire ou livestream multicamera ?",
            "meme langue que le message du client": "De quel type de projet avez-vous besoin: spot pub, film documentaire ou livestream multicamera ?",
        },
        "greeting": {
            "malgache": "Salama. Mila spot pub, film documentaire, livestream multicamera sa offres pub ianao anio ?",
            "anglais": "Hello. What do you need today: an ad spot, a documentary film, a multicamera livestream or our ad offers?",
            "espagnol": "Aqui estan nuestras ofertas. Cual te interesa mas? Responde con el nombre o el numero de la oferta.",
            "japonais": "こちらが現在のオファーです。気になるものをオファー名または番号で返信してください。",
            "francais": "Bonjour. Vous avez besoin d'un spot pub, d'un film documentaire, d'un livestream multicamera ou de voir nos offres pub ?",
            "meme langue que le message du client": "Bonjour. Vous avez besoin d'un spot pub, d'un film documentaire, d'un livestream multicamera ou de voir nos offres pub ?",
        },
        "catalogue": {
            "malgache": "Ireto ny offres pub video. Valio amin'ny laharana na ny anaran'ilay offre mahaliana anao.",
            "anglais": "Here are our video advertising offers. Reply with the offer number or name that interests you.",
            "espagnol": "Estas son las ofertas disponibles. Dime el nombre o el numero de la oferta que quieres confirmar.",
            "japonais": "こちらが利用可能なオファーです。確認したいオファー名または番号を教えてください。",
            "francais": "Voici nos offres de publicites video. Dites-moi le numero ou le nom de l'offre qui vous interesse.",
            "meme langue que le message du client": "Voici nos offres de publicites video. Dites-moi le numero ou le nom de l'offre qui vous interesse.",
        },
        "offer_choice": {
            "malgache": "Tsara. Io tokoa ve ilay offre tianao ? Raha eny, avelao ny anaranao sy ny nomeraon-telefaoninao dia tohizantsika avy hatrany.",
            "anglais": "Great. Is that the exact offer you want? If yes, send your name and phone number and we will move forward right away.",
            "espagnol": "Perfecto. Es esa exactamente la oferta que quieres? Si si, deja tu nombre y tu numero de telefono para avanzar enseguida.",
            "japonais": "承知しました。そのオファーでよろしいですか。問題なければ、お名前と電話番号を送ってください。すぐに進めます。",
            "francais": "Tres bien. C'est bien cette offre que vous voulez ? Si oui, laissez votre nom et votre numero de telephone pour avancer rapidement.",
            "meme langue que le message du client": "Tres bien. C'est bien cette offre que vous voulez ? Si oui, laissez votre nom et votre numero de telephone pour avancer rapidement.",
        },
        "pricing": {
            "malgache": "Mba hanomezana ny tombana mety, inona aloha ny karazana projet-nao ?",
            "anglais": "To guide you on pricing, what type of project is it?",
            "espagnol": "Para orientarte sobre el precio, que tipo de proyecto es?",
            "japonais": "料金の目安をご案内するため、どの種類のプロジェクトか教えてください。",
            "francais": "Pour vous orienter sur le tarif, il s'agit d'un spot pub, d'un film documentaire ou d'un livestream multicamera ?",
            "meme langue que le message du client": "Pour vous orienter sur le tarif, il s'agit d'un spot pub, d'un film documentaire ou d'un livestream multicamera ?",
        },
        "portfolio": {
            "malgache": "Afaka mandefa ohatra 1 na 2 mifanaraka amin'ny ilainao aho. Projet inona no tena tadiavinao ?",
            "anglais": "I can show 1 or 2 relevant examples. What kind of project do you have?",
            "espagnol": "Puedo mostrarte 1 o 2 ejemplos pertinentes. Que tipo de proyecto tienes?",
            "japonais": "関連する実績を1〜2件ご案内できます。どのようなプロジェクトですか。",
            "francais": "Je peux vous montrer 1 ou 2 exemples pertinents. Quel type de projet avez-vous ?",
            "meme langue que le message du client": "Je peux vous montrer 1 ou 2 exemples pertinents. Quel type de projet avez-vous ?",
        },
        "reservation": {
            "malgache": "Mba handrosoana haingana, inona ny daty tianao hojerena ?",
            "anglais": "To move quickly, what date would you like to book?",
            "espagnol": "Para avanzar rapido, que fecha deseas reservar?",
            "japonais": "早く進めるため、ご希望の日程を教えてください。",
            "francais": "Pour avancer vite, quelle date souhaitez-vous reserver ?",
            "meme langue que le message du client": "Pour avancer vite, quelle date souhaitez-vous reserver ?",
        },
        "order": {
            "malgache": "Tsara. Avelao azafady ny anaranao sy ny nomeraon-telefaoninao dia handroso haingana isika.",
            "anglais": "Perfect. Please leave your name and phone number so we can move forward quickly.",
            "espagnol": "Perfecto. Deja tu nombre y tu numero de telefono para avanzar rapidamente.",
            "japonais": "承知しました。早く進めるため、お名前と電話番号を残してください。",
            "francais": "Parfait. Laissez votre nom et votre numero de telephone pour avancer rapidement.",
            "meme langue que le message du client": "Parfait. Laissez votre nom et votre numero de telephone pour avancer rapidement.",
        },
        "service": {
            "malgache": "Tsara. Ho an'ny orinasa sa ho an'ny filana manokana ity projet ity ?",
            "anglais": "Great. Is this project for a business or a personal need?",
            "espagnol": "Muy bien. Este proyecto es para una empresa o para una necesidad personal?",
            "japonais": "承知しました。このプロジェクトは会社向けですか、それとも個人向けですか。",
            "francais": "Tres bien. C'est pour une entreprise ou un besoin personnel ?",
            "meme langue que le message du client": "Tres bien. C'est pour une entreprise ou un besoin personnel ?",
        },
        "human": {
            "malgache": "Avelao azafady ny anaranao sy ny nomeraon-telefaoninao dia hifandray aminao haingana ny ekipa RAM'S FLARE.",
            "anglais": "Please leave your name and phone number and the RAM'S FLARE team will contact you shortly.",
            "espagnol": "Deja tu nombre y tu numero de telefono y el equipo RAM'S FLARE te contactara rapidamente.",
            "japonais": "お名前と電話番号を残してください。RAM'S FLAREの担当者がすぐにご連絡します。",
            "francais": "Laissez votre nom et votre numero de telephone, et l'equipe RAM'S FLARE vous recontacte rapidement.",
            "meme langue que le message du client": "Laissez votre nom et votre numero de telephone, et l'equipe RAM'S FLARE vous recontacte rapidement.",
        },
    }
    reply_key = "human" if needs_human or intent == "human" else intent if intent in replies else "default"
    by_language = replies.get(reply_key, replies["default"])
    return by_language.get(language, by_language["francais"])


def build_template_sales_reply(
    language: str,
    intent: str,
    customer_message: str,
    media_assets: list[dict[str, Any]] | None = None,
) -> str:
    selected_offer = detect_service_choice_offer(customer_message)
    service_route = detect_service_route(customer_message)
    client_profile = extract_client_profile_answer(customer_message)
    spot_focus = extract_spot_focus_answer(customer_message)
    has_media = bool(media_assets)
    gallery_context = bool(media_assets and len(media_assets) > 1) or wants_company_explanation(customer_message) or (
        intent == "catalogue" and not selected_offer
    )
    if intent == "greeting" and not wants_company_explanation(customer_message) and not wants_service_choice_asset(customer_message):
        replies = {
            "malgache": "Salama. Mila spot pub, film documentaire, livestream multicamera sa offres pub ianao anio ?",
            "anglais": "Hello. What do you need today: an ad spot, a documentary film, a multicamera livestream or our ad offers?",
            "francais": "Bonjour. Vous avez besoin d'un spot pub, d'un film documentaire, d'un livestream multicamera ou de voir nos offres pub ?",
        }
        return replies.get(language, replies["francais"])
    if selected_offer:
        label = str(selected_offer.get("label") or "cette offre")
        description = str(selected_offer.get("description") or "").strip()
        confirmation_score = keyword_score(customer_message, ["oui", "ok", "okay", "je confirme", "confirm", "c'est ca", "c est ca", "marina", "eny", "ie"])
        contact_shared = has_contact_details(customer_message)
        if intent == "offer_details":
            replies = {
                "malgache": f"{label}: offre publicitaire sur mesure misy concept, scenario ary strategie de communication, amin'ny devis. Tianao ve ny handray devis sa hamandrika rendez-vous momba azy ?",
                "anglais": f"{label}: a custom advertising offer with concept, scriptwriting and communication strategy, priced on quote. Would you like a quote or a meeting about it?",
                "francais": f"{label}: offre publicitaire sur mesure avec concept, ecriture de scenario et strategie de communication, sur devis. Vous preferez un devis ou un rendez-vous pour cette offre ?",
            }
            return replies.get(language, replies["francais"])
        if intent in {"appointment", "reservation"}:
            replies = {
                "malgache": f"Eny, azo atao tsara ny miresaka momba ny {label}. Inona ny andro na ora mety aminao indrindra ?",
                "anglais": f"Yes, we can absolutely set up a meeting about {label}. What day or time works best for you?",
                "francais": f"Oui, nous pouvons tout a fait organiser un rendez-vous pour {label}. Quel jour ou quel horaire vous conviendrait le mieux ?",
            }
            return replies.get(language, replies["francais"])
        if contact_shared:
            replies = {
                "malgache": f"Voaray tsara ny contact-nao ho an'ny {label}. Hifandray aminao haingana ny ekipa RAM'S FLARE mba hanohy ny tohiny.",
                "anglais": f"Your contact details for {label} have been received. The RAM'S FLARE team will contact you shortly to continue.",
                "francais": f"Nous avons bien recu vos coordonnees pour {label}. L'equipe RAM'S FLARE vous recontacte rapidement pour la suite.",
            }
            return replies.get(language, replies["francais"])
        if confirmation_score >= 1:
            replies = {
                "malgache": f"Tsara. Mba handrosoana amin'ny {label}, alefaso azafady ny anaranao sy ny nomeraon-telefaoninao.",
                "anglais": f"Perfect. To move forward with {label}, please leave your name and phone number.",
                "francais": f"Parfait. Pour avancer sur {label}, laissez votre nom et votre numero de telephone.",
            }
            return replies.get(language, replies["francais"])
        replies = {
            "malgache": (
                f"Tsara. Afaka miainga amin'ny {label} isika: io tokoa ve ilay offre tianao ?"
            ),
            "anglais": (
                f"Great. We can start with {label}: is that the exact offer you want?"
            ),
            "francais": (
                f"Parfait. Nous pouvons partir sur {label}: c'est bien cette offre que vous voulez ?"
            ),
        }
        return replies.get(language, replies["francais"])
    if intent == "human":
        replies = {
            "malgache": "Mazava. Avelao azafady ny anaranao sy ny nomeraon-telefaoninao dia hifandray aminao haingana ny ekipa RAM'S FLARE.",
            "anglais": "Of course. Please leave your name and phone number and the RAM'S FLARE team will contact you shortly.",
            "francais": "Bien sur. Laissez votre nom et votre numero de telephone, et l'equipe RAM'S FLARE vous recontacte rapidement.",
        }
        return replies.get(language, replies["francais"])
    if gallery_context and wants_company_explanation(customer_message):
        replies = {
            "malgache": (
                "RAM'S FLARE dia agence de communication sy maison de production audiovisuelle eto Madagascar. Manao spot pub, film documentaire ary livestream multicamera izahay, ary efa niasa tamin'ny projets mihoatra ny 300. "
                "Ireto ny offres pub video: iza no mahaliana anao indrindra ?"
            ),
            "anglais": (
                "RAM'S FLARE is a communication agency and audiovisual production house in Madagascar. We produce ad spots, documentary films and multicamera livestreams, with more than 300 projects completed. "
                "Here are our video ad offers: which one interests you most?"
            ),
            "francais": (
                "RAM'S FLARE est une agence de communication et maison de production audiovisuelle a Madagascar. Nous realisons des spots pub, films documentaires et livestreams multicamera, avec plus de 300 projets deja menes. "
                "Voici nos offres de publicites video: laquelle vous attire le plus ?"
            ),
        }
        return replies.get(language, replies["francais"])
    if gallery_context:
        replies = {
            "malgache": (
                "Ireto ny offres pub video. Valio amin'ny laharana na ny anaran'ilay offre tianao hofidina."
            ),
            "anglais": (
                "Here are our video advertising offers. Reply with the number or the name of the offer you want."
            ),
            "francais": (
                "Voici nos offres de publicites video. Repondez avec le numero ou le nom de l'offre que vous voulez."
            ),
        }
        return replies.get(language, replies["francais"])
    if service_route == "livestreaming" and intent in {"service", "pricing"} and client_profile:
        replies = {
            "malgache": "Tsara. Rahoviana no ilainao io livestream multicamera io ?",
            "anglais": "Great. For what date or deadline do you need this multicamera livestream?",
            "francais": "Parfait. Vous avez besoin de ce livestream multicamera pour quelle date ou quel delai ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "livestreaming" and intent in {"service", "pricing"}:
        replies = {
            "malgache": "RAM'S FLARE dia manao livestream multicamera ary efa nahavita projets mihoatra ny 300, anisan'izany ny directs maro. Ho an'ny evenement inona no ilainao azy ?",
            "anglais": "RAM'S FLARE handles multicamera livestreams and has completed more than 300 projects, including several live productions. What kind of event is this for?",
            "francais": "RAM'S FLARE realise des livestreams multicamera et a deja mene plus de 300 projets, dont plusieurs directs. C'est pour quel type d'evenement ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "video_documentaire" and intent in {"service", "pricing"} and client_profile:
        replies = {
            "malgache": "Mazava. Rahoviana no ilainao io projet documentaire io ?",
            "anglais": "Great. When do you want to shoot or launch this documentary project?",
            "francais": "Parfait. C'est pour quand ce projet documentaire ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "video_documentaire" and intent in {"service", "pricing"}:
        replies = {
            "malgache": "RAM'S FLARE dia manao film documentaire sy film institutionnel. Ho an'ny orinasa, ONG sa projet personnel ilay izy ?",
            "anglais": "RAM'S FLARE produces documentary and institutional films. Is it for a business, an NGO or a personal project?",
            "francais": "RAM'S FLARE realise des films documentaires et institutionnels. C'est pour une entreprise, une ONG ou un projet personnel ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "spot_publicitaire" and intent in {"service", "pricing"} and client_profile:
        replies = {
            "malgache": "Tsara. Ho an'ny daty rahoviana no ilainao an'io spot pub io ?",
            "anglais": "Perfect. For what date or deadline do you need this ad spot?",
            "francais": "Parfait. Vous avez besoin de ce spot pub pour quelle date ou quel delai ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "spot_publicitaire" and intent in {"service", "pricing"} and spot_focus:
        replies = {
            "malgache": "Mazava. Ho an'ny orinasa sa projet personnel no anaovana an'io spot io ?",
            "anglais": "Perfect. Is this ad spot for a business or for a personal project?",
            "francais": "Tres bien. Ce spot pub est prevu pour une entreprise ou pour un projet personnel ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "spot_publicitaire" and intent in {"service", "pricing"}:
        replies = {
            "malgache": "RAM'S FLARE dia manao spot pub sy video promotionnelle. Ho an'ny produit, service sa campagne ilay spot ?",
            "anglais": "RAM'S FLARE produces ad spots and promotional videos. Is the spot for a product, a service or a campaign?",
            "francais": "RAM'S FLARE realise des spots publicitaires et videos promotionnelles. Le spot concerne un produit, un service ou une campagne ?",
        }
        return replies.get(language, replies["francais"])
    if service_route and intent == "pricing" and client_profile:
        replies = {
            "malgache": "Tsara. Ho an'ny daty rahoviana no ilainao an'ity projet ity ?",
            "anglais": "Great. What date or deadline do you have in mind for this project?",
            "francais": "Parfait. Vous avez besoin de ce projet pour quelle date ou quel delai ?",
        }
        return replies.get(language, replies["francais"])
    if service_route and intent == "pricing":
        replies = {
            "malgache": "Mba hanomanana devis marina dia mila zavatra iray aloha aho: ho an'ny orinasa sa projet personnel io ?",
            "anglais": "To prepare the right quote, I just need one thing first: is this for a business or a personal project?",
            "francais": "Pour vous orienter vers le bon devis, j'ai juste besoin d'une precision: c'est pour une entreprise ou un projet personnel ?",
        }
        return replies.get(language, replies["francais"])
    if intent == "pricing":
        replies = {
            "malgache": "Mba hanomanana devis marina, spot pub, film documentaire sa livestream multicamera no ilainao ?",
            "anglais": "To prepare the right quote, do you need an ad spot, a documentary film or a multicamera livestream?",
            "francais": "Pour vous preparer le bon devis, vous avez besoin d'un spot pub, d'un film documentaire ou d'un livestream multicamera ?",
        }
        return replies.get(language, replies["francais"])
    if service_route == "livestreaming" and intent == "portfolio":
        replies = {
            "malgache": "Mbola tsy manana video preuve vonona halefa eto izahay ho an'ny livestream, fa efa nanao livestream multicamera maro tao anatin'ny projets mihoatra ny 300. Tianao ve ny handray devis haingana ho an'ny direct-nao ?",
            "anglais": "We do not have a ready proof video here yet for livestream, but RAM'S FLARE has already handled several multicamera livestreams across more than 300 projects. Would you like a quick quote for your live production?",
            "francais": "Nous n'avons pas encore de video de preuve prete ici pour le livestream, mais RAM'S FLARE en a deja realise plusieurs parmi plus de 300 projets. Voulez-vous un devis rapide pour votre direct ?",
        }
        return replies.get(language, replies["francais"])
    if service_route and intent == "portfolio":
        if not has_media:
            replies = {
                "malgache": "Afaka mitarika anao amin'ny preuve mety amin'ny ilainao izahay. Tianao ve ny handray devis haingana sa hazavao vetivety aloha ny projet-nao ?",
                "anglais": "We can guide you with the most relevant proof for your need. Would you like a quick quote, or would you rather tell me your project in one sentence first?",
                "francais": "Nous pouvons vous orienter avec la preuve la plus pertinente pour votre besoin. Vous preferez un devis rapide ou me dire votre projet en une phrase ?",
            }
            return replies.get(language, replies["francais"])
        replies = {
            "malgache": "Alefako ohatra iray mifanaraka amin'ilay service. Tianao ve ny handray devis haingana ho an'io karazana projet io ?",
            "anglais": "I am sending a relevant example for that service. Would you like a quick quote for this type of project?",
            "francais": "Je vous envoie un exemple pertinent pour ce service. Voulez-vous un devis rapide pour ce type de projet ?",
        }
        return replies.get(language, replies["francais"])
    if intent == "portfolio":
        replies = {
            "malgache": "Tianao hojerena ve ny ohatra spot pub sa film documentaire ?",
            "anglais": "Would you like to see an ad spot example or a documentary example?",
            "francais": "Vous voulez voir un exemple de spot pub ou de film documentaire ?",
        }
        return replies.get(language, replies["francais"])
    return ""


def build_quick_replies(
    language: str,
    intent: str,
    customer_message: str,
    media_assets: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    selected_offer = detect_service_choice_offer(customer_message)
    service_route = detect_service_route(customer_message)
    gallery_context = bool(media_assets and len(media_assets) > 1) or wants_company_explanation(customer_message) or (
        intent == "catalogue" and not selected_offer
    )
    if intent == "greeting":
        if language == "malgache":
            return [
                {"title": "Spot pub", "payload": "spot publicitaire"},
                {"title": "Film doc", "payload": "film documentaire"},
                {"title": "Livestream", "payload": "livestream multicamera"},
                {"title": "Offres pub", "payload": "envoyez vos offres"},
            ]
        if language == "anglais":
            return [
                {"title": "Ad spot", "payload": "spot publicitaire"},
                {"title": "Documentary", "payload": "film documentaire"},
                {"title": "Livestream", "payload": "livestream multicamera"},
                {"title": "Offers", "payload": "envoyez vos offres"},
            ]
        return [
            {"title": "Spot pub", "payload": "spot publicitaire"},
            {"title": "Film doc", "payload": "film documentaire"},
            {"title": "Livestream", "payload": "livestream multicamera"},
            {"title": "Offres pub", "payload": "envoyez vos offres"},
        ]
    if selected_offer:
        if language == "malgache":
            return [
                {"title": "Eny io", "payload": f"je confirme {str(selected_offer.get('label') or 'cette offre')}"},
                {"title": "Hangataka devis", "payload": "je veux un devis"},
                {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
            ]
        if language == "anglais":
            return [
                {"title": "Yes that's it", "payload": f"je confirme {str(selected_offer.get('label') or 'cette offre')}"},
                {"title": "Request quote", "payload": "je veux un devis"},
                {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
            ]
        return [
            {"title": "Oui c'est ca", "payload": f"je confirme {str(selected_offer.get('label') or 'cette offre')}"},
            {"title": "Demander devis", "payload": "je veux un devis"},
            {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
        ]
    if gallery_context:
        if language == "anglais":
            return [
                {"title": "Offer 1", "payload": "offre 1"},
                {"title": "Offer 2", "payload": "offre 2"},
                {"title": "Offer 3", "payload": "offre 3"},
                {"title": "Quote", "payload": "je veux un devis"},
            ]
        return [
            {"title": "Offre 1", "payload": "offre 1"},
            {"title": "Offre 2", "payload": "offre 2"},
            {"title": "Offre 3", "payload": "offre 3"},
            {"title": "Devis", "payload": "je veux un devis"},
        ]
    if service_route:
        if service_route == "livestreaming":
            if language == "malgache":
                return [
                    {"title": "Hangataka devis", "payload": "je veux un devis"},
                    {"title": "Hanazava projet", "payload": "tiako hazavaina ny projet-ko"},
                    {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
                ]
            if language == "anglais":
                return [
                    {"title": "Request quote", "payload": "je veux un devis"},
                    {"title": "Explain project", "payload": "i want to explain my project"},
                    {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
                ]
            return [
                {"title": "Demander devis", "payload": "je veux un devis"},
                {"title": "Expliquer projet", "payload": "je veux expliquer mon projet"},
                {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
            ]
        if language == "malgache":
            return [
                {"title": "Hangataka devis", "payload": "je veux un devis"},
                {"title": "Hijery ohatra", "payload": "voir exemples"},
                {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
            ]
        if language == "anglais":
            return [
                {"title": "Request quote", "payload": "je veux un devis"},
                {"title": "See examples", "payload": "voir exemples"},
                {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
            ]
        return [
            {"title": "Demander devis", "payload": "je veux un devis"},
            {"title": "Voir exemples", "payload": "voir exemples"},
            {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
        ]
    if intent == "pricing":
        if language == "anglais":
            return [
                {"title": "Ad spot", "payload": "spot publicitaire"},
                {"title": "Documentary", "payload": "film documentaire"},
                {"title": "Livestream", "payload": "livestream multicamera"},
                {"title": "Offers", "payload": "envoyez vos offres"},
            ]
        return [
            {"title": "Spot pub", "payload": "spot publicitaire"},
            {"title": "Film doc", "payload": "film documentaire"},
            {"title": "Livestream", "payload": "livestream multicamera"},
            {"title": "Offres pub", "payload": "envoyez vos offres"},
        ]
    if intent == "portfolio":
        if language == "anglais":
            return [
                {"title": "Ad spot", "payload": "spot publicitaire"},
                {"title": "Documentary", "payload": "film documentaire"},
                {"title": "Request quote", "payload": "je veux un devis"},
                {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
            ]
        return [
            {"title": "Spot pub", "payload": "spot publicitaire"},
            {"title": "Film doc", "payload": "film documentaire"},
            {"title": "Demander devis", "payload": "je veux un devis"},
            {"title": "RAM'S FLARE", "payload": "parler a l equipe ram's flare"},
        ]
    return []


def reply_implies_offer_gallery(reply_text: str) -> bool:
    normalized = normalize_match_text(reply_text)
    if not normalized:
        return False
    return keyword_score(
        normalized,
        [
            "voici nos offres",
            "je vous envoie nos offres",
            "offres de publicites video",
            "offres publicitaires video",
            "here are our video advertising offers",
            "here are our offers",
            "ireto ny offres",
            "offres misy",
        ],
    ) >= 1


def build_video_fallback_message(language: str, media_asset: dict[str, Any]) -> str:
    label = str(media_asset.get("label") or media_asset.get("service_label") or "cette video").strip()
    source_url = str(media_asset.get("source_url") or media_asset.get("url") or "").strip()
    replies = {
        "malgache": f"Tena mavesatra loatra ity video ity ka alefako amin'ny rohy mivantana aloha: {label} {source_url}".strip(),
        "anglais": f"This video is too large for direct delivery here, so here is the direct link for now: {label} {source_url}".strip(),
        "francais": f"Cette video est trop lourde pour etre envoyee directement ici pour le moment. Voici le lien direct: {label} {source_url}".strip(),
    }
    return replies.get(language, replies["francais"])


def should_notify_telegram(
    psid: str,
    intent: str,
    customer_message: str,
    needs_human: bool,
    order_signal: bool,
    llm_provider: str,
    human_takeover: bool = False,
) -> bool:
    if not str(CONFIG.get("telegram_bot_token") or "").strip() or not str(CONFIG.get("telegram_chat_id") or "").strip():
        return False
    if human_takeover:
        return False
    lower = (customer_message or "").lower()
    important = (
        needs_human
        or order_signal
        or intent in {"pricing", "appointment", "order"}
        or "fallback" in (llm_provider or "").lower()
        or any(x in lower for x in ["devis", "rdv", "rendez-vous", "meeting", "appel", "reservation", "reserver", "responsable"])
    )
    if not important:
        return False
    reason = build_telegram_reason(intent, customer_message, needs_human, order_signal, llm_provider)
    state = get_contact_state(psid)
    last_reason = str(state.get("telegram_last_reason") or "").strip()
    last_notified_at = str(state.get("telegram_last_notified_at") or "").strip()
    if reason and last_reason == reason and last_notified_at:
        try:
            elapsed = (utc_now_dt() - parse_utc(last_notified_at)).total_seconds()
            if elapsed < TELEGRAM_NOTIFY_COOLDOWN_SECONDS:
                return False
        except Exception:
            pass
    return True


def build_telegram_reason(
    intent: str,
    customer_message: str,
    needs_human: bool,
    order_signal: bool,
    llm_provider: str,
) -> str:
    lower = (customer_message or "").lower()
    if "fallback" in (llm_provider or "").lower():
        return "blocage IA"
    if needs_human or intent == "human":
        return "reprise humaine"
    if intent == "reservation" or any(x in lower for x in ["reservation", "reserver", "booking", "book"]):
        return "reservation"
    if intent == "appointment" or any(x in lower for x in ["rdv", "rendez-vous", "meeting", "appel"]):
        return "rendez-vous"
    if intent == "pricing" or "devis" in lower:
        return "devis"
    if order_signal or intent == "order":
        return "commande"
    if intent == "portfolio":
        return "portfolio"
    return "suivi"


def enforce_concise_reply(text: str, prefer_handoff: bool = False) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if not cleaned:
        return cleaned
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    if len(sentences) > 2:
        if prefer_handoff:
            important = [
                sentence.strip()
                for sentence in sentences
                if any(
                    marker in sentence.lower()
                    for marker in ["responsable", "tompon'andraikitra", "equipe", "team", "coordonn", "mail", "mailaka", "laharana", "contact"]
                )
            ]
            selected: list[str] = []
            first_question = next((sentence.strip() for sentence in sentences if "?" in sentence), "")
            if first_question:
                selected.append(first_question)
            for sentence in important:
                if sentence and sentence not in selected:
                    selected.append(sentence)
            cleaned = " ".join(selected[:2]) if selected else " ".join(sentence.strip() for sentence in sentences[:2] if sentence.strip())
        else:
            cleaned = " ".join(sentence.strip() for sentence in sentences[:2] if sentence.strip())
    if len(cleaned) > 280:
        truncated = cleaned[:280]
        cut = max(truncated.rfind(". "), truncated.rfind("? "), truncated.rfind("! "))
        if cut > 120:
            cleaned = truncated[: cut + 1].strip()
        else:
            cleaned = truncated.rstrip() + "..."
    return cleaned


def reply_requests_contact_capture(reply_text: str) -> bool:
    normalized = normalize_match_text(reply_text)
    if not normalized:
        return False
    return keyword_score(
        normalized,
        [
            "numero de telephone",
            "phone number",
            "telephone",
            "numero",
            "laharana",
            "nomeraon telefaonina",
            "nomerao finday",
        ],
    ) >= 1


def adapt_reply_with_contact_memory(
    reply_text: str,
    language: str,
    contact_state: dict[str, Any],
    customer_message: str,
) -> str:
    if not reply_requests_contact_capture(reply_text):
        return reply_text

    customer_intent, _, _, _order_signal, _tags = infer_labels(customer_message)
    normalized_reply = normalize_match_text(reply_text)
    if customer_intent in {"appointment", "reservation"}:
        return reply_text
    if keyword_score(
        normalized_reply,
        [
            "quel jour",
            "quel horaire",
            "quelle heure",
            "what day",
            "what time",
            "andro",
            "ora",
            "daty",
            "rendez vous",
            "meeting",
        ],
    ) >= 1:
        return reply_text

    known_name = str(contact_state.get("contact_name") or "").strip() or " ".join(
        part for part in [str(contact_state.get("first_name") or "").strip(), str(contact_state.get("last_name") or "").strip()] if part
    ).strip()
    known_phone = str(contact_state.get("phone_number") or "").strip()
    selected_offer = detect_service_choice_offer(customer_message) or get_recent_offer_choice(str(contact_state.get("psid") or ""))
    service_route = detect_service_route(customer_message) or get_recent_service_route(str(contact_state.get("psid") or ""))
    service_label = service_route_to_query_label(service_route) if service_route else ""

    if known_name and known_phone:
        if selected_offer:
            label = str(selected_offer.get("label") or "cette offre")
            replies = {
                "malgache": f"Efa voaray ny anaranao sy ny nomeraon-telefaoninao. Tianao ve ny handroso amin'ny devis sa hamandrika rendez-vous momba ny {label} ?",
                "anglais": f"We already have your name and phone number. Would you like to move forward with a quote or schedule a meeting about {label}?",
                "francais": f"Nous avons deja votre nom et votre numero de telephone. Vous preferez avancer avec un devis ou fixer un rendez-vous pour {label} ?",
            }
            return replies.get(language, replies["francais"])
        if service_label:
            replies = {
                "malgache": f"Efa voaray ny anaranao sy ny nomeraon-telefaoninao. Tianao ve ny handroso amin'ny devis sa hanohy eto momba ny {service_label} ?",
                "anglais": f"We already have your name and phone number. Would you like to move forward with a quote or continue here about the {service_label}?",
                "francais": f"Nous avons deja votre nom et votre numero de telephone. Vous preferez avancer avec un devis ou continuer ici pour le {service_label} ?",
            }
            return replies.get(language, replies["francais"])
        replies = {
            "malgache": "Efa voaray ny anaranao sy ny nomeraon-telefaoninao. Inona no tianao hatao manaraka: devis sa rendez-vous ?",
            "anglais": "We already have your name and phone number. What would you like next: a quote or a meeting?",
            "francais": "Nous avons deja votre nom et votre numero de telephone. Quelle est la prochaine etape qui vous convient: devis ou rendez-vous ?",
        }
        return replies.get(language, replies["francais"])

    if known_name and not known_phone:
        replies = {
            "malgache": f"Tsara {known_name}. Mila ny nomeraon-telefaoninao fotsiny aho mba handrosoana.",
            "anglais": f"Perfect {known_name}. I just need your phone number to move forward.",
            "francais": f"Parfait {known_name}. J'ai juste besoin de votre numero de telephone pour avancer.",
        }
        return replies.get(language, replies["francais"])

    if known_phone and not known_name:
        replies = {
            "malgache": "Voaray tsara ny nomeraon-telefaoninao. Azafady, inona ny anaranao ?",
            "anglais": "Your phone number is already noted. What is your name, please?",
            "francais": "Votre numero de telephone est deja note. Quel est votre nom, s'il vous plait ?",
        }
        return replies.get(language, replies["francais"])

    return reply_text


async def ask_sales_model(
    customer_name: str,
    customer_message: str,
    intent: str,
    order_signal: bool,
    needs_human: bool = False,
    recent_context: str = "",
    media_assets: list[dict[str, Any]] | None = None,
    detected_language_override: str = "",
    page_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    google_api_key = CONFIG.get("google_api_key", "").strip()
    model = CONFIG.get("google_genai_model", "gemini-2.5-flash-lite").strip() or "gemini-2.5-flash-lite"
    system_prompt = build_sales_system_prompt(page_context)
    detected_language = str(detected_language_override or "").strip() or detect_customer_language(customer_message)
    selected_offer = detect_service_choice_offer(customer_message)
    fallback_intent = intent
    if selected_offer and intent in {"general", "service", "offer_choice"}:
        fallback_intent = "offer_choice"
    elif wants_company_explanation(customer_message) and not selected_offer:
        fallback_intent = "catalogue"
    elif wants_service_choice_asset(customer_message) and not selected_offer:
        fallback_intent = "catalogue"
    elif media_assets and len(media_assets) > 1:
        fallback_intent = "greeting" if intent == "greeting" else "catalogue"
    fallback_text = build_fallback_reply(detected_language, fallback_intent, needs_human)
    action_hint = build_action_hint(intent, customer_message, order_signal, needs_human)
    handoff_required = requires_responsible_followup(intent, customer_message, order_signal, needs_human)
    service_route = detect_service_route(customer_message)
    media_hint = build_media_hint(media_assets)
    started_at = time.perf_counter()

    def build_result(
        reply_text: str,
        provider: str,
        prompt_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: int = 0,
        estimated_cost_usd: float = 0.0,
    ) -> dict[str, Any]:
        final_handoff = handoff_required or "fallback" in provider
        final_text = ensure_responsible_followup(reply_text.strip() or fallback_text, detected_language, final_handoff)
        final_text = enforce_concise_reply(final_text, prefer_handoff=final_handoff)
        return {
            "reply_text": final_text or fallback_text,
            "llm_provider": provider,
            "llm_model": model,
            "prompt_tokens": int(prompt_tokens or 0),
            "output_tokens": int(output_tokens or 0),
            "total_tokens": int(total_tokens or 0),
            "estimated_cost_usd": float(estimated_cost_usd or 0.0),
            "latency_ms": int((time.perf_counter() - started_at) * 1000),
        }

    template_reply = build_template_sales_reply(detected_language, fallback_intent, customer_message, media_assets)
    if template_reply:
        return build_result(template_reply, "sales_template")

    if google_api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={google_api_key}"

        def build_payload(force_language: bool = False) -> dict[str, Any]:
            language_rule = ""
            if force_language and detected_language != "meme langue que le message du client":
                language_rule = (
                    f"Consigne absolue: reponds uniquement en {detected_language}. "
                    "N'utilise aucune autre langue."
                )
            return {
                "system_instruction": {
                    "parts": [{"text": "\n".join([system_prompt, language_rule]).strip()}],
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": "\n".join(
                                    [
                                        f"Client: {customer_name}",
                                        f"Langue du client detectee: {detected_language}",
                                        f"Type de demande detecte: {intent}",
                                        f"Service probable: {service_route or 'a confirmer'}",
                                        action_hint,
                                        media_hint,
                                        f"Contexte recent: {recent_context or 'aucun'}",
                                        f"Message du client: {customer_message}",
                                    ]
                                )
                            }
                        ],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.35,
                    "topP": 0.9,
                    "topK": 32,
                    "maxOutputTokens": 96,
                },
            }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                total_prompt_tokens = 0
                total_output_tokens = 0
                total_tokens_sum = 0
                estimated_total = 0.0

                for force_language in (False, True):
                    response = await client.post(url, json=build_payload(force_language=force_language))
                    response.raise_for_status()
                    data = response.json()
                    usage = data.get("usageMetadata") or {}
                    prompt_tokens = int(usage.get("promptTokenCount") or 0)
                    output_tokens = int(usage.get("candidatesTokenCount") or 0)
                    total_tokens = int(usage.get("totalTokenCount") or (prompt_tokens + output_tokens))
                    estimated = estimate_cost_usd(model, prompt_tokens, output_tokens)
                    total_prompt_tokens += prompt_tokens
                    total_output_tokens += output_tokens
                    total_tokens_sum += total_tokens
                    estimated_total += estimated
                    candidates = data.get("candidates") or []
                    if candidates:
                        parts = ((candidates[0].get("content") or {}).get("parts") or [])
                        text = "".join(str(part.get("text") or "") for part in parts).strip()
                        if text and response_matches_language(text, detected_language):
                            return build_result(
                                reply_text=text,
                                provider="google_genai",
                                prompt_tokens=total_prompt_tokens,
                                output_tokens=total_output_tokens,
                                total_tokens=total_tokens_sum,
                                estimated_cost_usd=round(estimated_total, 6),
                            )
                return build_result(
                    fallback_text,
                    "google_genai",
                    total_prompt_tokens,
                    total_output_tokens,
                    total_tokens_sum,
                    round(estimated_total, 6),
                )
        except Exception:
            return build_result(fallback_text, "google_genai_fallback")

    return build_result(fallback_text, "local_fallback")


async def send_messenger_reply(
    psid: str,
    text: str,
    quick_replies: list[dict[str, str]] | None = None,
    page_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resolved_page_context = page_context or resolve_page_context()
    access_token = str(resolved_page_context.get("page_access_token") or "").strip()
    if not access_token:
        raise RuntimeError("No Messenger page access token configured.")
    url = (
        f"https://graph.facebook.com/{CONFIG['meta_graph_version']}/me/messages"
        f"?access_token={access_token}"
    )
    message_payload: dict[str, Any] = {"text": text[:2000]}
    if quick_replies:
        prepared_quick_replies = []
        for reply in quick_replies[:13]:
            title = str(reply.get("title") or "").strip()[:20]
            payload = str(reply.get("payload") or title).strip()[:1000]
            if not title or not payload:
                continue
            prepared_quick_replies.append(
                {
                    "content_type": "text",
                    "title": title,
                    "payload": payload,
                }
            )
        if prepared_quick_replies:
            message_payload["quick_replies"] = prepared_quick_replies
    payload = {
        "recipient": {"id": psid},
        "message": message_payload,
        "messaging_type": "RESPONSE",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


class MessengerVideoTooLargeError(Exception):
    pass


async def cache_remote_video_for_messenger(media_url: str) -> str:
    normalized_url = str(media_url or "").strip()
    if not normalized_url:
        return ""

    suffix = Path(urlparse(normalized_url).path).suffix.lower() or ".mp4"
    cache_name = hashlib.sha1(normalized_url.encode("utf-8")).hexdigest() + suffix
    cache_path = MEDIA_CACHE_DIR / cache_name
    if cache_path.exists() and cache_path.is_file() and cache_path.stat().st_size > 0:
        return str(cache_path)

    timeout = httpx.Timeout(REMOTE_VIDEO_DOWNLOAD_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        async with client.stream("GET", normalized_url) as response:
            response.raise_for_status()
            content_length = int(response.headers.get("content-length") or 0)
            if content_length and content_length > MAX_DIRECT_MESSENGER_VIDEO_BYTES:
                raise MessengerVideoTooLargeError(
                    f"Remote video is too large for direct Messenger upload ({content_length} bytes)."
                )
            temp_path = cache_path.with_suffix(cache_path.suffix + ".part")
            downloaded = 0
            with temp_path.open("wb") as binary_file:
                async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    downloaded += len(chunk)
                    if downloaded > MAX_DIRECT_MESSENGER_VIDEO_BYTES:
                        binary_file.close()
                        try:
                            temp_path.unlink()
                        except Exception:
                            pass
                        raise MessengerVideoTooLargeError(
                            f"Remote video exceeded Messenger upload threshold ({downloaded} bytes)."
                        )
                    binary_file.write(chunk)
            temp_path.replace(cache_path)
    return str(cache_path)


async def send_messenger_attachment(
    psid: str,
    attachment_type: str,
    media_url: str,
    local_path: str = "",
    page_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resolved_page_context = page_context or resolve_page_context()
    access_token = str(resolved_page_context.get("page_access_token") or "").strip()
    if not access_token:
        raise RuntimeError("No Messenger page access token configured.")
    url = (
        f"https://graph.facebook.com/{CONFIG['meta_graph_version']}/me/messages"
        f"?access_token={access_token}"
    )
    resolved_local_path = str(local_path or "").strip()
    resolved_media_url = str(media_url or "").strip()
    if attachment_type == "video" and not resolved_local_path and resolved_media_url:
        resolved_local_path = await cache_remote_video_for_messenger(resolved_media_url)

    request_timeout = LOCAL_VIDEO_UPLOAD_TIMEOUT_SECONDS if attachment_type == "video" and resolved_local_path else 20.0
    async with httpx.AsyncClient(timeout=request_timeout) as client:
        file_path = Path(resolved_local_path) if resolved_local_path else None
        if file_path and file_path.exists() and file_path.is_file():
            mime_type = mimetypes.guess_type(str(file_path))[0] or ("video/mp4" if attachment_type == "video" else "image/jpeg")
            with file_path.open("rb") as binary_file:
                response = await client.post(
                    url,
                    data={
                        "recipient": json.dumps({"id": psid}),
                        "message": json.dumps(
                            {
                                "attachment": {
                                    "type": attachment_type,
                                    "payload": {"is_reusable": True},
                                }
                            }
                        ),
                        "messaging_type": "RESPONSE",
                    },
                    files={"filedata": (file_path.name, binary_file, mime_type)},
                )
        else:
            payload = {
                "recipient": {"id": psid},
                "message": {
                    "attachment": {
                        "type": attachment_type,
                        "payload": {
                            "url": resolved_media_url,
                            "is_reusable": True,
                        },
                    }
                },
                "messaging_type": "RESPONSE",
            }
            response = await client.post(url, json=payload)
        if response.is_error:
            detail = response.text[:1000]
            raise httpx.HTTPStatusError(
                f"{response.status_code} while sending Messenger attachment: {detail}",
                request=response.request,
                response=response,
            )
        return response.json()


async def send_messenger_offer_gallery(
    psid: str,
    media_assets: list[dict[str, Any]],
    language: str = "francais",
    page_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resolved_page_context = page_context or resolve_page_context()
    access_token = str(resolved_page_context.get("page_access_token") or "").strip()
    if not access_token:
        raise RuntimeError("No Messenger page access token configured.")
    url = (
        f"https://graph.facebook.com/{CONFIG['meta_graph_version']}/me/messages"
        f"?access_token={access_token}"
    )
    choose_label_by_language = {
        "malgache": "Hisafidy",
        "anglais": "Choose",
        "francais": "Choisir",
    }
    view_label_by_language = {
        "malgache": "Hijery sary",
        "anglais": "View image",
        "francais": "Voir image",
    }
    choose_label = choose_label_by_language.get(language, choose_label_by_language["francais"])
    view_label = view_label_by_language.get(language, view_label_by_language["francais"])
    elements: list[dict[str, Any]] = []
    for asset in media_assets[:10]:
        image_url = str(asset.get("url") or "").strip()
        if not image_url:
            continue
        title = str(asset.get("label") or "Offre RAM'S FLARE").strip()[:80]
        description = re.sub(r"\s+", " ", str(asset.get("description") or "").strip())
        subtitle = description[:80] if description else "Choisissez l'offre qui correspond a votre besoin."
        payload = str(asset.get("label") or asset.get("asset_id") or "Choisir offre").strip()[:1000]
        elements.append(
            {
                "title": title,
                "image_url": image_url,
                "subtitle": subtitle,
                "default_action": {
                    "type": "web_url",
                    "url": image_url,
                    "webview_height_ratio": "full",
                },
                "buttons": [
                    {
                        "type": "postback",
                        "title": choose_label,
                        "payload": payload,
                    },
                    {
                        "type": "web_url",
                        "title": view_label,
                        "url": image_url,
                        "webview_height_ratio": "full",
                    },
                ],
            }
        )
    if not elements:
        raise ValueError("No gallery elements available")
    payload = {
        "recipient": {"id": psid},
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": elements,
                },
            }
        },
        "messaging_type": "RESPONSE",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


def is_service_choice_bundle(media_assets: list[dict[str, Any]] | None) -> bool:
    if not media_assets or len(media_assets) <= 1:
        return False
    return all(
        str(asset.get("attachment_type") or "image") == "image"
        and str(asset.get("service_route") or "") == "service_choice"
        for asset in media_assets
    )


async def send_messenger_offer_catalog(
    psid: str,
    media_assets: list[dict[str, Any]],
    page_context: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for media_asset in media_assets:
        result = await send_messenger_attachment(
            psid,
            str(media_asset.get("attachment_type") or "image"),
            str(media_asset.get("url") or ""),
            str(media_asset.get("local_path") or ""),
            page_context=page_context,
        )
        results.append(result)
    return results


async def notify_telegram(
    psid: str,
    customer_name: str,
    customer_message: str,
    ai_reply: str,
    lead_status: str,
    intent: str,
    needs_human: bool,
    order_signal: bool,
    llm_provider: str,
    human_takeover: bool = False,
) -> None:
    reason = build_telegram_reason(intent, customer_message, needs_human, order_signal, llm_provider)
    problem = build_problem_summary(intent, customer_message, needs_human, order_signal)
    text = "\n".join(
        [
            f"UID: {psid}",
            f"Nom: {customer_name}",
            f"Problème: {problem}",
            f"Type: {reason}",
            f"Mode: {'Humain' if human_takeover else 'Agent'}",
            f"Statut: {lead_status}",
        ]
    )
    await telegram_api_call(
        "sendMessage",
        {
            "chat_id": CONFIG["telegram_chat_id"],
            "text": text[:3900],
            "reply_markup": build_telegram_keyboard(psid, human_takeover),
        },
    )
    remember_telegram_notification(psid, reason)
    try:
        await archive_contact_to_gcs(psid)
    except Exception:
        pass


def save_contact(
    psid: str,
    profile: dict[str, Any],
    customer_message: str,
    intent: str,
    lead_status: str,
    needs_human: bool,
    order_signal: bool,
    tags: str,
    page_context: dict[str, Any] | None = None,
) -> None:
    resolved_page_context = page_context or {}
    page_id = str(resolved_page_context.get("page_id") or "").strip()
    page_name = str(resolved_page_context.get("page_name") or "").strip()
    organization_slug = str(resolved_page_context.get("organization_slug") or "").strip().lower()
    conn = sqlite3.connect(DB_PATH)
    try:
        existing = conn.execute(
            "SELECT contact_name, phone_number, email FROM contacts WHERE psid = ?",
            (psid,),
        ).fetchone()
        existing_contact_name = str(existing[0] or "").strip() if existing else ""
        existing_phone = str(existing[1] or "").strip() if existing else ""
        existing_email = str(existing[2] or "").strip() if existing else ""

        parsed_contact_name = extract_contact_name(customer_message, profile)
        parsed_phone = extract_phone_number(customer_message)
        parsed_email = extract_email_address(customer_message)

        conn.execute(
            """
            INSERT INTO contacts (
                psid, first_name, last_name, contact_name, phone_number, email, profile_pic, last_message,
                intent, lead_status, needs_human, order_signal, tags, last_seen_at, page_id, page_name, organization_slug
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(psid) DO UPDATE SET
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                contact_name = CASE WHEN excluded.contact_name <> '' THEN excluded.contact_name ELSE contacts.contact_name END,
                phone_number = CASE WHEN excluded.phone_number <> '' THEN excluded.phone_number ELSE contacts.phone_number END,
                email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE contacts.email END,
                profile_pic = excluded.profile_pic,
                last_message = excluded.last_message,
                intent = excluded.intent,
                lead_status = excluded.lead_status,
                needs_human = excluded.needs_human,
                order_signal = excluded.order_signal,
                tags = excluded.tags,
                last_seen_at = excluded.last_seen_at,
                page_id = CASE WHEN excluded.page_id <> '' THEN excluded.page_id ELSE contacts.page_id END,
                page_name = CASE WHEN excluded.page_name <> '' THEN excluded.page_name ELSE contacts.page_name END,
                organization_slug = CASE WHEN excluded.organization_slug <> '' THEN excluded.organization_slug ELSE contacts.organization_slug END
            """,
            (
                psid,
                profile.get("first_name", ""),
                profile.get("last_name", ""),
                parsed_contact_name or existing_contact_name,
                parsed_phone or existing_phone,
                parsed_email or existing_email,
                profile.get("profile_pic", ""),
                customer_message,
                intent,
                lead_status,
                1 if needs_human else 0,
                1 if order_signal else 0,
                tags,
                utc_now(),
                page_id,
                page_name,
                organization_slug,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def save_event(
    message_mid: str,
    received_at: str,
    psid: str,
    customer_name: str,
    customer_message: str,
    ai_reply: str,
    intent: str,
    lead_status: str,
    needs_human: bool,
    order_signal: bool,
    tags: str,
    llm_provider: str,
    llm_model: str,
    prompt_tokens: int,
    output_tokens: int,
    total_tokens: int,
    estimated_cost_usd: float,
    latency_ms: int,
    raw_payload: dict[str, Any],
    page_context: dict[str, Any] | None = None,
) -> None:
    resolved_page_context = page_context or {}
    page_id = str(resolved_page_context.get("page_id") or "").strip()
    page_name = str(resolved_page_context.get("page_name") or "").strip()
    organization_slug = str(resolved_page_context.get("organization_slug") or "").strip().lower()
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO events (
                message_mid, received_at, psid, customer_name, customer_message,
                ai_reply, intent, lead_status, needs_human, order_signal, tags,
                llm_provider, llm_model, prompt_tokens, output_tokens, total_tokens,
                estimated_cost_usd, latency_ms, raw_payload, page_id, page_name, organization_slug
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message_mid,
                received_at,
                psid,
                customer_name,
                customer_message,
                ai_reply,
                intent,
                lead_status,
                1 if needs_human else 0,
                1 if order_signal else 0,
                tags,
                llm_provider,
                llm_model,
                int(prompt_tokens or 0),
                int(output_tokens or 0),
                int(total_tokens or 0),
                float(estimated_cost_usd or 0.0),
                int(latency_ms or 0),
                json.dumps(raw_payload, ensure_ascii=False),
                page_id,
                page_name,
                organization_slug,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def fetch_events_for_range(
    hours: int | None = None,
    limit: int | None = None,
    organization_slug: str | None = None,
) -> list[sqlite3.Row]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        query = """
            SELECT received_at, customer_name, customer_message, ai_reply, lead_status, intent,
                   needs_human, order_signal, llm_provider, llm_model, prompt_tokens,
                   output_tokens, total_tokens, estimated_cost_usd, latency_ms, page_id, page_name, organization_slug
            FROM events
        """
        params: list[Any] = []
        conditions: list[str] = []
        if organization_slug:
            conditions.append("organization_slug = ?")
            params.append(str(organization_slug).strip().lower())
        if hours is not None:
            since = (dt.datetime.utcnow() - dt.timedelta(hours=hours)).replace(microsecond=0).isoformat() + "Z"
            conditions.append("received_at >= ?")
            params.append(since)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY received_at DESC"
        if limit is not None:
            query += f" LIMIT {int(limit)}"
        return conn.execute(query, tuple(params)).fetchall()
    finally:
        conn.close()


def build_events_csv(rows: list[sqlite3.Row]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "received_at",
            "customer_name",
            "customer_message",
            "ai_reply",
            "lead_status",
            "intent",
            "needs_human",
            "order_signal",
            "llm_provider",
            "llm_model",
            "prompt_tokens",
            "output_tokens",
            "total_tokens",
            "estimated_cost_usd",
            "latency_ms",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["received_at"],
                row["customer_name"],
                row["customer_message"],
                row["ai_reply"],
                row["lead_status"],
                row["intent"],
                int(row["needs_human"] or 0),
                int(row["order_signal"] or 0),
                row["llm_provider"],
                row["llm_model"],
                int(row["prompt_tokens"] or 0),
                int(row["output_tokens"] or 0),
                int(row["total_tokens"] or 0),
                float(row["estimated_cost_usd"] or 0.0),
                int(row["latency_ms"] or 0),
            ]
        )
    return output.getvalue()


def fetch_period_stats(organization_slug: str | None = None) -> dict[str, dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        today = dt.datetime.utcnow().date()
        week_start = today - dt.timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        if organization_slug:
            def query_from_events(start_day: str | None = None) -> dict[str, Any]:
                sql = """
                    SELECT
                        COUNT(*) AS message_count,
                        COALESCE(SUM(total_tokens), 0) AS total_tokens,
                        COALESCE(SUM(estimated_cost_usd), 0) AS total_cost_usd,
                        COALESCE(SUM(CASE WHEN needs_human = 1 THEN 1 ELSE 0 END), 0) AS needs_human_count,
                        COALESCE(SUM(CASE WHEN order_signal = 1 THEN 1 ELSE 0 END), 0) AS order_signal_count,
                        COALESCE(SUM(CASE WHEN intent = 'pricing' THEN 1 ELSE 0 END), 0) AS pricing_count
                    FROM events
                    WHERE organization_slug = ?
                """
                params: list[Any] = [str(organization_slug).strip().lower()]
                if start_day:
                    sql += " AND substr(received_at, 1, 10) >= ?"
                    params.append(start_day)
                row = conn.execute(sql, tuple(params)).fetchone()
                return dict(row) if row else {}

            return {
                "today": query_from_events(today.isoformat()),
                "week": query_from_events(week_start.isoformat()),
                "month": query_from_events(month_start.isoformat()),
                "all": query_from_events(),
            }

        def query(start_day: str | None = None) -> dict[str, Any]:
            sql = """
                SELECT
                    COALESCE(SUM(message_count), 0) AS message_count,
                    COALESCE(SUM(total_tokens), 0) AS total_tokens,
                    COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd,
                    COALESCE(SUM(needs_human_count), 0) AS needs_human_count,
                    COALESCE(SUM(order_signal_count), 0) AS order_signal_count,
                    COALESCE(SUM(pricing_count), 0) AS pricing_count
                FROM daily_stats
            """
            params: tuple[Any, ...] = ()
            if start_day:
                sql += " WHERE day_key >= ?"
                params = (start_day,)
            row = conn.execute(sql, params).fetchone()
            return dict(row) if row else {}

        return {
            "today": query(today.isoformat()),
            "week": query(week_start.isoformat()),
            "month": query(month_start.isoformat()),
            "all": query(),
        }
    finally:
        conn.close()


def fetch_dashboard_conversations(
    limit: int | None = None,
    history_limit: int = 4,
    organization_slug: str | None = None,
) -> list[dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        query = """
            SELECT
                psid, first_name, last_name, profile_pic, last_message, intent, lead_status,
                needs_human, order_signal, human_takeover, tags, last_seen_at, page_id, page_name, organization_slug
            FROM contacts
        """
        params: list[Any] = []
        if organization_slug:
            query += " WHERE organization_slug = ?"
            params.append(str(organization_slug).strip().lower())
        query += " ORDER BY last_seen_at DESC"
        if limit is not None:
            query += f" LIMIT {int(limit)}"
        contacts = conn.execute(query, tuple(params)).fetchall()
        conversations: list[dict[str, Any]] = []
        for contact in contacts:
            history_params: list[Any] = [str(contact["psid"] or "")]
            history_query = """
                SELECT received_at, customer_message, ai_reply, lead_status, intent, total_tokens, estimated_cost_usd, page_id, page_name, organization_slug
                FROM events
                WHERE psid = ?
            """
            if organization_slug:
                history_query += " AND organization_slug = ?"
                history_params.append(str(organization_slug).strip().lower())
            history_query += """
                ORDER BY received_at DESC
                LIMIT ?
            """
            history_params.append(int(history_limit))
            history = conn.execute(
                history_query,
                tuple(history_params),
            ).fetchall()
            conversations.append(
                {
                    "contact": dict(contact),
                    "history": [dict(row) for row in history],
                }
            )
        return conversations
    finally:
        conn.close()


def build_dashboard_state(history_limit: int = 4, organization_slug: str | None = None) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    since_24h = (dt.datetime.utcnow() - dt.timedelta(hours=24)).replace(microsecond=0).isoformat() + "Z"
    try:
        summary_where = ""
        summary_params: list[Any] = []
        if organization_slug:
            summary_where = "WHERE organization_slug = ?"
            summary_params.append(str(organization_slug).strip().lower())

        summary = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_messages,
                SUM(CASE WHEN needs_human = 1 THEN 1 ELSE 0 END) AS needs_human_count,
                SUM(CASE WHEN order_signal = 1 THEN 1 ELSE 0 END) AS order_signal_count,
                SUM(CASE WHEN intent = 'pricing' THEN 1 ELSE 0 END) AS pricing_count,
                SUM(COALESCE(prompt_tokens, 0)) AS prompt_tokens,
                SUM(COALESCE(output_tokens, 0)) AS output_tokens,
                SUM(COALESCE(total_tokens, 0)) AS total_tokens,
                SUM(COALESCE(estimated_cost_usd, 0)) AS total_cost,
                AVG(COALESCE(latency_ms, 0)) AS avg_latency_ms
                FROM events
                {summary_where}
            """,
            tuple(summary_params),
        ).fetchone()

        summary_24h_conditions = list(summary_params)
        summary_24h_where = []
        if organization_slug:
            summary_24h_where.append("organization_slug = ?")
        summary_24h_where.append("received_at >= ?")
        summary_24h_conditions.append(since_24h)
        summary_24h = conn.execute(
            f"""
            SELECT
                COUNT(*) AS messages_24h,
                SUM(CASE WHEN needs_human = 1 THEN 1 ELSE 0 END) AS needs_human_24h,
                SUM(CASE WHEN order_signal = 1 THEN 1 ELSE 0 END) AS order_signal_24h,
                SUM(COALESCE(total_tokens, 0)) AS total_tokens_24h,
                SUM(COALESCE(estimated_cost_usd, 0)) AS total_cost_24h
            FROM events
            WHERE {" AND ".join(summary_24h_where)}
            """,
            tuple(summary_24h_conditions),
        ).fetchone()

        contacts_sql = """
            SELECT
                COUNT(*) AS total_contacts,
                SUM(CASE WHEN human_takeover = 1 THEN 1 ELSE 0 END) AS human_takeover_count
            FROM contacts
        """
        contacts_params: list[Any] = []
        if organization_slug:
            contacts_sql += " WHERE organization_slug = ?"
            contacts_params.append(str(organization_slug).strip().lower())
        contacts_count = conn.execute(
            contacts_sql,
            tuple(contacts_params),
        ).fetchone()

        attention_where = ["needs_human = 1 OR order_signal = 1 OR intent = 'pricing'"]
        attention_params: list[Any] = []
        if organization_slug:
            attention_where.insert(0, "organization_slug = ?")
            attention_params.append(str(organization_slug).strip().lower())
        attention_events = conn.execute(
            f"""
            SELECT received_at, customer_name, customer_message, lead_status, intent,
                   needs_human, order_signal, total_tokens, estimated_cost_usd, psid, page_id, page_name, organization_slug
            FROM events
            WHERE {" AND ".join(attention_where)}
            ORDER BY received_at DESC
            LIMIT 12
            """,
            tuple(attention_params),
        ).fetchall()

        events_sql = """
            SELECT received_at, customer_name, customer_message, ai_reply, lead_status, intent,
                   needs_human, order_signal, llm_provider, llm_model, total_tokens, estimated_cost_usd, latency_ms, psid, page_id, page_name, organization_slug
            FROM events
        """
        events_params: list[Any] = []
        if organization_slug:
            events_sql += " WHERE organization_slug = ?"
            events_params.append(str(organization_slug).strip().lower())
        events_sql += " ORDER BY received_at DESC LIMIT 25"
        events = conn.execute(
            events_sql,
            tuple(events_params),
        ).fetchall()
    finally:
        conn.close()

    summary = summary or {}
    summary_24h = summary_24h or {}
    contacts_count = contacts_count or {}
    period_stats = fetch_period_stats(organization_slug=organization_slug)
    conversations = fetch_dashboard_conversations(history_limit=history_limit, organization_slug=organization_slug)
    archive_status = "Archive 24h active" if archive_bucket_name() else "Archive 24h non configuree"
    avg_cost_per_message = (
        float(summary["total_cost"] or 0.0) / max(int(summary["total_messages"] or 0), 1)
        if int(summary["total_messages"] or 0)
        else 0.0
    )
    avg_tokens_per_message = (
        int(summary["total_tokens"] or 0) / max(int(summary["total_messages"] or 0), 1)
        if int(summary["total_messages"] or 0)
        else 0.0
    )

    summary_cards = [
        {
            "label": "Messages",
            "value": format_int(summary["total_messages"]),
            "sublabel": f"{format_int(summary_24h['messages_24h'])} sur 24h",
            "accent": "orange",
        },
        {
            "label": "Contacts",
            "value": format_int(contacts_count["total_contacts"]),
            "sublabel": "Clients enregistres",
            "accent": "neutral",
        },
        {
            "label": "Mode Humain",
            "value": format_int(contacts_count["human_takeover_count"]),
            "sublabel": "Contacts repris a la main",
            "accent": "neutral",
        },
        {
            "label": "A Reprendre",
            "value": format_int(summary["needs_human_count"]),
            "sublabel": f"{format_int(summary_24h['needs_human_24h'])} sur 24h",
            "accent": "orange",
        },
        {
            "label": "Prets A Acheter",
            "value": format_int(summary["order_signal_count"]),
            "sublabel": f"{format_int(summary_24h['order_signal_24h'])} sur 24h",
            "accent": "orange",
        },
        {
            "label": "Demandes De Prix",
            "value": format_int(summary["pricing_count"]),
            "sublabel": "Clients a qualifier",
            "accent": "orange",
        },
        {
            "label": "Temps Moyen",
            "value": format_ms(summary["avg_latency_ms"]),
            "sublabel": "Reponse IA",
            "accent": "navy",
        },
        {
            "label": "Tokens Totaux",
            "value": format_int(summary["total_tokens"]),
            "sublabel": f"{format_int(summary_24h['total_tokens_24h'])} sur 24h",
            "accent": "navy",
        },
        {
            "label": "Cout Total",
            "value": format_money(summary["total_cost"]),
            "sublabel": f"{format_money(summary_24h['total_cost_24h'])} sur 24h",
            "accent": "navy",
        },
        {
            "label": "Cout Moyen",
            "value": format_money(avg_cost_per_message),
            "sublabel": "Par message",
            "accent": "navy",
        },
        {
            "label": "Tokens Par Message",
            "value": format_int(avg_tokens_per_message),
            "sublabel": "Moyenne",
            "accent": "navy",
        },
    ]

    period_rows = [
        {
            "label": label,
            "messages": int(values.get("message_count") or 0),
            "tokens": int(values.get("total_tokens") or 0),
            "costUsd": float(values.get("total_cost_usd") or 0.0),
            "costLabel": format_money(values.get("total_cost_usd")),
            "quotes": int(values.get("pricing_count") or 0),
            "purchases": int(values.get("order_signal_count") or 0),
            "needsHuman": int(values.get("needs_human_count") or 0),
        }
        for label, values in [
            ("Aujourd'hui", period_stats.get("today", {})),
            ("Cette semaine", period_stats.get("week", {})),
            ("Ce mois-ci", period_stats.get("month", {})),
            ("Depuis le debut", period_stats.get("all", {})),
        ]
    ]

    priority_queue = []
    for row in attention_events:
        mode = "Humain" if bool(get_contact_state(str(row["psid"] or "")).get("human_takeover") or 0) else "Agent"
        priority_queue.append(
            {
                "time": str(row["received_at"] or ""),
                "priority": (
                    "A reprendre"
                    if int(row["needs_human"] or 0)
                    else "Pret a acheter"
                    if int(row["order_signal"] or 0)
                    else "Demande de prix"
                ),
                "customer": str(row["customer_name"] or "Client"),
                "message": str(row["customer_message"] or ""),
                "status": str(row["lead_status"] or ""),
                "mode": mode,
                "tokens": int(row["total_tokens"] or 0),
                "costUsd": float(row["estimated_cost_usd"] or 0.0),
                "costLabel": format_money(row["estimated_cost_usd"]),
            }
        )

    conversation_cards: list[dict[str, Any]] = []
    for item in conversations:
        contact = item["contact"]
        history = item["history"]
        psid = str(contact.get("psid") or "")
        first_name = str(contact.get("first_name") or "").strip()
        last_name = str(contact.get("last_name") or "").strip()
        display_name = " ".join(part for part in [first_name, last_name] if part).strip() or "Client"
        human_takeover = bool(contact.get("human_takeover") or 0)
        conversation_cards.append(
            {
                "psid": psid or display_name,
                "customer": display_name,
                "status": str(contact.get("lead_status") or ""),
                "mode": "human" if human_takeover else "agent",
                "humanTakeover": human_takeover,
                "lastMessage": str(contact.get("last_message") or ""),
                "availableModes": ["agent"] if human_takeover else ["human"],
                "exchanges": [
                    {
                        "time": str(row.get("received_at") or ""),
                        "customerMessage": str(row.get("customer_message") or ""),
                        "agentReply": str(row.get("ai_reply") or ""),
                    }
                    for row in history
                ],
            }
        )

    last_updated = (
        str(events[0]["received_at"] or "")
        if events
        else str(priority_queue[0]["time"] or "")
        if priority_queue
        else utc_now()
    )

    return {
        "summary": summary_cards,
        "periodStats": period_rows,
        "priorityQueue": priority_queue,
        "conversations": conversation_cards,
        "archiveStatus": archive_status,
        "lastUpdated": last_updated,
    }


def signature_is_valid(raw_body: bytes, signature: str) -> bool:
    secret = CONFIG.get("meta_app_secret", "")
    if not secret:
        LOGGER.error("META_APP_SECRET is missing. Rejecting unsigned Messenger webhook.")
        return False
    if not signature:
        LOGGER.warning("Missing Messenger webhook signature.")
        return False
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def process_message(payload: dict[str, Any]) -> None:
    entry = (payload.get("entry") or [{}])[0]
    for messaging in entry.get("messaging", []):
        if messaging.get("delivery") or messaging.get("read"):
            continue
        if messaging.get("message", {}).get("is_echo"):
            continue

        psid = str(messaging.get("sender", {}).get("id", "")).strip()
        raw_customer_message = (
            messaging.get("message", {}).get("text")
            or messaging.get("message", {}).get("quick_reply", {}).get("payload")
            or messaging.get("postback", {}).get("title")
            or messaging.get("postback", {}).get("payload")
            or ""
        ).strip()
        if not psid or not raw_customer_message:
            continue

        message_mid = (
            messaging.get("message", {}).get("mid")
            or messaging.get("postback", {}).get("mid")
            or f"{psid}_{int(dt.datetime.utcnow().timestamp())}"
        )
        page_context = extract_page_context(payload, messaging)
        if not bool(page_context.get("is_active")):
            LOGGER.info(
                "incoming ignored page_off page_id=%s psid=%s",
                str(page_context.get("page_id") or "").strip(),
                psid,
            )
            continue
        if not str(page_context.get("page_access_token") or "").strip():
            LOGGER.warning(
                "incoming ignored missing_page_token page_id=%s psid=%s",
                str(page_context.get("page_id") or "").strip(),
                psid,
            )
            continue
        received_at = utc_now()
        contact_state = get_contact_state(psid)
        dialog_state = get_recent_dialog_state(psid)
        customer_message = contextualize_customer_message(psid, raw_customer_message, dialog_state=dialog_state)
        intent, lead_status, needs_human, order_signal, tags = infer_labels(customer_message)
        profile = await get_profile(psid, page_context=page_context)
        effective_contact_state = build_effective_contact_state(contact_state, profile, raw_customer_message, psid)
        customer_name = (
            str(effective_contact_state.get("contact_name") or "").strip()
            or str(effective_contact_state.get("first_name") or "").strip()
            or str(profile.get("first_name") or "").strip()
            or "Client"
        )
        recent_context = get_recent_exchange_context(psid)
        media_assets = pick_catalog_assets(intent, customer_message, psid, raw_customer_message=raw_customer_message)
        detected_language = detect_customer_language(raw_customer_message) or detect_customer_language(customer_message)
        previous_customer_message = str(dialog_state.get("last_customer_message") or "").strip()
        previous_language = detect_customer_language(previous_customer_message)
        previous_reply_language = detect_customer_language(str(dialog_state.get("last_ai_reply") or "").strip())
        if is_language_neutral_message(raw_customer_message) and previous_language and previous_language != "meme langue que le message du client":
            detected_language = previous_language
        elif is_language_neutral_message(raw_customer_message) and previous_reply_language and previous_reply_language != "meme langue que le message du client":
            detected_language = previous_reply_language
        elif detected_language == "meme langue que le message du client" and previous_language and previous_language != "meme langue que le message du client":
            detected_language = previous_language
        elif detected_language == "meme langue que le message du client" and previous_reply_language and previous_reply_language != "meme langue que le message du client":
            detected_language = previous_reply_language
        quick_replies = build_quick_replies(detected_language, intent, customer_message, media_assets)
        human_takeover = bool(effective_contact_state.get("human_takeover") or 0)
        LOGGER.info(
            "incoming message psid=%s raw=%r normalized=%r pending=%s intent=%s service_route=%s assets=%s",
            psid,
            raw_customer_message,
            customer_message,
            str(dialog_state.get("pending_question") or ""),
            intent,
            detect_service_route(customer_message),
            len(media_assets),
        )
        if human_takeover:
            needs_human = True
            lead_status = "support"
            tags = ", ".join(x for x in [intent, lead_status, "human", "manual"] if x)
            ai_result = {
                "reply_text": "",
                "llm_provider": "human_takeover",
                "llm_model": "",
                "prompt_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0.0,
                "latency_ms": 0,
            }
            ai_reply = ""
        else:
            ai_result = await ask_sales_model(
                customer_name,
                customer_message,
                intent,
                order_signal,
                needs_human,
                recent_context=recent_context,
                media_assets=media_assets,
                detected_language_override=detected_language,
                page_context=page_context,
            )
            ai_reply = str(ai_result.get("reply_text") or "").strip()
            if not media_assets and reply_implies_offer_gallery(ai_reply):
                media_assets = pick_catalog_assets("catalogue", "offres", psid, raw_customer_message="offres")
                quick_replies = build_quick_replies(detected_language, "catalogue", "offres", media_assets)
                LOGGER.info(
                    "forced offer gallery from reply psid=%s raw=%r normalized=%r assets=%s",
                    psid,
                    raw_customer_message,
                    customer_message,
                    len(media_assets),
                )
            media_send_failed = False
            should_send_gallery = False
            video_fallback_sent = False
            if media_assets:
                should_send_gallery = is_service_choice_bundle(media_assets)
                if should_send_gallery:
                    try:
                        await send_messenger_offer_gallery(psid, media_assets, detected_language, page_context=page_context)
                        LOGGER.info("messenger offer catalog sent psid=%s count=%s", psid, len(media_assets))
                    except Exception as exc:
                        media_send_failed = True
                        LOGGER.warning(
                            "messenger offer catalog failed psid=%s count=%s error=%s",
                            psid,
                            len(media_assets),
                            repr(exc),
                        )
                if not should_send_gallery or media_send_failed:
                    media_send_failed = False
                    for media_asset in media_assets:
                        try:
                            await send_messenger_attachment(
                                psid,
                                str(media_asset.get("attachment_type") or "image"),
                                str(media_asset.get("url") or ""),
                                str(media_asset.get("local_path") or ""),
                                page_context=page_context,
                            )
                        except MessengerVideoTooLargeError as exc:
                            media_send_failed = True
                            LOGGER.warning(
                                "messenger video too large psid=%s asset=%s error=%s",
                                psid,
                                str(media_asset.get("asset_id") or ""),
                                repr(exc),
                            )
                            video_fallback_sent = True
                            fallback_text = build_video_fallback_message(detected_language, media_asset)
                            try:
                                await send_messenger_reply(psid, fallback_text, page_context=page_context)
                            except Exception:
                                pass
                        except Exception as exc:
                            media_send_failed = True
                            LOGGER.warning(
                                "messenger media send failed psid=%s asset=%s type=%s url=%s local_path=%s error=%s",
                                psid,
                                str(media_asset.get("asset_id") or ""),
                                str(media_asset.get("attachment_type") or ""),
                                str(media_asset.get("url") or ""),
                                str(media_asset.get("local_path") or ""),
                            repr(exc),
                        )
            if video_fallback_sent and intent == "portfolio":
                fallback_cta_by_language = {
                    "malgache": "Te handray devis haingana ho an'io karazana projet io ve ianao ?",
                    "anglais": "Would you like a quick quote for this type of project?",
                    "francais": "Voulez-vous un devis rapide pour ce type de projet ?",
                }
                ai_reply = fallback_cta_by_language.get(detected_language, fallback_cta_by_language["francais"])
            if should_send_gallery:
                gallery_reply = build_template_sales_reply(detected_language, intent, customer_message, media_assets)
                if gallery_reply:
                    ai_reply = gallery_reply
            if should_send_gallery and media_send_failed:
                ai_reply = ai_reply.replace(
                    "Voici nos offres de publicites video",
                    "Je vous ai prepare nos offres de publicites video",
                )
            ai_reply = adapt_reply_with_contact_memory(
                ai_reply,
                detected_language,
                effective_contact_state,
                customer_message,
            )
            try:
                await send_messenger_reply(psid, ai_reply, quick_replies=quick_replies, page_context=page_context)
            except Exception:
                ai_reply = f"{ai_reply}\n\n[Note interne: echec d'envoi Messenger]"
            if media_send_failed:
                ai_reply = f"{ai_reply}\n\n[Note interne: echec partiel d'envoi media]"

        save_contact(
            psid,
            profile,
            raw_customer_message,
            intent,
            lead_status,
            needs_human,
            order_signal,
            tags,
            page_context=page_context,
        )
        try:
            await archive_contact_to_gcs(psid)
        except Exception:
            pass
        event_record = {
            "message_mid": message_mid,
            "received_at": received_at,
            "psid": psid,
            "customer_name": customer_name,
            "customer_message": raw_customer_message,
            "ai_reply": ai_reply,
            "intent": intent,
            "lead_status": lead_status,
            "needs_human": needs_human,
            "order_signal": order_signal,
            "human_takeover": human_takeover,
            "tags": tags,
            "llm_provider": str(ai_result.get("llm_provider") or ""),
            "llm_model": str(ai_result.get("llm_model") or ""),
            "prompt_tokens": int(ai_result.get("prompt_tokens") or 0),
            "output_tokens": int(ai_result.get("output_tokens") or 0),
            "total_tokens": int(ai_result.get("total_tokens") or 0),
            "estimated_cost_usd": float(ai_result.get("estimated_cost_usd") or 0.0),
            "latency_ms": int(ai_result.get("latency_ms") or 0),
            "page_id": str(page_context.get("page_id") or ""),
            "page_name": str(page_context.get("page_name") or ""),
            "organization_slug": str(page_context.get("organization_slug") or ""),
            "raw_payload": payload,
        }
        save_event(
            event_record["message_mid"],
            event_record["received_at"],
            event_record["psid"],
            event_record["customer_name"],
            event_record["customer_message"],
            event_record["ai_reply"],
            event_record["intent"],
            event_record["lead_status"],
            bool(event_record["needs_human"]),
            bool(event_record["order_signal"]),
            event_record["tags"],
            event_record["llm_provider"],
            event_record["llm_model"],
            int(event_record["prompt_tokens"]),
            int(event_record["output_tokens"]),
            int(event_record["total_tokens"]),
            float(event_record["estimated_cost_usd"]),
            int(event_record["latency_ms"]),
            payload,
            page_context=page_context,
        )
        day_key = daily_key_from_received_at(event_record["received_at"])
        upsert_daily_stats(
            day_key,
            1,
            1 if bool(event_record["needs_human"]) else 0,
            1 if bool(event_record["order_signal"]) else 0,
            1 if str(event_record["intent"]) == "pricing" else 0,
            int(event_record["prompt_tokens"]),
            int(event_record["output_tokens"]),
            int(event_record["total_tokens"]),
            float(event_record["estimated_cost_usd"]),
            int(event_record["latency_ms"]),
        )
        try:
            await archive_event_to_gcs(event_record)
        except Exception:
            pass
        try:
            await archive_daily_stats_to_gcs(day_key)
        except Exception:
            pass

        try:
            llm_provider = str(ai_result.get("llm_provider") or "")
            if should_notify_telegram(psid, intent, customer_message, needs_human, order_signal, llm_provider, human_takeover):
                await notify_telegram(
                    psid,
                    customer_name,
                    customer_message,
                    ai_reply,
                    lead_status,
                    intent,
                    needs_human,
                    order_signal,
                    llm_provider,
                    human_takeover,
                )
        except Exception:
            pass
        asyncio.create_task(safe_sync_google_sheet_for_event(event_record, day_key))


def apply_takeover_to_message(text: str, enabled: bool) -> str:
    lines = [line for line in (text or "").splitlines() if line.strip()]
    updated = []
    mode_written = False
    for line in lines:
        if line.startswith("Mode:"):
            updated.append(f"Mode: {'Humain' if enabled else 'Agent'}")
            mode_written = True
        else:
            updated.append(line)
    if not mode_written:
        updated.append(f"Mode: {'Humain' if enabled else 'Agent'}")
    return "\n".join(updated)


async def answer_telegram_callback(callback_query_id: str, text: str) -> None:
    await telegram_api_call("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text[:180]})


async def update_telegram_message_controls(chat_id: str | int, message_id: int, text: str, psid: str, enabled: bool) -> None:
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": apply_takeover_to_message(text, enabled)[:3900],
        "reply_markup": build_telegram_keyboard(psid, enabled),
    }
    await telegram_api_call("editMessageText", payload)


@app.post("/webhook/telegram")
async def telegram_webhook(request: Request) -> JSONResponse:
    update = await request.json()
    callback = update.get("callback_query") or {}
    data = str(callback.get("data") or "").strip()
    callback_query_id = str(callback.get("id") or "").strip()
    message = callback.get("message") or {}
    if not data or ":" not in data or not callback_query_id:
        return JSONResponse({"ok": True})
    action, psid = data.split(":", 1)
    enabled = action == "takeover"
    if action not in {"takeover", "release"} or not psid:
        await answer_telegram_callback(callback_query_id, "Action invalide.")
        return JSONResponse({"ok": True})
    current_state = get_contact_state(psid)
    current_enabled = bool(current_state.get("human_takeover") or 0)
    if enabled and current_enabled:
        await answer_telegram_callback(callback_query_id, "La reprise humaine est deja active.")
        return JSONResponse({"ok": True})
    if not enabled and not current_enabled:
        await answer_telegram_callback(callback_query_id, "L'agent gere deja ce contact.")
        return JSONResponse({"ok": True})
    set_contact_takeover(psid, enabled)
    try:
        await archive_contact_to_gcs(psid)
    except Exception:
        pass
    asyncio.create_task(safe_sync_google_sheet_for_contact(psid))
    await answer_telegram_callback(
        callback_query_id,
        "Reprise humaine activée." if enabled else "L'agent reprend la main.",
    )
    try:
        await update_telegram_message_controls(
            message.get("chat", {}).get("id"),
            int(message.get("message_id")),
            str(message.get("text") or ""),
            psid,
            enabled,
        )
    except Exception:
        pass
    return JSONResponse({"ok": True})


@app.get("/", response_class=HTMLResponse)
async def root() -> str:
    return "<html><body><h1>Messenger Direct Service</h1><p>OK</p><p>Le cockpit interne est maintenant disponible uniquement via FLARE AI.</p></body></html>"


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "messenger-direct",
        "environment": str(CONFIG.get("app_env") or "development"),
    }


@app.get("/privacy-policy", response_class=HTMLResponse)
async def privacy_policy() -> str:
    return """
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RAM'S FLARE Privacy Policy</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; background: #0f1115; color: #f5f7fb; }
          .wrap { max-width: 900px; margin: 0 auto; padding: 40px 24px 60px; }
          h1, h2 { color: #ffffff; }
          p, li { color: #d8dee9; line-height: 1.6; }
          .card { background: #171b22; border: 1px solid #2a3140; border-radius: 16px; padding: 24px; margin-top: 24px; }
          a { color: #8ec5ff; }
          .muted { color: #9aa4b2; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Privacy Policy</h1>
          <p class="muted">Last updated: March 26, 2026</p>

          <div class="card">
            <p>RAM'S FLARE provides customer communication services, including automated responses to incoming Facebook Messenger conversations for business support and lead handling.</p>
            <p>This page explains what data may be processed when a user contacts RAM'S FLARE through Messenger and related channels.</p>
          </div>

          <div class="card">
            <h2>Information We Process</h2>
            <ul>
              <li>Public profile information made available through Meta for Messenger conversations, such as first name, last name, and profile picture.</li>
              <li>Messages voluntarily sent by users to our Facebook Page.</li>
              <li>Operational metadata related to message handling, such as timestamps, internal lead status, escalation status, and response logs.</li>
            </ul>
          </div>

          <div class="card">
            <h2>How We Use Information</h2>
            <ul>
              <li>To receive and answer user-initiated Messenger conversations.</li>
              <li>To provide customer support, lead qualification, and business follow-up.</li>
              <li>To notify internal team members when human intervention is required.</li>
              <li>To improve service quality, internal monitoring, and operational continuity.</li>
            </ul>
          </div>

          <div class="card">
            <h2>Data Sharing</h2>
            <p>We do not sell personal data. Information may be processed by service providers used to operate our messaging workflow, hosting infrastructure, internal dashboards, and communication tools, only as needed to provide the service.</p>
          </div>

          <div class="card">
            <h2>Data Retention</h2>
            <p>Conversation and operational records are retained only for business, support, security, and service management purposes, and only for as long as reasonably necessary.</p>
          </div>

          <div class="card">
            <h2>User Rights and Requests</h2>
            <p>If you want to request access, correction, or deletion of information related to your conversation with RAM'S FLARE, you can contact us at <a href="mailto:ramsflare@gmail.com">ramsflare@gmail.com</a>.</p>
          </div>

          <div class="card">
            <h2>Contact</h2>
            <p>Business: RAM'S FLARE</p>
            <p>Website: <a href="https://ramsflare.com">https://ramsflare.com</a></p>
            <p>Email: <a href="mailto:ramsflare@gmail.com">ramsflare@gmail.com</a></p>
          </div>
        </div>
      </body>
    </html>
    """


@app.get("/dashboard/internal")
async def dashboard_internal(request: Request, organization_slug: str = "") -> JSONResponse:
    require_dashboard_access(request)
    return JSONResponse(build_dashboard_state(organization_slug=organization_slug or None))


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request) -> str:
    require_dashboard_access(request)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    since_24h = (dt.datetime.utcnow() - dt.timedelta(hours=24)).replace(microsecond=0).isoformat() + "Z"
    try:
        summary = conn.execute(
            """
            SELECT
                COUNT(*) AS total_messages,
                SUM(CASE WHEN needs_human = 1 THEN 1 ELSE 0 END) AS needs_human_count,
                SUM(CASE WHEN order_signal = 1 THEN 1 ELSE 0 END) AS order_signal_count,
                SUM(CASE WHEN intent = 'pricing' THEN 1 ELSE 0 END) AS pricing_count,
                SUM(COALESCE(prompt_tokens, 0)) AS prompt_tokens,
                SUM(COALESCE(output_tokens, 0)) AS output_tokens,
                SUM(COALESCE(total_tokens, 0)) AS total_tokens,
                SUM(COALESCE(estimated_cost_usd, 0)) AS total_cost,
                AVG(COALESCE(latency_ms, 0)) AS avg_latency_ms
            FROM events
            """
        ).fetchone()
        summary_24h = conn.execute(
            """
            SELECT
                COUNT(*) AS messages_24h,
                SUM(CASE WHEN needs_human = 1 THEN 1 ELSE 0 END) AS needs_human_24h,
                SUM(CASE WHEN order_signal = 1 THEN 1 ELSE 0 END) AS order_signal_24h,
                SUM(COALESCE(total_tokens, 0)) AS total_tokens_24h,
                SUM(COALESCE(estimated_cost_usd, 0)) AS total_cost_24h
            FROM events
            WHERE received_at >= ?
            """
            ,
            (since_24h,),
        ).fetchone()
        contacts_count = conn.execute(
            """
            SELECT
                COUNT(*) AS total_contacts,
                SUM(CASE WHEN human_takeover = 1 THEN 1 ELSE 0 END) AS human_takeover_count
            FROM contacts
            """
        ).fetchone()
        attention_events = conn.execute(
            """
            SELECT received_at, customer_name, customer_message, lead_status, intent,
                   needs_human, order_signal, total_tokens, estimated_cost_usd, psid
            FROM events
            WHERE needs_human = 1 OR order_signal = 1 OR intent = 'pricing'
            ORDER BY received_at DESC
            LIMIT 12
            """
        ).fetchall()
        events = conn.execute(
            """
            SELECT received_at, customer_name, customer_message, ai_reply, lead_status, intent,
                   needs_human, order_signal, llm_model, total_tokens, estimated_cost_usd, latency_ms, psid
            FROM events
            ORDER BY received_at DESC
            LIMIT 25
            """
        ).fetchall()
    finally:
        conn.close()

    summary = summary or {}
    summary_24h = summary_24h or {}
    contacts_count = contacts_count or {}
    period_stats = fetch_period_stats()
    conversations = fetch_dashboard_conversations()
    avg_cost_per_message = (float(summary["total_cost"] or 0.0) / max(int(summary["total_messages"] or 0), 1)) if int(summary["total_messages"] or 0) else 0.0
    avg_tokens_per_message = (int(summary["total_tokens"] or 0) / max(int(summary["total_messages"] or 0), 1)) if int(summary["total_messages"] or 0) else 0.0
    archive_status = "Archive 24h active" if archive_bucket_name() else "Archive 24h non configuree"

    def render_attention_rows(rows: list[sqlite3.Row]) -> str:
        rendered = []
        for row in rows:
            flag = "A reprendre" if int(row["needs_human"] or 0) else "Pret a acheter" if int(row["order_signal"] or 0) else "Demande de prix"
            mode = "Humain" if bool(get_contact_state(str(row["psid"] or "")).get("human_takeover") or 0) else "Agent"
            rendered.append(
                "<tr>"
                f"<td>{html_escape(str(row['received_at'] or ''))}</td>"
                f"<td><span class='pill {badge_class(row)}'>{html_escape(flag)}</span></td>"
                f"<td>{html_escape(str(row['customer_name'] or 'Client'))}</td>"
                f"<td>{html_escape(str(row['customer_message'] or ''))}</td>"
                f"<td>{html_escape(str(row['lead_status'] or ''))}</td>"
                f"<td>{html_escape(mode)}</td>"
                f"<td>{format_int(row['total_tokens'])}</td>"
                f"<td>{format_money(row['estimated_cost_usd'])}</td>"
                "</tr>"
            )
        return "".join(rendered) or "<tr><td colspan='8'>Aucune conversation prioritaire pour le moment.</td></tr>"
    period_rows = "".join(
        "<tr>"
        f"<td>{label}</td>"
        f"<td>{format_int(values.get('message_count'))}</td>"
        f"<td>{format_int(values.get('total_tokens'))}</td>"
        f"<td>{format_money(values.get('total_cost_usd'))}</td>"
        f"<td>{format_int(values.get('pricing_count'))}</td>"
        f"<td>{format_int(values.get('order_signal_count'))}</td>"
        f"<td>{format_int(values.get('needs_human_count'))}</td>"
        "</tr>"
        for label, values in [
            ("Aujourd'hui", period_stats.get("today", {})),
            ("Cette semaine", period_stats.get("week", {})),
            ("Ce mois-ci", period_stats.get("month", {})),
            ("Depuis le debut", period_stats.get("all", {})),
        ]
    )
    event_rows = "".join(
        "<tr>"
        f"<td>{html_escape(str(row['received_at'] or ''))}</td>"
        f"<td>{html_escape(str(row['customer_name'] or 'Client'))}</td>"
        f"<td>{html_escape(str(row['customer_message'] or ''))}</td>"
        f"<td>{html_escape(str(row['ai_reply'] or ''))}</td>"
        f"<td>{html_escape(str(row['lead_status'] or ''))}</td>"
        f"<td>{'humain' if bool(get_contact_state(str(row['psid'] or '')).get('human_takeover') or 0) else 'agent'}</td>"
        f"<td>{'oui' if int(row['needs_human'] or 0) else 'non'}</td>"
        f"<td>{'oui' if int(row['order_signal'] or 0) else 'non'}</td>"
        f"<td>{format_int(row['total_tokens'])}</td>"
        f"<td>{format_money(row['estimated_cost_usd'])}</td>"
        "</tr>"
        for row in events
    ) or "<tr><td colspan='10'>Aucun message enregistre.</td></tr>"

    def render_mode_controls(psid: str, human_takeover: bool) -> str:
        human_disabled = "disabled" if human_takeover else ""
        agent_disabled = "" if human_takeover else "disabled"
        return (
            "<div class='mode-controls'>"
            "<form method='post' action='/dashboard/contact-mode'>"
            f"<input type='hidden' name='psid' value='{html_escape(psid)}' />"
            "<input type='hidden' name='mode' value='human' />"
            f"<button class='small-btn human' type='submit' {human_disabled}>Mode humain</button>"
            "</form>"
            "<form method='post' action='/dashboard/contact-mode'>"
            f"<input type='hidden' name='psid' value='{html_escape(psid)}' />"
            "<input type='hidden' name='mode' value='agent' />"
            f"<button class='small-btn agent' type='submit' {agent_disabled}>Mode agent</button>"
            "</form>"
            "</div>"
        )

    conversation_cards = []
    for item in conversations:
        contact = item["contact"]
        history = item["history"]
        psid = str(contact.get("psid") or "")
        first_name = str(contact.get("first_name") or "").strip()
        last_name = str(contact.get("last_name") or "").strip()
        display_name = " ".join(part for part in [first_name, last_name] if part).strip() or "Client"
        human_takeover = bool(contact.get("human_takeover") or 0)
        mode_label = "Humain" if human_takeover else "Agent"
        status_label = str(contact.get("lead_status") or "")
        last_message = str(contact.get("last_message") or "")
        history_rows = []
        for row in history:
            timestamp = html_escape(str(row.get("received_at") or ""))
            customer_message = html_escape(str(row.get("customer_message") or ""))
            ai_reply = html_escape(str(row.get("ai_reply") or ""))
            history_rows.append(
                "<div class='exchange'>"
                f"<div class='exchange-meta'>{timestamp}</div>"
                f"<div class='bubble customer'><strong>Client :</strong> {customer_message or '-'}</div>"
                f"<div class='bubble agent'><strong>{'Humain' if human_takeover and not ai_reply else 'Agent'} :</strong> {ai_reply or 'Aucune reponse automatique envoyee.'}</div>"
                "</div>"
            )
        conversation_cards.append(
            "<div class='conversation-card'>"
            f"<div class='conversation-head'><div><h3>{html_escape(display_name)}</h3><div class='conversation-sub'>{html_escape(status_label)} | {html_escape(mode_label)} | {html_escape(psid)}</div></div>{render_mode_controls(psid, human_takeover)}</div>"
            f"<div class='conversation-last'><strong>Dernier message :</strong> {html_escape(last_message or '-')}</div>"
            "<div class='conversation-history'>"
            + ("".join(history_rows) if history_rows else "<div class='exchange'><div class='bubble agent'>Aucun echange enregistre.</div></div>")
            + "</div></div>"
        )
    conversation_cards_html = "".join(conversation_cards) or "<div class='conversation-card'>Aucune conversation enregistree.</div>"
    return f"""
    <html>
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="refresh" content="10" />
        <title>Messenger Dashboard</title>
        <style>
          body {{ font-family: Arial, sans-serif; margin: 24px; background: #101114; color: #f3f4f6; }}
          table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
          th, td {{ border: 1px solid #2b2f36; padding: 8px; vertical-align: top; }}
          th {{ background: #181c23; text-align: left; }}
          h1, h2 {{ color: #fff; }}
          .box {{ background: #181c23; padding: 16px; border-radius: 12px; margin-bottom: 24px; }}
          .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 24px; }}
          .stat {{ background: #181c23; border: 1px solid #2b2f36; border-radius: 12px; padding: 14px; }}
          .label {{ color: #9aa4b2; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }}
          .value {{ font-size: 26px; font-weight: 700; margin-top: 8px; }}
          .sub {{ color: #cbd5e1; margin-top: 4px; font-size: 13px; }}
          .pill {{ display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }}
          .pill.danger {{ background: #4a1d1f; color: #fecaca; }}
          .pill.success {{ background: #123524; color: #bbf7d0; }}
          .pill.warn {{ background: #4a3413; color: #fde68a; }}
          .pill.neutral {{ background: #1f2937; color: #e5e7eb; }}
          a {{ color: #8ec5ff; }}
          .actions {{ display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }}
          .btn {{ display: inline-block; padding: 10px 14px; border-radius: 10px; background: #0f3d6e; color: #fff; text-decoration: none; font-weight: 700; }}
          .conversation-list {{ display: grid; gap: 16px; }}
          .conversation-card {{ background: #181c23; border: 1px solid #2b2f36; border-radius: 14px; padding: 16px; }}
          .conversation-head {{ display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 10px; }}
          .conversation-head h3 {{ margin: 0 0 6px; }}
          .conversation-sub {{ color: #9aa4b2; font-size: 13px; }}
          .conversation-last {{ margin-bottom: 12px; color: #e5e7eb; }}
          .conversation-history {{ display: grid; gap: 10px; }}
          .exchange {{ border-top: 1px solid #2b2f36; padding-top: 10px; }}
          .exchange:first-child {{ border-top: none; padding-top: 0; }}
          .exchange-meta {{ color: #9aa4b2; font-size: 12px; margin-bottom: 6px; }}
          .bubble {{ padding: 10px 12px; border-radius: 10px; margin-bottom: 8px; }}
          .bubble.customer {{ background: #111827; }}
          .bubble.agent {{ background: #0f1c2e; }}
          .mode-controls {{ display: flex; gap: 8px; flex-wrap: wrap; }}
          .mode-controls form {{ margin: 0; }}
          .small-btn {{ border: 0; border-radius: 10px; padding: 9px 12px; color: #fff; cursor: pointer; font-weight: 700; }}
          .small-btn.human {{ background: #7f1d1d; }}
          .small-btn.agent {{ background: #14532d; }}
          .small-btn:disabled {{ opacity: 0.45; cursor: default; }}
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Messenger Direct Dashboard</h1>
          <p>Mise a jour automatique toutes les 10 secondes.</p>
          <p>Vue quasi en direct du service Messenger actif.</p>
          <p>{html_escape(archive_status)}</p>
          <div class="actions">
            <a class="btn" href="/dashboard/export.csv?range=24h">Telecharger CSV 24h</a>
            <a class="btn" href="/dashboard/export.json?range=24h">Telecharger JSON 24h</a>
            <a class="btn" href="/dashboard/export.csv?range=all">Telecharger CSV complet</a>
          </div>
        </div>
        <div class="grid">
          <div class="stat"><div class="label">Messages</div><div class="value">{format_int(summary['total_messages'])}</div><div class="sub">{format_int(summary_24h['messages_24h'])} sur 24h</div></div>
          <div class="stat"><div class="label">Contacts</div><div class="value">{format_int(contacts_count['total_contacts'])}</div><div class="sub">Clients enregistres</div></div>
          <div class="stat"><div class="label">Mode Humain</div><div class="value">{format_int(contacts_count['human_takeover_count'])}</div><div class="sub">Contacts repris a la main</div></div>
          <div class="stat"><div class="label">A Reprendre</div><div class="value">{format_int(summary['needs_human_count'])}</div><div class="sub">{format_int(summary_24h['needs_human_24h'])} sur 24h</div></div>
          <div class="stat"><div class="label">Prets A Acheter</div><div class="value">{format_int(summary['order_signal_count'])}</div><div class="sub">{format_int(summary_24h['order_signal_24h'])} sur 24h</div></div>
          <div class="stat"><div class="label">Demandes De Prix</div><div class="value">{format_int(summary['pricing_count'])}</div><div class="sub">Clients a qualifier</div></div>
          <div class="stat"><div class="label">Temps Moyen</div><div class="value">{format_ms(summary['avg_latency_ms'])}</div><div class="sub">Reponse IA</div></div>
        </div>
        <div class="grid">
          <div class="stat"><div class="label">Tokens Totaux</div><div class="value">{format_int(summary['total_tokens'])}</div><div class="sub">{format_int(summary_24h['total_tokens_24h'])} sur 24h</div></div>
          <div class="stat"><div class="label">Cout Total</div><div class="value">{format_money(summary['total_cost'])}</div><div class="sub">{format_money(summary_24h['total_cost_24h'])} sur 24h</div></div>
          <div class="stat"><div class="label">Cout Moyen</div><div class="value">{format_money(avg_cost_per_message)}</div><div class="sub">Par message</div></div>
          <div class="stat"><div class="label">Tokens Par Message</div><div class="value">{format_int(avg_tokens_per_message)}</div><div class="sub">Moyenne</div></div>
        </div>
        <h2>Cumul Des Depenses</h2>
        <table>
          <tr><th>Periode</th><th>Messages</th><th>Tokens</th><th>Cout</th><th>Devis</th><th>Achats</th><th>A reprendre</th></tr>
          {period_rows}
        </table>
        <h2>A Traiter En Priorite</h2>
        <table>
          <tr><th>Heure</th><th>Priorite</th><th>Client</th><th>Message</th><th>Statut</th><th>Mode</th><th>Tokens</th><th>Cout</th></tr>
          {render_attention_rows(attention_events)}
        </table>
        <h2>Derniers Messages</h2>
        <table>
          <tr><th>Heure</th><th>Client</th><th>Message</th><th>Reponse</th><th>Statut</th><th>Mode</th><th>A reprendre</th><th>Pret a acheter</th><th>Tokens</th><th>Cout</th></tr>
          {event_rows}
        </table>
        <h2>Toutes Les Conversations</h2>
        <div class="conversation-list">
          {conversation_cards_html}
        </div>
      </body>
    </html>
    """


@app.post("/dashboard/contact-mode")
async def dashboard_contact_mode(request: Request) -> Response:
    require_dashboard_access(request)
    form = await request.form()
    psid = str(form.get("psid") or "").strip()
    mode = str(form.get("mode") or "").strip().lower()
    if psid and mode in {"human", "agent"}:
        set_contact_takeover(psid, mode == "human")
        try:
            await archive_contact_to_gcs(psid)
        except Exception:
            pass
        asyncio.create_task(safe_sync_google_sheet_for_contact(psid))
    if request.headers.get(DASHBOARD_ACCESS_HEADER):
        return JSONResponse({"status": "ok", "psid": psid, "mode": mode})
    return RedirectResponse(url="/dashboard", status_code=303)


@app.get("/dashboard/export.csv")
async def dashboard_export_csv(request: Request, range: str = "24h", organization_slug: str = "") -> Response:
    require_dashboard_access(request)
    hours = 24 if range == "24h" else None
    rows = fetch_events_for_range(hours=hours, organization_slug=organization_slug or None)
    content = build_events_csv(rows)
    filename = "messenger-dashboard-24h.csv" if hours == 24 else "messenger-dashboard-all.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/dashboard/export.json")
async def dashboard_export_json(request: Request, range: str = "24h", organization_slug: str = "") -> Response:
    require_dashboard_access(request)
    hours = 24 if range == "24h" else None
    rows = fetch_events_for_range(hours=hours, organization_slug=organization_slug or None)
    payload = [
        {
            "received_at": row["received_at"],
            "customer_name": row["customer_name"],
            "customer_message": row["customer_message"],
            "ai_reply": row["ai_reply"],
            "lead_status": row["lead_status"],
            "intent": row["intent"],
            "needs_human": bool(row["needs_human"] or 0),
            "order_signal": bool(row["order_signal"] or 0),
            "llm_provider": row["llm_provider"],
            "llm_model": row["llm_model"],
            "prompt_tokens": int(row["prompt_tokens"] or 0),
            "output_tokens": int(row["output_tokens"] or 0),
            "total_tokens": int(row["total_tokens"] or 0),
            "estimated_cost_usd": float(row["estimated_cost_usd"] or 0.0),
            "latency_ms": int(row["latency_ms"] or 0),
        }
        for row in rows
    ]
    filename = "messenger-dashboard-24h.json" if hours == 24 else "messenger-dashboard-all.json"
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/internal/page-connections")
async def internal_list_page_connections(request: Request, organization_slug: str = "") -> JSONResponse:
    require_dashboard_access(request)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        query = "SELECT * FROM page_connections"
        params: list[Any] = []
        if organization_slug:
            query += " WHERE organization_slug = ?"
            params.append(str(organization_slug or "").strip().lower())
        query += " ORDER BY updated_at DESC"
        rows = conn.execute(query, tuple(params)).fetchall()
        return JSONResponse({"pages": [dict(row) for row in rows]})
    finally:
        conn.close()


@app.post("/internal/page-connections")
async def internal_upsert_page_connection(request: Request) -> JSONResponse:
    require_dashboard_access(request)
    payload = await request.json()
    page_id = str(payload.get("page_id") or "").strip()
    page_name = str(payload.get("page_name") or "").strip()
    organization_slug = str(payload.get("organization_slug") or "").strip().lower()
    page_access_token = str(payload.get("page_access_token") or "").strip()
    is_active = bool(payload.get("is_active", True))
    status = str(payload.get("status") or "active").strip() or "active"
    bot_name = _clean_page_prompt_value(payload.get("bot_name"), 120)
    tone = _clean_page_prompt_value(payload.get("tone"), 40)
    language = _clean_page_prompt_value(payload.get("language"), 20)
    greeting_message = _clean_page_prompt_value(payload.get("greeting_message"), 1200)
    company_description = _clean_page_prompt_value(payload.get("company_description"), 4000)
    products_summary = _clean_page_prompt_value(payload.get("products_summary"), 6000)
    special_instructions = _clean_page_prompt_value(payload.get("special_instructions"), 3000)

    if not page_id or not page_access_token:
        raise HTTPException(status_code=400, detail="page_id et page_access_token sont requis.")

    page = upsert_page_connection(
        page_id=page_id,
        page_name=page_name or page_id,
        organization_slug=organization_slug,
        page_access_token=page_access_token,
        is_active=is_active,
        status=status,
        bot_name=bot_name,
        tone=tone,
        language=language,
        greeting_message=greeting_message,
        company_description=company_description,
        products_summary=products_summary,
        special_instructions=special_instructions,
    )
    return JSONResponse({"status": "ok", "page": page})


@app.delete("/internal/page-connections/{page_id}")
async def internal_delete_page_connection(page_id: str, request: Request) -> JSONResponse:
    require_dashboard_access(request)
    deactivate_page_connection(page_id)
    return JSONResponse({"status": "ok", "page_id": str(page_id or "").strip()})


@app.get("/webhook/facebook")
async def verify_webhook(request: Request):
    query = request.query_params
    hub_mode = query.get("hub.mode") or query.get("hub_mode")
    hub_verify_token = query.get("hub.verify_token") or query.get("hub_verify_token")
    hub_challenge = query.get("hub.challenge") or query.get("hub_challenge")
    if hub_mode == "subscribe" and hub_verify_token == CONFIG["meta_verify_token"]:
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@app.post("/webhook/facebook")
async def incoming_webhook(request: Request) -> JSONResponse:
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not signature_is_valid(raw_body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = json.loads(raw_body.decode("utf-8"))
    if payload_can_be_processed_locally(payload):
        asyncio.create_task(process_message(payload))
        return JSONResponse({"status": "accepted", "relay": "local"})

    relay_failures: list[str] = []
    for relay_url, relay_headers in backend_relay_targets(signature):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
                relay_response = await client.post(
                    relay_url,
                    content=raw_body,
                    headers=relay_headers,
                )
            if relay_response.status_code < 400:
                LOGGER.info("Messenger webhook relayed to backend successfully: %s", relay_url)
                return JSONResponse({"status": "accepted", "relay": "backend"})
            relay_failures.append(f"{relay_url} -> {relay_response.status_code}")
            LOGGER.warning(
                "Messenger webhook relay failed status=%s body=%s target=%s",
                relay_response.status_code,
                relay_response.text[:400],
                relay_url,
            )
        except Exception as exc:
            relay_failures.append(f"{relay_url} -> {exc}")
            LOGGER.warning("Messenger webhook relay exception target=%s error=%s", relay_url, exc)

    LOGGER.error(
        "Messenger webhook cannot be processed locally and backend relay failed. page_ids=%s failures=%s",
        _iter_payload_page_ids(payload),
        relay_failures,
    )
    raise HTTPException(status_code=503, detail="Messenger relay indisponible. Reessayez plus tard.")
