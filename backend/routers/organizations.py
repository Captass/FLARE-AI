import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth import get_user_identity
from core.config import settings
from core.database import (
    FacebookPageConnection,
    SystemSetting,
    UserSubscription,
    get_db,
    get_user_subscription,
)
from core.identity import load_organization_branding, load_user_profile
from core.organizations import (
    ACTIVE_ORGANIZATION_KEY,
    create_organization,
    delete_organization,
    decode_active_organization,
    encode_active_organization,
    get_organization,
    get_user_role_in_organization,
    get_user_role_label,
    is_active_organization_session_valid,
    list_user_organizations,
    organization_scope_id,
    serialize_organization,
    user_can_access_organization,
    user_can_edit_organization,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


FACEBOOK_MANAGE_ROLES = {"owner", "admin"}


class ConnectOrganizationRequest(BaseModel):
    organization_slug: str


class CreateOrganizationRequest(BaseModel):
    name: str


def _facebook_access_info(scope_type: str, current_user_role: Optional[str]) -> dict:
    normalized_role = str(current_user_role or "").strip().lower()
    if scope_type != "organization":
        return {
            "can_manage_facebook": False,
            "facebook_access_code": "organization_required",
            "facebook_access_message": "Selectionnez d'abord un espace de travail pour connecter Facebook.",
        }
    if normalized_role not in FACEBOOK_MANAGE_ROLES:
        return {
            "can_manage_facebook": False,
            "facebook_access_code": "workspace_role_forbidden",
            "facebook_access_message": "Seuls le proprietaire ou un admin peuvent connecter et activer Facebook.",
        }
    return {
        "can_manage_facebook": True,
        "facebook_access_code": "ok",
        "facebook_access_message": "",
    }


def _get_active_organization_setting(db: Session, raw_user_id: str) -> Optional[SystemSetting]:
    return db.query(SystemSetting).filter(
        SystemSetting.user_id == raw_user_id,
        SystemSetting.key == ACTIVE_ORGANIZATION_KEY,
    ).first()


def _build_session_metadata(connected_at: Optional[datetime]) -> dict:
    if not connected_at:
        return {
            "connected_at": None,
            "expires_at": None,
            "session_ttl_hours": max(1, int(settings.ORGANIZATION_SESSION_HOURS)),
            "remaining_minutes": None,
        }

    ttl_hours = max(1, int(settings.ORGANIZATION_SESSION_HOURS))
    expires_at = connected_at + timedelta(hours=ttl_hours)
    remaining_minutes = max(0, int((expires_at - datetime.utcnow()).total_seconds() // 60))
    return {
        "connected_at": connected_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "session_ttl_hours": ttl_hours,
        "remaining_minutes": remaining_minutes,
    }


def _get_current_scope(raw_user_id: str, user_email: str, db: Session) -> dict:
    personal_subscription = get_user_subscription(raw_user_id)
    user_profile = load_user_profile(db, raw_user_id, user_email)
    personal_facebook_access = _facebook_access_info("personal", None)
    personal_scope = {
        "type": "personal",
        "scope_id": raw_user_id,
        "label": user_profile["workspace_name"],
        "description": "Vos agents, vos automatismes et vos donnees personnelles.",
        "offer_name": personal_subscription["plan_name"] if personal_subscription else "Free",
        "plan_id": personal_subscription["plan_id"] if personal_subscription else "free",
        "security_label": "Compte personnel",
        "workspace_name": user_profile["workspace_name"],
        "logo_url": "",
        "enabled_modules": ["assistant"],
        "current_user_role": "owner",
        "current_user_role_label": "Proprietaire",
        "can_edit_branding": True,
        "requires_workspace_for_chatbot": True,
        **personal_facebook_access,
        **_build_session_metadata(None),
    }

    setting = _get_active_organization_setting(db, raw_user_id)
    if not setting or not setting.value:
        return personal_scope

    slug, connected_at = decode_active_organization(setting.value)
    if not slug:
        return personal_scope

    organization = get_organization(slug)
    if not organization or not user_can_access_organization(user_email, slug):
        return personal_scope

    if not is_active_organization_session_valid(connected_at):
        try:
            db.delete(setting)
            db.commit()
        except Exception:
            db.rollback()
        return personal_scope

    organization_subscription = get_user_subscription(organization_scope_id(slug))
    branding = load_organization_branding(db, organization_scope_id(slug), organization)
    current_user_role = get_user_role_in_organization(user_email, organization=organization)
    organization_facebook_access = _facebook_access_info("organization", current_user_role)
    return {
        "type": "organization",
        "scope_id": organization_scope_id(slug),
        "label": branding["workspace_name"],
        "description": branding["workspace_description"],
        "offer_name": organization_subscription["plan_name"] if organization_subscription else organization["offer_name"],
        "plan_id": organization_subscription["plan_id"] if organization_subscription else organization["plan_id"],
        "security_label": organization["security_label"],
        "organization_slug": slug,
        "workspace_name": branding["workspace_name"],
        "organization_name": branding["organization_name"],
        "logo_url": branding["logo_url"],
        "enabled_modules": organization["enabled_modules"],
        "current_user_role": current_user_role,
        "current_user_role_label": get_user_role_label(current_user_role),
        "can_edit_branding": user_can_edit_organization(user_email, organization=organization),
        "requires_workspace_for_chatbot": False,
        **organization_facebook_access,
        **_build_session_metadata(connected_at),
    }


def _ensure_organization_subscription(db: Session, organization: dict) -> None:
    scope_id = organization_scope_id(organization["slug"])
    subscription = db.query(UserSubscription).filter(UserSubscription.user_id == scope_id).first()
    if subscription:
        subscription.plan_id = organization["plan_id"]
        if not subscription.user_email:
            subscription.user_email = f"organization:{organization['slug']}"
        return

    db.add(
        UserSubscription(
            user_id=scope_id,
            user_email=f"organization:{organization['slug']}",
            plan_id=organization["plan_id"],
            status="active",
        )
    )


@router.get("/access")
def get_organization_access(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    organizations = []
    for organization_summary in list_user_organizations(user_email):
        organization = get_organization(organization_summary["slug"])
        branding = load_organization_branding(
            db,
            organization_scope_id(organization_summary["slug"]),
            organization,
        )
        organization_facebook_access = _facebook_access_info(
            "organization",
            organization_summary.get("current_user_role"),
        )
        organizations.append(
            {
                **organization_summary,
                "name": branding["organization_name"],
                "workspace_name": branding["workspace_name"],
                "workspace_description": branding["workspace_description"],
                "logo_url": branding["logo_url"],
                **organization_facebook_access,
            }
        )
    current_scope = _get_current_scope(raw_user_id, user_email, db)

    return {
        "user_email": user_email,
        "current_scope": current_scope,
        "organizations": organizations,
        "has_shared_access": bool(organizations),
        "requires_connection_flow": bool(organizations),
        "can_connect_facebook": bool(current_scope.get("can_manage_facebook")),
        "facebook_access_code": current_scope.get("facebook_access_code"),
        "facebook_access_message": current_scope.get("facebook_access_message"),
        "session_ttl_hours": max(1, int(settings.ORGANIZATION_SESSION_HOURS)),
    }


@router.post("/connect")
def connect_organization(
    req: ConnectOrganizationRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    organization = get_organization(req.organization_slug)
    if not organization:
        raise HTTPException(status_code=404, detail="Organisation introuvable.")

    if not user_can_access_organization(user_email, organization["slug"]):
        raise HTTPException(status_code=403, detail="Acces refuse a cette organisation.")

    setting = _get_active_organization_setting(db, raw_user_id)
    value = encode_active_organization(organization["slug"])
    if setting:
        setting.value = value
    else:
        db.add(SystemSetting(user_id=raw_user_id, key=ACTIVE_ORGANIZATION_KEY, value=value))

    _ensure_organization_subscription(db, organization)
    db.commit()

    logger.info("Organisation connectee: user=%s email=%s org=%s", raw_user_id, user_email, organization["slug"])

    return {
        "status": "connected",
        "current_scope": _get_current_scope(raw_user_id, user_email, db),
        "organization": serialize_organization(organization, user_email),
    }


@router.post("")
def create_workspace_organization(
    req: CreateOrganizationRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    workspace_name = str(req.name or "").strip()
    if len(workspace_name) < 2:
        raise HTTPException(status_code=400, detail="Le nom de l'espace est trop court.")

    organization = create_organization(workspace_name, user_email)
    if get_user_role_in_organization(user_email, organization=organization) != "owner":
        raise HTTPException(
            status_code=500,
            detail="Impossible de creer un espace avec le role owner. Reessayez.",
        )
    setting = _get_active_organization_setting(db, raw_user_id)
    value = encode_active_organization(organization["slug"])
    if setting:
        setting.value = value
    else:
        db.add(SystemSetting(user_id=raw_user_id, key=ACTIVE_ORGANIZATION_KEY, value=value))

    _ensure_organization_subscription(db, organization)
    db.commit()

    logger.info(
        "Organisation creee: user=%s email=%s org=%s",
        raw_user_id,
        user_email,
        organization["slug"],
    )

    return {
        "status": "created",
        "current_scope": _get_current_scope(raw_user_id, user_email, db),
        "organization": serialize_organization(organization, user_email),
    }


@router.delete("/{organization_slug}")
def delete_workspace_organization(
    organization_slug: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    organization = get_organization(organization_slug)
    if not organization:
        raise HTTPException(status_code=404, detail="Organisation introuvable.")
    if not organization.get("is_dynamic"):
        raise HTTPException(status_code=400, detail="Cet espace ne peut pas etre supprime depuis l'application.")
    if get_user_role_in_organization(user_email, organization=organization) != "owner":
        raise HTTPException(status_code=403, detail="Seul le proprietaire peut supprimer cet espace.")

    connected_pages = db.query(FacebookPageConnection).filter(
        FacebookPageConnection.organization_slug == organization["slug"]
    ).count()
    if connected_pages > 0:
        raise HTTPException(
            status_code=409,
            detail="Deconnectez d'abord les pages Facebook liees a cet espace.",
        )

    deleted = delete_organization(organization["slug"], user_email)
    if not deleted:
        raise HTTPException(status_code=400, detail="Suppression impossible pour cet espace.")

    setting = _get_active_organization_setting(db, raw_user_id)
    if setting:
        active_slug, _ = decode_active_organization(setting.value)
        if active_slug == organization["slug"]:
            db.delete(setting)
    db.commit()

    logger.info(
        "Organisation supprimee: user=%s email=%s org=%s",
        raw_user_id,
        user_email,
        organization["slug"],
    )

    return {
        "status": "deleted",
        "current_scope": _get_current_scope(raw_user_id, user_email, db),
        "organization_slug": organization["slug"],
    }


@router.post("/personal")
def connect_personal_scope(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    setting = _get_active_organization_setting(db, raw_user_id)
    if setting:
        db.delete(setting)
        db.commit()

    logger.info("Retour a l'espace personnel: user=%s email=%s", raw_user_id, user_email)

    return {
        "status": "personal",
        "current_scope": _get_current_scope(raw_user_id, user_email, db),
    }
