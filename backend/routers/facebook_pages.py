import base64
import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth import get_user_email_from_header, get_user_id_from_header
from core.config import settings
from core.database import ChatbotPreferences, FacebookPageConnection, get_db
from core.encryption_service import encryption_service
from core.organizations import (
    get_organization,
    organization_scope_id,
    user_can_access_organization,
    user_can_edit_organization,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/facebook", tags=["facebook-pages"])

FACEBOOK_SCOPES = [
    "pages_show_list",
    "pages_manage_metadata",
    "pages_messaging",
]
FACEBOOK_SUBSCRIBED_FIELDS = "messages,messaging_postbacks"
FACEBOOK_REQUIRED_PAGE_TASKS = {"MANAGE", "MESSAGING"}
STATE_TTL_MINUTES = 30
DASHBOARD_ACCESS_HEADER = "X-FLARE-Dashboard-Key"


class FacebookPageActivationPayload(BaseModel):
    page_id: str


def _utcnow() -> datetime:
    return datetime.utcnow()


def _normalize_frontend_origin(frontend_origin: str | None) -> str:
    candidate = str(frontend_origin or "").strip().rstrip("/")
    if candidate.startswith("http://") or candidate.startswith("https://"):
        return candidate
    return settings.FRONTEND_URL.rstrip("/")


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _configured_backend_url() -> str:
    candidate = str(settings.BACKEND_URL or "").strip().rstrip("/")
    if candidate.startswith("http://") or candidate.startswith("https://"):
        return candidate
    return ""


def _public_backend_url(request: Request | None = None) -> str:
    configured = _configured_backend_url()
    if configured:
        return configured
    if request is not None:
        derived = str(request.base_url or "").strip().rstrip("/")
        if derived.startswith("http://") or derived.startswith("https://"):
            return derived
    raise HTTPException(
        status_code=503,
        detail="L'URL publique du backend n'est pas configuree pour OAuth Meta.",
    )


def _facebook_callback_url(request: Request | None = None) -> str:
    return f"{_public_backend_url(request)}/api/facebook/callback"


def _graph_version() -> str:
    return str(settings.META_GRAPH_VERSION or "v25.0").strip() or "v25.0"


def _page_has_required_tasks(page: dict[str, Any]) -> bool:
    tasks = {
        str(item or "").strip().upper()
        for item in (page.get("tasks") or [])
        if str(item or "").strip()
    }
    return FACEBOOK_REQUIRED_PAGE_TASKS.issubset(tasks)


def _require_meta_oauth_configured() -> None:
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise HTTPException(status_code=503, detail="Meta OAuth n'est pas configure sur le serveur.")


def _build_state(payload: dict[str, Any]) -> str:
    secret = str(settings.META_APP_SECRET or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="META_APP_SECRET manquant.")

    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    return f"{_urlsafe_b64encode(raw)}.{signature}"


def _decode_state(state: str) -> dict[str, Any]:
    secret = str(settings.META_APP_SECRET or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="META_APP_SECRET manquant.")

    raw_state = str(state or "").strip()
    try:
        encoded_payload, signature = raw_state.split(".", 1)
        payload_bytes = _urlsafe_b64decode(encoded_payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="State Facebook invalide.") from exc

    expected_signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=400, detail="State Facebook invalide.")

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="State Facebook invalide.") from exc

    issued_at_raw = str(payload.get("issued_at") or "").strip()
    try:
        issued_at = datetime.fromisoformat(issued_at_raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="State Facebook invalide.") from exc

    if issued_at < _utcnow() - timedelta(minutes=STATE_TTL_MINUTES):
        raise HTTPException(status_code=400, detail="State Facebook expire.")

    return payload if isinstance(payload, dict) else {}


def _graph_token_params(access_token: str) -> dict[str, str]:
    params = {"access_token": access_token}
    secret = str(settings.META_APP_SECRET or "").strip()
    if secret and access_token:
        params["appsecret_proof"] = hmac.new(secret.encode("utf-8"), access_token.encode("utf-8"), hashlib.sha256).hexdigest()
    return params


def _organization_context_from_authorization(
    authorization: str | None,
    require_edit: bool = False,
) -> dict[str, Any]:
    resolved_scope_id = get_user_id_from_header(authorization)
    user_email = get_user_email_from_header(authorization).strip().lower()

    if resolved_scope_id == "anonymous":
        raise HTTPException(status_code=401, detail="Connexion requise.")

    if not resolved_scope_id.startswith("org:"):
        raise HTTPException(
            status_code=400,
            detail="Selectionnez d'abord une organisation active dans FLARE AI.",
        )

    organization_slug = resolved_scope_id.split(":", 1)[1].strip().lower()
    organization = get_organization(organization_slug)
    if not organization:
        raise HTTPException(status_code=404, detail="Organisation introuvable.")

    can_access = user_can_access_organization(user_email, organization_slug)
    if not can_access:
        raise HTTPException(status_code=403, detail="Cette organisation n'est pas accessible pour cet utilisateur.")

    can_edit = user_can_edit_organization(user_email, organization_slug, organization)
    if require_edit and not can_edit:
        raise HTTPException(status_code=403, detail="Seuls les owners/admins peuvent connecter Facebook.")

    return {
        "organization_slug": organization_slug,
        "organization_scope_id": organization_scope_id(organization_slug),
        "organization": organization,
        "user_email": user_email,
        "can_manage_pages": can_edit,
        "can_edit": can_edit,
    }


def _serialize_connection(row: FacebookPageConnection) -> dict[str, Any]:
    tasks = row.page_tasks if isinstance(row.page_tasks, list) else []
    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    return {
        "id": row.id,
        "page_id": row.page_id,
        "page_name": row.page_name,
        "page_picture_url": getattr(row, "page_picture_url", ""),
        "page_category": row.page_category or "",
        "page_tasks": tasks,
        "status": row.status or "pending",
        "is_active": str(row.is_active).lower() == "true",
        "webhook_subscribed": str(row.webhook_subscribed).lower() == "true",
        "direct_service_synced": str(row.direct_service_synced).lower() == "true",
        "connected_by_email": row.connected_by_email or "",
        "connected_at": row.connected_at.isoformat() if row.connected_at else None,
        "last_synced_at": row.last_synced_at.isoformat() if row.last_synced_at else None,
        "last_error": row.last_error or "",
        "metadata": metadata,
    }


def _serialize_chatbot_preferences_for_direct_service(
    preferences: ChatbotPreferences | None,
) -> dict[str, str]:
    if not preferences:
        return {}

    try:
        handoff_keywords = json.loads(preferences.handoff_keywords or "[]")
    except Exception:
        handoff_keywords = []

    company_lines = []
    if preferences.business_name:
        company_lines.append(f"Nom de l'entreprise: {str(preferences.business_name).strip()}")
    if preferences.business_sector:
        company_lines.append(f"Secteur d'activite: {str(preferences.business_sector).strip()}")
    if preferences.business_address:
        company_lines.append(f"Adresse: {str(preferences.business_address).strip()}")
    if preferences.business_hours:
        company_lines.append(f"Horaires: {str(preferences.business_hours).strip()}")
    if preferences.phone:
        company_lines.append(f"Telephone: {str(preferences.phone).strip()}")
    if preferences.contact_email:
        company_lines.append(f"Email: {str(preferences.contact_email).strip()}")
    if preferences.website_url:
        company_lines.append(f"Site web: {str(preferences.website_url).strip()}")

    company_description = "\n".join(
        part
        for part in [
            str(preferences.company_description or "").strip(),
            "\n".join(company_lines).strip(),
        ]
        if part
    )

    instruction_lines = []
    if preferences.primary_role:
        instruction_lines.append(f"Role principal du bot: {str(preferences.primary_role).strip()}.")
    if preferences.off_hours_message:
        instruction_lines.append(
            f"Si un client ecrit hors horaires, reponds en t'inspirant de ce message: {str(preferences.off_hours_message).strip()}"
        )
    if preferences.handoff_message:
        instruction_lines.append(
            f"Quand une reprise humaine est necessaire, utilise ce message de transition: {str(preferences.handoff_message).strip()}"
        )
    if preferences.handoff_mode:
        mode_label = "manuel uniquement" if str(preferences.handoff_mode).strip().lower() == "manual" else "automatique"
        instruction_lines.append(f"Mode de transfert humain prefere: {mode_label}.")
    if isinstance(handoff_keywords, list) and handoff_keywords:
        keywords = [str(item or "").strip() for item in handoff_keywords if str(item or "").strip()]
        if keywords:
            instruction_lines.append(f"Mots-cles declencheurs de reprise humaine: {', '.join(keywords)}.")
    if preferences.forbidden_topics_or_claims:
        instruction_lines.append(
            f"Le bot ne doit jamais dire ou promettre ceci: {str(preferences.forbidden_topics_or_claims).strip()}"
        )
    if preferences.special_instructions:
        instruction_lines.append(str(preferences.special_instructions).strip())

    return {
        "bot_name": str(preferences.bot_name or "").strip(),
        "tone": str(preferences.tone or "").strip(),
        "language": str(preferences.language or "").strip(),
        "greeting_message": str(preferences.greeting_message or "").strip(),
        "company_description": company_description,
        "products_summary": str(preferences.products_summary or "").strip(),
        "special_instructions": "\n".join(instruction_lines).strip(),
    }


def _messenger_direct_headers() -> dict[str, str]:
    dashboard_key = str(settings.MESSENGER_DIRECT_DASHBOARD_KEY or "").strip()
    if not dashboard_key:
        raise HTTPException(status_code=503, detail="La cle interne Messenger n'est pas configuree.")
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        DASHBOARD_ACCESS_HEADER: dashboard_key,
    }


def _status_for_sync_error(detail: str) -> str:
    lowered = str(detail or "").lower()
    reconnect_markers = [
        "token",
        "oauth",
        "expired",
        "invalid",
        "unauthorized",
        "permission",
        "access denied",
    ]
    return "reconnect_required" if any(marker in lowered for marker in reconnect_markers) else "sync_error"


async def _exchange_facebook_code_for_token(code: str, redirect_uri: str) -> dict[str, Any]:
    _require_meta_oauth_configured()
    timeout = httpx.Timeout(20.0, connect=10.0)
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": redirect_uri,
        "client_secret": settings.META_APP_SECRET,
        "code": code,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            f"https://graph.facebook.com/{_graph_version()}/oauth/access_token",
            params=params,
        )
        response.raise_for_status()
        short_lived = response.json()

        access_token = str(short_lived.get("access_token") or "").strip()
        if not access_token:
            raise HTTPException(status_code=400, detail="Meta n'a pas retourne de token utilisateur.")

        exchange_response = await client.get(
            f"https://graph.facebook.com/{_graph_version()}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": access_token,
            },
        )

    if exchange_response.status_code < 400:
        long_lived = exchange_response.json()
        if str(long_lived.get("access_token") or "").strip():
            return long_lived

    return short_lived


async def _fetch_facebook_pages(user_access_token: str) -> list[dict[str, Any]]:
    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            f"https://graph.facebook.com/{_graph_version()}/me/accounts",
            params={
                "fields": "id,name,access_token,category,tasks,picture.type(large)",
                **_graph_token_params(user_access_token),
            },
        )
        response.raise_for_status()
        payload = response.json()

    pages = payload.get("data") if isinstance(payload, dict) else []
    return [
        item
        for item in pages
        if isinstance(item, dict)
        and str(item.get("id") or "").strip()
        and _page_has_required_tasks(item)
    ]


async def _subscribe_page_to_app(page_id: str, page_access_token: str) -> None:
    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"https://graph.facebook.com/{_graph_version()}/{page_id}/subscribed_apps",
            data={
                "subscribed_fields": FACEBOOK_SUBSCRIBED_FIELDS,
                **_graph_token_params(page_access_token),
            },
        )
    if response.status_code >= 400:
        detail = response.text
        raise HTTPException(status_code=502, detail=f"Abonnement Messenger impossible: {detail}")


async def _unsubscribe_page_from_app(page_id: str, page_access_token: str) -> None:
    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.delete(
            f"https://graph.facebook.com/{_graph_version()}/{page_id}/subscribed_apps",
            params=_graph_token_params(page_access_token),
        )
    if response.status_code >= 400:
        detail = response.text
        raise HTTPException(status_code=502, detail=f"Desabonnement Messenger impossible: {detail}")


async def _sync_page_to_direct_service(
    connection: FacebookPageConnection,
    page_access_token: str,
    chatbot_preferences: dict[str, str] | None = None,
) -> None:
    base_url = settings.MESSENGER_DIRECT_URL.rstrip("/")
    timeout = httpx.Timeout(20.0, connect=10.0)
    payload = {
        "page_id": connection.page_id,
        "page_name": connection.page_name,
        "organization_slug": connection.organization_slug,
        "page_access_token": page_access_token,
        "is_active": True,
        "status": connection.status or "active",
    }
    if chatbot_preferences:
        payload.update(chatbot_preferences)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{base_url}/internal/page-connections",
            headers=_messenger_direct_headers(),
            content=json.dumps(payload),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="La synchro avec le service Messenger direct a echoue.")


async def _disconnect_page_from_direct_service(page_id: str) -> None:
    base_url = settings.MESSENGER_DIRECT_URL.rstrip("/")
    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.delete(
            f"{base_url}/internal/page-connections/{page_id}",
            headers=_messenger_direct_headers(),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="La desactivation sur le service Messenger direct a echoue.")


def _callback_page(frontend_origin: str, status: str, detail: str, page_count: int = 0) -> HTMLResponse:
    safe_origin = json.dumps(_normalize_frontend_origin(frontend_origin))
    safe_status = json.dumps(status)
    safe_detail = json.dumps(detail)
    status_icon = "✅" if status == "success" else "❌"
    status_title = "Connexion Facebook reussie !" if status == "success" else "Connexion Facebook echouee"
    html = f"""
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>FLARE AI — Facebook</title>
        <style>
          body {{
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #0b1119;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          }}
          .card {{
            width: min(460px, calc(100vw - 32px));
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 22px;
            background: rgba(255,255,255,0.04);
            backdrop-filter: blur(12px);
            padding: 32px;
            text-align: center;
          }}
          .icon {{ font-size: 48px; margin-bottom: 16px; }}
          h1 {{ margin: 0 0 8px; font-size: 22px; font-weight: 700; }}
          p {{ margin: 0; line-height: 1.6; color: rgba(255,255,255,0.65); font-size: 14px; }}
          .close-btn {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 24px;
            padding: 10px 28px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            color: #f8fafc;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }}
          .close-btn:hover {{ background: rgba(255,255,255,0.12); }}
          .auto-msg {{ margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.35); }}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">{status_icon}</div>
          <h1>{status_title}</h1>
          <p>{detail}</p>
          <button class="close-btn" onclick="tryClose()">Fermer cette fenêtre</button>
          <p class="auto-msg" id="autoMsg">Fermeture automatique…</p>
        </div>
        <script>
          const targetOrigin = {safe_origin};
          const payload = {{
            type: "flare-facebook-oauth",
            status: {safe_status},
            detail: {safe_detail},
            pageCount: {int(page_count or 0)}
          }};
          if (window.opener && targetOrigin) {{
            window.opener.postMessage(payload, targetOrigin);
          }}
          function tryClose() {{
            try {{ window.close(); }} catch(e) {{}}
            setTimeout(function() {{
              document.getElementById('autoMsg').textContent =
                'Si la fenêtre ne se ferme pas, fermez-la manuellement.';
            }}, 300);
          }}
          setTimeout(tryClose, 500);
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@router.get("/status")
async def get_facebook_pages_status(
    request: Request,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context_from_authorization(authorization, require_edit=True)
    rows = (
        db.query(FacebookPageConnection)
        .filter(FacebookPageConnection.organization_slug == context["organization_slug"])
        .order_by(FacebookPageConnection.updated_at.desc())
        .all()
    )
    return {
        "organization_slug": context["organization_slug"],
        "organization_name": context["organization"]["name"],
        "can_manage_pages": context["can_manage_pages"],
        "can_edit": context["can_edit"],
        "oauth_configured": bool(settings.META_APP_ID and settings.META_APP_SECRET and _public_backend_url(request)),
        "direct_service_configured": bool(settings.MESSENGER_DIRECT_DASHBOARD_KEY and settings.MESSENGER_DIRECT_URL),
        "oauth_callback_url": _facebook_callback_url(request),
        "callback_url": f"{settings.MESSENGER_DIRECT_URL.rstrip('/')}/webhook/facebook",
        "verify_token_hint": bool(settings.META_VERIFY_TOKEN),
        "pages": [_serialize_connection(row) for row in rows],
        "has_active_page": any(str(row.is_active).lower() == "true" for row in rows),
    }


@router.get("/auth")
async def start_facebook_auth(
    request: Request,
    frontend_origin: str | None = Query(default=None),
    authorization: str | None = Header(None),
):
    context = _organization_context_from_authorization(authorization, require_edit=False)
    _require_meta_oauth_configured()
    callback_url = _facebook_callback_url(request)

    state = _build_state(
        {
            "organization_slug": context["organization_slug"],
            "user_email": context["user_email"],
            "frontend_origin": _normalize_frontend_origin(frontend_origin),
            "issued_at": _utcnow().isoformat(),
            "nonce": secrets.token_urlsafe(18),
        }
    )
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": callback_url,
        "scope": ",".join(FACEBOOK_SCOPES),
        "response_type": "code",
        "state": state,
    }
    return {
        "authorization_url": f"https://www.facebook.com/{_graph_version()}/dialog/oauth?{urlencode(params)}",
        "organization_slug": context["organization_slug"],
    }


@router.get("/callback")
async def facebook_auth_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    state_payload = _decode_state(str(state or ""))
    frontend_origin = _normalize_frontend_origin(state_payload.get("frontend_origin"))

    if error:
        detail = str(error_description or error or "Autorisation Facebook refusee.")
        return _callback_page(frontend_origin, "error", detail)

    if not code:
        return _callback_page(frontend_origin, "error", "Code Facebook manquant.")

    organization_slug = str(state_payload.get("organization_slug") or "").strip().lower()
    user_email = str(state_payload.get("user_email") or "").strip().lower()
    organization = get_organization(organization_slug)
    if not organization or not user_can_edit_organization(user_email, organization_slug, organization):
        return _callback_page(frontend_origin, "error", "L'organisation n'est plus autorisee pour cette connexion.")

    try:
        token_payload = await _exchange_facebook_code_for_token(
            code,
            redirect_uri=_facebook_callback_url(request),
        )
        user_access_token = str(token_payload.get("access_token") or "").strip()
        pages = await _fetch_facebook_pages(user_access_token)
    except HTTPException as exc:
        return _callback_page(frontend_origin, "error", str(exc.detail))
    except Exception as exc:
        logger.exception("Facebook callback failed: %s", exc)
        return _callback_page(frontend_origin, "error", "Connexion Facebook impossible pour le moment.")

    if not pages:
        return _callback_page(
            frontend_origin,
            "error",
            "Aucune page Facebook avec les droits Messenger necessaires n'a ete retournee par Meta.",
        )

    encrypted_user_token = encryption_service.encrypt(user_access_token)
    organization_scope = organization_scope_id(organization_slug)
    now = _utcnow()

    for page in pages:
        page_id = str(page.get("id") or "").strip()
        page_name = str(page.get("name") or "").strip() or page_id
        if not page_id:
            continue

        connection = (
            db.query(FacebookPageConnection)
            .filter(
                FacebookPageConnection.organization_slug == organization_slug,
                FacebookPageConnection.page_id == page_id,
            )
            .first()
        )
        if not connection:
            connection = FacebookPageConnection(
                organization_slug=organization_slug,
                organization_scope_id=organization_scope,
                page_id=page_id,
                connected_at=now,
                created_at=now,
            )
            db.add(connection)

        page_access_token = str(page.get("access_token") or "").strip()
        connection.page_name = page_name
        picture_data = page.get("picture", {})
        if isinstance(picture_data, dict):
            connection.page_picture_url = str(picture_data.get("data", {}).get("url") or "").strip()
        connection.page_category = str(page.get("category") or "").strip()
        connection.page_tasks = page.get("tasks") if isinstance(page.get("tasks"), list) else []
        connection.page_access_token_encrypted = encryption_service.encrypt(page_access_token)
        connection.user_access_token_encrypted = encrypted_user_token
        connection.connected_by_email = user_email
        connection.status = "pending"
        connection.is_active = "false"
        connection.webhook_subscribed = "false"
        connection.direct_service_synced = "false"
        connection.last_error = None
        connection.metadata_json = {
            "token_type": str(token_payload.get("token_type") or "").strip(),
            "user_token_expires_in": int(token_payload.get("expires_in") or 0),
        }
        connection.updated_at = now

    db.commit()
    return _callback_page(
        frontend_origin,
        "success",
        f"{len(pages)} page(s) chargee(s) dans FLARE AI. Choisissez maintenant celles a activer.",
        page_count=len(pages),
    )


@router.post("/pages/{page_id}/activate")
async def activate_facebook_page(
    page_id: str,
    payload: FacebookPageActivationPayload,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context_from_authorization(authorization, require_edit=True)
    target_page_id = str(payload.page_id or page_id or "").strip()
    if target_page_id != str(page_id or "").strip():
        raise HTTPException(status_code=400, detail="Page Facebook incoherente.")

    connection = (
        db.query(FacebookPageConnection)
        .filter(
            FacebookPageConnection.organization_slug == context["organization_slug"],
            FacebookPageConnection.page_id == target_page_id,
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="Page Facebook introuvable.")

    active_elsewhere = (
        db.query(FacebookPageConnection)
        .filter(
            FacebookPageConnection.page_id == target_page_id,
            FacebookPageConnection.organization_slug != context["organization_slug"],
            FacebookPageConnection.is_active == "true",
            FacebookPageConnection.status == "active",
        )
        .first()
    )
    if active_elsewhere:
        raise HTTPException(
            status_code=409,
            detail="Cette page Facebook est deja active sur une autre organisation.",
        )

    other_active_connections = (
        db.query(FacebookPageConnection)
        .filter(
            FacebookPageConnection.organization_slug == context["organization_slug"],
            FacebookPageConnection.page_id != target_page_id,
            FacebookPageConnection.is_active == "true",
        )
        .all()
    )

    page_access_token = encryption_service.decrypt(connection.page_access_token_encrypted or "")
    if not page_access_token:
        connection.status = "reconnect_required"
        connection.is_active = "false"
        connection.webhook_subscribed = "false"
        connection.direct_service_synced = "false"
        connection.last_error = "Token de page indisponible. Reconnectez Facebook."
        connection.updated_at = _utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail="Token de page Facebook indisponible. Reconnectez Facebook.")

    subscribed_target = False

    try:
        chatbot_preferences = _serialize_chatbot_preferences_for_direct_service(
            db.query(ChatbotPreferences)
            .filter(ChatbotPreferences.organization_slug == context["organization_slug"])
            .first()
        )
        await _subscribe_page_to_app(target_page_id, page_access_token)
        subscribed_target = True
        await _sync_page_to_direct_service(
            connection,
            page_access_token,
            chatbot_preferences=chatbot_preferences,
        )
        now = _utcnow()
        connection.status = "active"
        connection.is_active = "true"
        connection.webhook_subscribed = "true"
        connection.direct_service_synced = "true"
        connection.last_error = None
        connection.last_synced_at = now
        connection.updated_at = now

        for other in other_active_connections:
            other_page_access_token = encryption_service.decrypt(other.page_access_token_encrypted or "")
            if other_page_access_token:
                try:
                    await _unsubscribe_page_from_app(other.page_id, other_page_access_token)
                except HTTPException as exc:
                    other.last_error = str(exc.detail)
            try:
                await _disconnect_page_from_direct_service(other.page_id)
            except HTTPException as exc:
                if not other.last_error:
                    other.last_error = str(exc.detail)
            other.status = "disconnected"
            other.is_active = "false"
            other.webhook_subscribed = "false"
            other.direct_service_synced = "false"
            other.updated_at = now
        db.commit()
    except HTTPException as exc:
        if subscribed_target:
            try:
                await _unsubscribe_page_from_app(target_page_id, page_access_token)
            except HTTPException:
                pass
        connection.status = _status_for_sync_error(str(exc.detail))
        connection.is_active = "false"
        connection.webhook_subscribed = "false"
        connection.direct_service_synced = "false"
        connection.last_error = str(exc.detail)
        connection.updated_at = _utcnow()
        db.commit()
        raise

    db.refresh(connection)
    return {"status": "ok", "page": _serialize_connection(connection)}


@router.delete("/pages/{page_id}")
async def disconnect_facebook_page(
    page_id: str,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context_from_authorization(authorization, require_edit=True)
    connection = (
        db.query(FacebookPageConnection)
        .filter(
            FacebookPageConnection.organization_slug == context["organization_slug"],
            FacebookPageConnection.page_id == str(page_id or "").strip(),
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="Page Facebook introuvable.")

    page_access_token = encryption_service.decrypt(connection.page_access_token_encrypted or "")
    unsubscribe_error: str | None = None
    direct_service_error: str | None = None
    is_active_here = str(connection.is_active).lower() == "true"

    if is_active_here and page_access_token:
        try:
            await _unsubscribe_page_from_app(connection.page_id, page_access_token)
        except HTTPException as exc:
            unsubscribe_error = str(exc.detail)

    if is_active_here:
        try:
            await _disconnect_page_from_direct_service(connection.page_id)
        except HTTPException as exc:
            direct_service_error = str(exc.detail)

    connection.status = "disconnected"
    connection.is_active = "false"
    connection.webhook_subscribed = "false"
    connection.direct_service_synced = "false"
    connection.last_error = direct_service_error or unsubscribe_error
    connection.last_synced_at = _utcnow()
    connection.updated_at = _utcnow()
    db.commit()
    db.refresh(connection)

    return {
        "status": "ok",
        "page": _serialize_connection(connection),
    }
