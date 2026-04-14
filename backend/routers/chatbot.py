"""
Router Chatbot - Preferences multi-organisations et etat du setup wizard.
"""
import json as _json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.auth import get_user_email_from_header, get_user_id_from_header
from core.database import (
    ChatbotCatalogueItem, ChatbotPortfolioItem, ChatbotPreferences,
    ChatbotSalesConfig, FacebookPageConnection, get_db, get_plan_features,
    get_user_subscription,
)
from core.encryption_service import encryption_service
from routers.facebook_pages import (
    _serialize_chatbot_preferences_for_direct_service,
    _status_for_sync_error,
    _sync_page_to_direct_service,
    _user_safe_last_error,
)

router = APIRouter(prefix="/api", tags=["chatbot"])

ALLOWED_TONES = {"professionnel", "amical", "decontracte", "formel"}
ALLOWED_PRIMARY_ROLES = {"vendeur", "support_client", "informateur", "mixte"}


class ChatbotPreferencesPayload(BaseModel):
    bot_name: str = "L'assistant"
    primary_role: str = "mixte"
    tone: str = "amical"
    language: str = "fr"
    greeting_message: str = ""
    off_hours_message: str = ""
    handoff_message: str = ""
    handoff_mode: str = "auto"
    handoff_keywords: list[str] = []
    company_description: str = ""
    business_name: str = ""
    business_sector: str = ""
    business_address: str = ""
    business_hours: str = ""
    phone: str = ""
    contact_email: str = ""
    website_url: str = ""
    forbidden_topics_or_claims: str = ""
    products_summary: str = ""
    special_instructions: str = ""


def _clean_text(value: Optional[str], limit: int, default: str = "") -> str:
    return str(value or "").strip()[:limit] or default


def _default_preferences(organization_slug: Optional[str] = None, user_id: Optional[str] = None) -> dict[str, Any]:
    return {
        "user_id": str(user_id or "").strip(),
        "bot_name": "L'assistant",
        "primary_role": "mixte",
        "tone": "amical",
        "language": "fr",
        "greeting_message": "",
        "off_hours_message": "",
        "handoff_message": "",
        "handoff_mode": "auto",
        "handoff_keywords": [],
        "company_description": "",
        "business_name": "",
        "business_sector": "",
        "business_address": "",
        "business_hours": "",
        "phone": "",
        "contact_email": "",
        "website_url": "",
        "forbidden_topics_or_claims": "",
        "products_summary": "",
        "special_instructions": "",
        "created_at": None,
        "updated_at": None,
    }


def _serialize_preferences(row: Optional[ChatbotPreferences], organization_slug: Optional[str] = None, user_id: Optional[str] = None) -> dict[str, Any]:
    if not row:
        return _default_preferences(organization_slug, user_id)

    try:
        handoff_keywords = _json.loads(row.handoff_keywords or "[]")
    except Exception:
        handoff_keywords = []

    return {
        "user_id": row.user_id,
        "bot_name": row.bot_name or "L'assistant",
        "primary_role": row.primary_role or "mixte",
        "tone": row.tone or "amical",
        "language": row.language or "fr",
        "greeting_message": row.greeting_message or "",
        "off_hours_message": row.off_hours_message or "",
        "handoff_message": row.handoff_message or "",
        "handoff_mode": row.handoff_mode or "auto",
        "handoff_keywords": handoff_keywords if isinstance(handoff_keywords, list) else [],
        "company_description": row.company_description or "",
        "business_name": row.business_name or "",
        "business_sector": row.business_sector or "",
        "business_address": row.business_address or "",
        "business_hours": row.business_hours or "",
        "phone": row.phone or "",
        "contact_email": row.contact_email or "",
        "website_url": row.website_url or "",
        "forbidden_topics_or_claims": row.forbidden_topics_or_claims or "",
        "products_summary": row.products_summary or "",
        "special_instructions": row.special_instructions or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _has_identity_preferences(row: Optional[ChatbotPreferences]) -> bool:
    if not row:
        return False
    return bool(str(row.bot_name or "").strip())


def _has_business_profile(row: Optional[ChatbotPreferences]) -> bool:
    if not row:
        return False
    return bool(str(row.business_name or "").strip() and str(row.company_description or "").strip())


def _configure_stage(row: Optional[ChatbotPreferences]) -> str | None:
    if not _has_identity_preferences(row):
        return "identity"
    if not _has_business_profile(row):
        return "company"
    return None


def _setup_step(active_page: Optional[FacebookPageConnection], prefs: Optional[ChatbotPreferences]) -> str:
    if active_page is None:
        return "connect_page"
    if _configure_stage(prefs):
        return "configure"
    return "complete"


def _organization_context(
    authorization: Optional[str],
    *,
    require_edit: bool = False,
    allow_missing_scope: bool = False,
) -> Optional[dict[str, Any]]:
    scoped_user_id = get_user_id_from_header(authorization)
    user_email = get_user_email_from_header(authorization).strip().lower()

    if scoped_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    return {
        "organization_slug": scoped_user_id,
        "organization_scope_id": scoped_user_id,
        "user_id": scoped_user_id,
        "organization": None,
        "user_email": user_email,
        "can_edit": True,
    }


def _active_page_for_org(db: Session, organization_slug: str) -> Optional[FacebookPageConnection]:
    return (
        db.query(FacebookPageConnection)
        .filter(
            or_(
                FacebookPageConnection.user_id == organization_slug,
                FacebookPageConnection.organization_slug == organization_slug,
            ),
            FacebookPageConnection.is_active == "true",
        )
        .order_by(FacebookPageConnection.updated_at.desc())
        .first()
    )


def _active_pages_for_org(db: Session, organization_slug: str) -> list[FacebookPageConnection]:
    return (
        db.query(FacebookPageConnection)
        .filter(
            or_(
                FacebookPageConnection.user_id == organization_slug,
                FacebookPageConnection.organization_slug == organization_slug,
            ),
            FacebookPageConnection.is_active == "true",
        )
        .order_by(FacebookPageConnection.updated_at.desc())
        .all()
    )


async def _sync_active_pages_for_org(
    db: Session,
    organization_slug: str,
    *,
    warning_prefix: str,
) -> str | None:
    active_pages = _active_pages_for_org(db, organization_slug)
    if not active_pages:
        return None

    preferences = (
        db.query(ChatbotPreferences)
        .filter(
            or_(
                ChatbotPreferences.user_id == organization_slug,
                ChatbotPreferences.organization_slug == organization_slug,
            )
        )
        .first()
    )
    direct_service_payload = _serialize_chatbot_preferences_for_direct_service(preferences)
    sync_warning: str | None = None

    for page in active_pages:
        page_access_token = encryption_service.decrypt(page.page_access_token_encrypted or "")
        if not page_access_token:
            page.status = "reconnect_required"
            page.direct_service_synced = "false"
            page.last_error = "Token de page indisponible. Reconnectez Facebook."
            page.updated_at = datetime.utcnow()
            sync_warning = f"{warning_prefix}, mais au moins une page active doit etre reconnectee."
            continue
        try:
            synced = await _sync_page_to_direct_service(
                page,
                page_access_token,
                chatbot_preferences=direct_service_payload,
            )
            page.status = "active"
            page.direct_service_synced = "true" if synced else "false"
            page.last_error = None
            if synced:
                page.last_synced_at = datetime.utcnow()
            page.updated_at = datetime.utcnow()
        except HTTPException as exc:
            page.direct_service_synced = "false"
            page.status = _status_for_sync_error(str(exc.detail))
            page.last_error = str(exc.detail)
            page.updated_at = datetime.utcnow()
            sync_warning = f"{warning_prefix}, mais la synchro Messenger a echoue: {exc.detail}"

    db.commit()
    return sync_warning


def _resolve_plan_features(context: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    subscription = get_user_subscription(context["organization_scope_id"])
    if isinstance(subscription, dict):
        plan_id = str(subscription.get("plan_id") or "free").strip().lower()
    else:
        plan_id = "free"
    return plan_id, get_plan_features(plan_id)


def _require_feature(context: dict[str, Any], feature_key: str, label: str) -> tuple[str, dict[str, Any]]:
    plan_id, features = _resolve_plan_features(context)
    if not bool(features.get(feature_key)):
        raise HTTPException(
            status_code=403,
            detail=f"{label} disponible seulement avec un plan superieur.",
        )
    return plan_id, features


@router.get("/chatbot-preferences")
def get_chatbot_preferences(
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization)
    user_id = context["user_id"]
    query = db.query(ChatbotPreferences).filter(
        or_(
            ChatbotPreferences.user_id == user_id,
            ChatbotPreferences.organization_slug == user_id,
        )
    )

    if page_id:
        row = query.filter(ChatbotPreferences.page_id == page_id).first()
        if not row: # Fallback pour migration douce
            row = query.filter(ChatbotPreferences.page_id.is_(None)).first()
    else:
        row = query.filter(ChatbotPreferences.page_id.is_(None)).first()
        if not row:
            row = query.first()

    return _serialize_preferences(row, context["organization_slug"], user_id)


@router.put("/chatbot-preferences")
async def upsert_chatbot_preferences(
    payload: ChatbotPreferencesPayload,
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    user_id = context["user_id"]
    query = db.query(ChatbotPreferences).filter(
        or_(
            ChatbotPreferences.user_id == user_id,
            ChatbotPreferences.organization_slug == user_id,
        )
    )

    if page_id:
        row = query.filter(ChatbotPreferences.page_id == page_id).first()
    else:
        row = query.filter(ChatbotPreferences.page_id.is_(None)).first()

    if not row:
        row = ChatbotPreferences(
            organization_slug=context["organization_slug"],
            user_id=user_id,
            page_id=page_id,
            created_at=datetime.utcnow(),
        )
        db.add(row)

    row.bot_name = _clean_text(payload.bot_name, 80, "L'assistant")
    row.primary_role = payload.primary_role if payload.primary_role in ALLOWED_PRIMARY_ROLES else "mixte"
    row.tone = payload.tone if payload.tone in ALLOWED_TONES else "amical"
    row.language = _clean_text(payload.language, 12, "fr")
    row.greeting_message = _clean_text(payload.greeting_message, 800)
    row.off_hours_message = _clean_text(payload.off_hours_message, 800)
    row.handoff_message = _clean_text(payload.handoff_message, 800)
    row.handoff_mode = _clean_text(payload.handoff_mode, 40, "auto")
    row.handoff_keywords = _json.dumps([
        keyword
        for keyword in (
            _clean_text(item, 80)
            for item in (payload.handoff_keywords or [])
        )
        if keyword
    ])
    row.company_description = _clean_text(payload.company_description, 2000)
    row.business_name = _clean_text(payload.business_name, 160)
    row.business_sector = _clean_text(payload.business_sector, 120)
    row.business_address = _clean_text(payload.business_address, 400)
    row.business_hours = _clean_text(payload.business_hours, 1200)
    row.phone = _clean_text(payload.phone, 64)
    row.contact_email = _clean_text(payload.contact_email, 254)
    row.website_url = _clean_text(payload.website_url, 500)
    row.forbidden_topics_or_claims = _clean_text(payload.forbidden_topics_or_claims, 2000)
    row.products_summary = _clean_text(payload.products_summary, 4000)
    row.special_instructions = _clean_text(payload.special_instructions, 2000)
    row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    sync_warning = await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Preferences enregistrees",
    )
    response = _serialize_preferences(row, context["organization_slug"], user_id)
    if sync_warning:
        response["sync_warning"] = sync_warning
    return response


@router.get("/chatbot/setup-status")
def get_chatbot_setup_status(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, allow_missing_scope=True)
    if not context:
        return {
            "step": "need_org",
            "has_connected_page": False,
            "has_preferences": False,
            "has_identity": False,
            "has_business_profile": False,
            "configure_stage": None,
            "active_page_name": None,
            "active_page_id": None,
            "all_pages": [],
        }

    active_page = _active_page_for_org(db, context["organization_slug"])
    prefs = (
        db.query(ChatbotPreferences)
        .filter(
            or_(
                ChatbotPreferences.user_id == context["user_id"],
                or_(ChatbotPreferences.user_id == context["organization_slug"], ChatbotPreferences.organization_slug == context["organization_slug"]),
            )
        )
        .first()
    )

    has_connected_page = active_page is not None
    has_identity = _has_identity_preferences(prefs)
    has_business_profile = _has_business_profile(prefs)
    configure_stage = _configure_stage(prefs)
    step = _setup_step(active_page, prefs)

    def _serialize_page(p: FacebookPageConnection) -> dict:
        return {
            "page_id": p.page_id,
            "page_name": p.page_name,
            "page_picture_url": getattr(p, "page_picture_url", None) or "",
            "page_category": p.page_category or "",
            "status": p.status,
            "is_active": p.is_active == "true",
            "webhook_subscribed": p.webhook_subscribed == "true",
            "direct_service_synced": p.direct_service_synced == "true",
            "last_error": _user_safe_last_error(p.last_error),
            "connected_at": p.connected_at.isoformat() if p.connected_at else None,
            "last_synced_at": p.last_synced_at.isoformat() if p.last_synced_at else None,
        }

    visible_statuses = [
        "active",
        "pending",
        "sync_error",
        "reconnect_required",
        "inactive",
        "disconnected",
        "permissions_missing",
    ]

    all_pages = (
        db.query(FacebookPageConnection)
        .filter(
            or_(
                FacebookPageConnection.user_id == context["user_id"],
                or_(FacebookPageConnection.user_id == context["organization_slug"], FacebookPageConnection.organization_slug == context["organization_slug"]),
            ),
            FacebookPageConnection.status.in_(visible_statuses),
        )
        .order_by(FacebookPageConnection.updated_at.desc())
        .all()
    )

    return {
        "step": step,
        "has_connected_page": has_connected_page,
        "has_preferences": has_identity,
        "has_identity": has_identity,
        "has_business_profile": has_business_profile,
        "configure_stage": configure_stage,
        "active_page_name": active_page.page_name if active_page else None,
        "active_page_id": active_page.page_id if active_page else None,
        "all_pages": [_serialize_page(p) for p in all_pages],
    }


from routers.dashboard import _fetch_messenger_dashboard_bundle, _build_messenger_totals

@router.get("/chatbot/overview")
async def get_chatbot_overview(
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Vue d'ensemble du chatbot pour le dashboard : statut, page active, préférences."""
    context = _organization_context(authorization, allow_missing_scope=True)
    if not context:
        return {
            "step": "need_org",
            "has_connected_page": False,
            "has_preferences": False,
            "has_identity": False,
            "has_business_profile": False,
            "configure_stage": None,
            "active_page": None,
            "preferences": None,
            "all_pages": [],
            "total_pages": 0,
            "pending_human_count": 0,
        }

    org_slug = context["organization_slug"]
    active_page = None
    if page_id:
        active_page = db.query(FacebookPageConnection).filter(
            or_(
                FacebookPageConnection.user_id == context["user_id"],
                or_(FacebookPageConnection.user_id == org_slug, FacebookPageConnection.organization_slug == org_slug),
            ),
            FacebookPageConnection.page_id == page_id
        ).first()

    if not active_page:
        active_page = _active_page_for_org(db, org_slug)

    prefs_query = db.query(ChatbotPreferences).filter(
        or_(
            ChatbotPreferences.user_id == context["user_id"],
            or_(ChatbotPreferences.user_id == org_slug, ChatbotPreferences.organization_slug == org_slug),
        )
    )
    prefs = None
    if active_page:
        prefs = prefs_query.filter(ChatbotPreferences.page_id == active_page.page_id).first()
    
    if not prefs:
        prefs = prefs_query.filter(ChatbotPreferences.page_id.is_(None)).first()
    if not prefs:
        prefs = prefs_query.first()

    visible_statuses = [
        "active",
        "pending",
        "sync_error",
        "reconnect_required",
        "inactive",
        "disconnected",
        "permissions_missing",
    ]

    all_pages = (
        db.query(FacebookPageConnection)
        .filter(
            or_(
                FacebookPageConnection.user_id == context["user_id"],
                or_(FacebookPageConnection.user_id == org_slug, FacebookPageConnection.organization_slug == org_slug),
            ),
            FacebookPageConnection.status.in_(visible_statuses),
        )
        .order_by(FacebookPageConnection.updated_at.desc())
        .all()
    )

    has_connected_page = active_page is not None
    has_identity = _has_identity_preferences(prefs)
    has_business_profile = _has_business_profile(prefs)
    configure_stage = _configure_stage(prefs)
    step = _setup_step(active_page, prefs)

    pending_human_count = 0
    if has_connected_page:
        try:
            dashboard_state, records = await _fetch_messenger_dashboard_bundle(org_slug, active_page.page_id)
            totals = _build_messenger_totals(
                dashboard_state.get("summary", []),
                dashboard_state.get("conversations", []),
                records,
            )
            pending_human_count = totals.get("needsAttentionContacts", 0)
        except Exception as e:
            # Silently fallback to 0 if direct service fails to reply
            pass

    def _serialize_page(p: FacebookPageConnection) -> dict:
        return {
            "page_id": p.page_id,
            "page_name": p.page_name,
            "page_picture_url": getattr(p, "page_picture_url", None) or "",
            "page_category": p.page_category or "",
            "status": p.status,
            "is_active": p.is_active == "true",
            "webhook_subscribed": p.webhook_subscribed == "true",
            "direct_service_synced": p.direct_service_synced == "true",
            "last_error": _user_safe_last_error(p.last_error),
            "connected_at": p.connected_at.isoformat() if p.connected_at else None,
            "last_synced_at": p.last_synced_at.isoformat() if p.last_synced_at else None,
        }

    return {
        "step": step,
        "has_connected_page": has_connected_page,
        "has_preferences": has_identity,
        "has_identity": has_identity,
        "has_business_profile": has_business_profile,
        "configure_stage": configure_stage,
        "active_page": _serialize_page(active_page) if active_page else None,
        "preferences": _serialize_preferences(prefs, org_slug, context["user_id"]) if prefs else None,
        "all_pages": [_serialize_page(p) for p in all_pages],
        "total_pages": len(all_pages),
        "pending_human_count": pending_human_count,
    }



# ---------------------------------------------------------------------------
# Billing / plan features
# ---------------------------------------------------------------------------

@router.get("/billing/features")
def get_billing_features(
    authorization: Optional[str] = Header(None),
):
    context = _organization_context(authorization, allow_missing_scope=True)
    if not context:
        return {"plan_id": "free", "features": get_plan_features("free")}

    plan_id, features = _resolve_plan_features(context)
    return {"plan_id": plan_id, "features": features}


# ---------------------------------------------------------------------------
# Catalogue CRUD
# ---------------------------------------------------------------------------

class CatalogueItemPayload(BaseModel):
    name: str
    description: str = ""
    price: Optional[str] = None
    category: str = ""
    image_url: str = ""
    product_images: list[str] = []
    sort_order: int = 0
    is_active: bool = True


def _normalize_catalogue_images(images: Optional[list[str]], fallback_image: str = "") -> list[str]:
    normalized: list[str] = []
    for raw in images or []:
        cleaned = _clean_text(raw, 1000)
        if cleaned and (
            cleaned.startswith("http://")
            or cleaned.startswith("https://")
            or cleaned.startswith("data:image/")
        ) and cleaned not in normalized:
            normalized.append(cleaned)
        if len(normalized) >= 8:
            break
    fallback = _clean_text(fallback_image, 1000)
    if fallback and (
        fallback.startswith("http://")
        or fallback.startswith("https://")
        or fallback.startswith("data:image/")
    ) and fallback not in normalized:
        normalized.append(fallback)
    return normalized[:8]


def _decode_catalogue_images(raw_json: Optional[str], image_url: Optional[str]) -> list[str]:
    try:
        parsed = _json.loads(raw_json or "[]")
    except Exception:
        parsed = []
    normalized = _normalize_catalogue_images(parsed if isinstance(parsed, list) else [], image_url or "")
    return normalized


def _serialize_catalogue_item(item: ChatbotCatalogueItem) -> dict:
    product_images = _decode_catalogue_images(item.product_images_json, item.image_url)
    primary_image = product_images[0] if product_images else ""
    return {
        "id": item.id,
        "user_id": item.user_id or item.organization_slug,
        "name": item.name,
        "description": item.description or "",
        "price": item.price,
        "category": item.category or "",
        "image_url": primary_image,
        "product_images": product_images,
        "sort_order": item.sort_order or 0,
        "is_active": item.is_active != "false",
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/chatbot/catalogue")
def list_catalogue(
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization)
    user_id = context["user_id"]
    query = db.query(ChatbotCatalogueItem).filter(
        or_(
            ChatbotCatalogueItem.user_id == user_id,
            ChatbotCatalogueItem.organization_slug == user_id,
        )
    )
    if page_id:
        query = query.filter(ChatbotCatalogueItem.page_id == page_id)
    else:
        query = query.filter(ChatbotCatalogueItem.page_id.is_(None))

    items = query.order_by(ChatbotCatalogueItem.sort_order, ChatbotCatalogueItem.created_at).all()
    return [_serialize_catalogue_item(i) for i in items]


@router.post("/chatbot/catalogue", status_code=201)
async def create_catalogue_item(
    payload: CatalogueItemPayload,
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    _plan_id, features = _resolve_plan_features(context)
    limit = features.get("catalogue_items_limit", 5)
    if limit != -1:
        user_id = context["user_id"]
        query = db.query(ChatbotCatalogueItem).filter(
            or_(
                ChatbotCatalogueItem.user_id == user_id,
                ChatbotCatalogueItem.organization_slug == user_id,
            )
        )
        if page_id:
            query = query.filter(ChatbotCatalogueItem.page_id == page_id)
        else:
            query = query.filter(ChatbotCatalogueItem.page_id.is_(None))
        count = query.count()
        if count >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"Limite atteinte : vous ne pouvez pas ajouter plus de {limit} éléments dans votre plan."
            )

    product_images = _normalize_catalogue_images(payload.product_images, payload.image_url)

    item = ChatbotCatalogueItem(
        organization_slug=context["organization_slug"],
        user_id=context["user_id"],
        page_id=page_id,
        name=_clean_text(payload.name, 120, "Article"),
        description=_clean_text(payload.description, 1000),
        price=_clean_text(payload.price, 40) if payload.price else None,
        category=_clean_text(payload.category, 80),
        image_url=product_images[0] if product_images else "",
        product_images_json=_json.dumps(product_images, ensure_ascii=False),
        sort_order=payload.sort_order,
        is_active="true" if payload.is_active else "false",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    response = _serialize_catalogue_item(item)
    sync_warning = await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Catalogue mis a jour",
    )
    if sync_warning:
        response["sync_warning"] = sync_warning
    return response


@router.put("/chatbot/catalogue/{item_id}")
async def update_catalogue_item(
    item_id: str,
    payload: CatalogueItemPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    item = (
        db.query(ChatbotCatalogueItem)
        .filter(
            ChatbotCatalogueItem.id == item_id,
            or_(
                ChatbotCatalogueItem.user_id == context["user_id"],
                ChatbotCatalogueItem.organization_slug == context["organization_slug"],
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Article introuvable.")
    product_images = _normalize_catalogue_images(payload.product_images, payload.image_url)
    item.name = _clean_text(payload.name, 120, "Article")
    item.description = _clean_text(payload.description, 1000)
    item.price = _clean_text(payload.price, 40) if payload.price else None
    item.category = _clean_text(payload.category, 80)
    item.image_url = product_images[0] if product_images else ""
    item.product_images_json = _json.dumps(product_images, ensure_ascii=False)
    item.sort_order = payload.sort_order
    item.is_active = "true" if payload.is_active else "false"
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    response = _serialize_catalogue_item(item)
    sync_warning = await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Catalogue mis a jour",
    )
    if sync_warning:
        response["sync_warning"] = sync_warning
    return response


@router.delete("/chatbot/catalogue/{item_id}", status_code=204)
async def delete_catalogue_item(
    item_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    item = (
        db.query(ChatbotCatalogueItem)
        .filter(
            ChatbotCatalogueItem.id == item_id,
            or_(
                ChatbotCatalogueItem.user_id == context["user_id"],
                ChatbotCatalogueItem.organization_slug == context["organization_slug"],
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Article introuvable.")
    db.delete(item)
    db.commit()
    await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Catalogue mis a jour",
    )


# ---------------------------------------------------------------------------
# Portfolio CRUD
# ---------------------------------------------------------------------------

class PortfolioItemPayload(BaseModel):
    title: str
    description: str = ""
    video_url: str = ""
    external_url: str = ""
    client_name: str = ""
    auto_share: bool = False
    sort_order: int = 0


def _serialize_portfolio_item(item: ChatbotPortfolioItem) -> dict:
    return {
        "id": item.id,
        "user_id": item.user_id or item.organization_slug,
        "title": item.title,
        "description": item.description or "",
        "video_url": item.video_url or "",
        "external_url": item.external_url or "",
        "client_name": item.client_name or "",
        "auto_share": item.auto_share == "true",
        "sort_order": item.sort_order or 0,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/chatbot/portfolio")
def list_portfolio(
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization)
    _require_feature(context, "has_portfolio", "Portfolio")
    
    query = db.query(ChatbotPortfolioItem).filter(
        or_(
            ChatbotPortfolioItem.user_id == context["user_id"],
            ChatbotPortfolioItem.organization_slug == context["organization_slug"],
        )
    )
    if page_id:
        query = query.filter(ChatbotPortfolioItem.page_id == page_id)
    else:
        query = query.filter(ChatbotPortfolioItem.page_id.is_(None))

    items = query.order_by(ChatbotPortfolioItem.sort_order, ChatbotPortfolioItem.created_at).all()
    return [_serialize_portfolio_item(i) for i in items]


@router.post("/chatbot/portfolio", status_code=201)
async def create_portfolio_item(
    payload: PortfolioItemPayload,
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    _require_feature(context, "has_portfolio", "Portfolio")
    item = ChatbotPortfolioItem(
        organization_slug=context["organization_slug"],
        user_id=context["user_id"],
        page_id=page_id,
        title=_clean_text(payload.title, 120, "Réalisation"),
        description=_clean_text(payload.description, 1000),
        video_url=_clean_text(payload.video_url, 500),
        external_url=_clean_text(payload.external_url, 500),
        client_name=_clean_text(payload.client_name, 120),
        auto_share="true" if payload.auto_share else "false",
        sort_order=payload.sort_order,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    response = _serialize_portfolio_item(item)
    sync_warning = await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Portfolio mis a jour",
    )
    if sync_warning:
        response["sync_warning"] = sync_warning
    return response


@router.put("/chatbot/portfolio/{item_id}")
async def update_portfolio_item(
    item_id: str,
    payload: PortfolioItemPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    _require_feature(context, "has_portfolio", "Portfolio")
    item = (
        db.query(ChatbotPortfolioItem)
        .filter(
            ChatbotPortfolioItem.id == item_id,
            or_(
                ChatbotPortfolioItem.user_id == context["user_id"],
                ChatbotPortfolioItem.organization_slug == context["organization_slug"],
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Réalisation introuvable.")
    item.title = _clean_text(payload.title, 120, "Réalisation")
    item.description = _clean_text(payload.description, 1000)
    item.video_url = _clean_text(payload.video_url, 500)
    item.external_url = _clean_text(payload.external_url, 500)
    item.client_name = _clean_text(payload.client_name, 120)
    item.auto_share = "true" if payload.auto_share else "false"
    item.sort_order = payload.sort_order
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    response = _serialize_portfolio_item(item)
    sync_warning = await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Portfolio mis a jour",
    )
    if sync_warning:
        response["sync_warning"] = sync_warning
    return response


@router.delete("/chatbot/portfolio/{item_id}", status_code=204)
async def delete_portfolio_item(
    item_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    _require_feature(context, "has_portfolio", "Portfolio")
    item = (
        db.query(ChatbotPortfolioItem)
        .filter(
            ChatbotPortfolioItem.id == item_id,
            or_(
                ChatbotPortfolioItem.user_id == context["user_id"],
                ChatbotPortfolioItem.organization_slug == context["organization_slug"],
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Réalisation introuvable.")
    db.delete(item)
    db.commit()
    await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Portfolio mis a jour",
    )


# ---------------------------------------------------------------------------
# Sales config
# ---------------------------------------------------------------------------


class SalesConfigPayload(BaseModel):
    qualification_steps: list = []
    objections: list = []
    cta_type: str = "contact"
    cta_text: str = ""
    cta_url: str = ""
    hot_lead_signals: list = []
    handoff_mode: str = "auto"
    handoff_keywords: list = []


def _serialize_sales_config(row: Optional[ChatbotSalesConfig], org_slug: str) -> dict:
    def _load(val):
        if not val:
            return []
        try:
            return _json.loads(val)
        except Exception:
            return []

    if not row:
        return {
            "user_id": org_slug,
            "qualification_steps": [],
            "objections": [],
            "cta_type": "contact",
            "cta_text": "",
            "cta_url": "",
            "hot_lead_signals": [],
            "handoff_mode": "auto",
            "handoff_keywords": [],
            "updated_at": None,
        }
    return {
        "user_id": row.user_id or org_slug,
        "qualification_steps": _load(row.qualification_steps),
        "objections": _load(row.objections),
        "cta_type": row.cta_type or "contact",
        "cta_text": row.cta_text or "",
        "cta_url": row.cta_url or "",
        "hot_lead_signals": _load(row.hot_lead_signals),
        "handoff_mode": row.handoff_mode or "auto",
        "handoff_keywords": _load(row.handoff_keywords),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/chatbot/sales-config")
def get_sales_config(
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization)
    _require_feature(context, "has_sales_script", "Script de vente")
    
    query = db.query(ChatbotSalesConfig).filter(
        or_(
            ChatbotSalesConfig.user_id == context["user_id"],
            ChatbotSalesConfig.organization_slug == context["organization_slug"],
        )
    )
    
    if page_id:
        row = query.filter(ChatbotSalesConfig.page_id == page_id).first()
        if not row:
            row = query.filter(ChatbotSalesConfig.page_id.is_(None)).first()
    else:
        row = query.filter(ChatbotSalesConfig.page_id.is_(None)).first()

    return _serialize_sales_config(row, context["organization_slug"])


@router.put("/chatbot/sales-config")
async def upsert_sales_config(
    payload: SalesConfigPayload,
    page_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    context = _organization_context(authorization, require_edit=True)
    _require_feature(context, "has_sales_script", "Script de vente")
    
    query = db.query(ChatbotSalesConfig).filter(
        or_(
            ChatbotSalesConfig.user_id == context["user_id"],
            ChatbotSalesConfig.organization_slug == context["organization_slug"],
        )
    )
    
    if page_id:
        row = query.filter(ChatbotSalesConfig.page_id == page_id).first()
    else:
        row = query.filter(ChatbotSalesConfig.page_id.is_(None)).first()

    if not row:
        row = ChatbotSalesConfig(
            organization_slug=context["organization_slug"],
            user_id=context["user_id"],
            page_id=page_id,
            created_at=datetime.utcnow()
        )
        db.add(row)
    row.qualification_steps = _json.dumps(payload.qualification_steps)
    row.objections = _json.dumps(payload.objections)
    row.cta_type = _clean_text(payload.cta_type, 40, "contact")
    row.cta_text = _clean_text(payload.cta_text, 200)
    row.cta_url = _clean_text(payload.cta_url, 500)
    row.hot_lead_signals = _json.dumps(payload.hot_lead_signals)
    row.handoff_mode = _clean_text(payload.handoff_mode, 40, "auto")
    row.handoff_keywords = _json.dumps(payload.handoff_keywords)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    response = _serialize_sales_config(row, context["organization_slug"])
    sync_warning = await _sync_active_pages_for_org(
        db,
        context["organization_slug"],
        warning_prefix="Script de vente mis a jour",
    )
    if sync_warning:
        response["sync_warning"] = sync_warning
    return response

