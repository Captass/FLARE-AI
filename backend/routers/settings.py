"""
Router Settings - Parametres utilisateur et identite de l'espace FLARE AI.
"""
import base64
import logging
import re
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth import get_user_id_from_header, get_user_identity
from core.database import SystemSetting, get_db
from core.firebase_client import firebase_storage as storage
from core.identity import (
    ORGANIZATION_BRANDING_KEY,
    USER_PROFILE_KEY,
    load_organization_branding,
    load_user_profile,
    save_setting_json,
)
from core.organizations import (
    get_organization,
    get_user_role_in_organization,
    get_user_role_label,
    organization_scope_id,
    user_can_access_organization,
    user_can_edit_organization,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])


class UpdatePreferencesRequest(BaseModel):
    value: str


class UserProfileRequest(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    workspace_name: Optional[str] = None


class OrganizationBrandingRequest(BaseModel):
    organization_name: Optional[str] = None
    logo_url: Optional[str] = None
    workspace_name: Optional[str] = None
    workspace_description: Optional[str] = None


class IdentityAssetUploadRequest(BaseModel):
    target: Literal["user_avatar", "organization_logo"]
    file_name: str
    mime_type: str
    data_url: str


def _extract_org_slug(scoped_user_id: str) -> Optional[str]:
    if not scoped_user_id.startswith("org:"):
        return None
    return scoped_user_id.split(":", 1)[1].strip() or None


def _clean_text(value: Optional[str], *, limit: int, fallback: Optional[str] = None) -> str:
    text = str(value or "").strip()
    if not text:
        return fallback or ""
    return text[:limit]


def _decode_image_data_url(data_url: str, mime_type: str) -> bytes:
    if not data_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="Image invalide.")

    try:
        header, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Image invalide.") from exc

    if ";base64" not in header:
        raise HTTPException(status_code=400, detail="Format image non supporte.")

    if not str(mime_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Seules les images sont acceptees.")

    try:
        raw = base64.b64decode(encoded)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image invalide.") from exc

    if len(raw) > 3 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop lourde. Limite : 3 MB.")

    return raw


def _safe_filename(file_name: str, default_ext: str = ".png") -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9._-]+", "-", str(file_name or "").strip()).strip("-")
    if not sanitized:
        sanitized = f"asset{default_ext}"
    if "." not in sanitized:
        sanitized = f"{sanitized}{default_ext}"
    return sanitized.lower()


def _build_identity_response(
    db: Session,
    raw_user_id: str,
    user_email: str,
    scoped_user_id: str,
) -> dict:
    user_profile = load_user_profile(db, raw_user_id, user_email)
    org_slug = _extract_org_slug(scoped_user_id)
    organization = get_organization(org_slug) if org_slug else None
    organization_role = get_user_role_in_organization(user_email, organization=organization)
    has_organization_access = bool(
        organization and user_can_access_organization(user_email, organization["slug"])
    )
    can_edit_organization = bool(
        organization and user_can_edit_organization(user_email, organization=organization)
    )

    organization_branding = (
        load_organization_branding(db, scoped_user_id, organization)
        if organization and has_organization_access
        else None
    )

    current_branding = {
        "scope_type": "organization" if organization_branding else "personal",
        "organization_slug": organization["slug"] if organization else None,
        "brand_name": organization_branding["organization_name"] if organization_branding else "FLARE AI",
        "workspace_name": (
            organization_branding["workspace_name"]
            if organization_branding
            else user_profile["workspace_name"]
        ),
        "workspace_description": (
            organization_branding["workspace_description"]
            if organization_branding
            else "Votre espace de travail personnel."
        ),
        "logo_url": organization_branding["logo_url"] if organization_branding else "",
    }

    return {
        "user_profile": user_profile,
        "organization_branding": organization_branding,
        "current_branding": current_branding,
        "can_edit_organization": can_edit_organization,
        "organization_role": organization_role,
        "organization_role_label": get_user_role_label(organization_role) if organization else None,
    }


@router.get("/user-preferences")
def get_user_preferences(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = get_user_id_from_header(authorization)
    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "user_preferences",
        SystemSetting.user_id == user_id,
    ).first()
    if setting:
        return {"value": setting.value}
    return {"value": ""}


@router.post("/user-preferences")
def update_user_preferences(
    req: UpdatePreferencesRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "user_preferences",
        SystemSetting.user_id == user_id,
    ).first()
    if setting:
        setting.value = req.value
    else:
        setting = SystemSetting(key="user_preferences", user_id=user_id, value=req.value)
        db.add(setting)

    db.commit()
    logger.info("Preferences sauvegardees pour user=%s (%s chars)", user_id, len(req.value))
    return {"status": "success", "value": setting.value}


@router.delete("/user-preferences")
def reset_user_preferences(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = get_user_id_from_header(authorization)
    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "user_preferences",
        SystemSetting.user_id == user_id,
    ).first()
    if setting:
        db.delete(setting)
        db.commit()
        logger.info("Preferences reinitialisees pour user=%s", user_id)
    return {"status": "success", "value": ""}


@router.get("/workspace-identity")
def get_workspace_identity(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    scoped_user_id = get_user_id_from_header(authorization)
    return _build_identity_response(db, raw_user_id, user_email, scoped_user_id)


@router.post("/user-profile")
def update_user_profile(
    req: UserProfileRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    next_value = load_user_profile(db, raw_user_id, user_email)
    if req.display_name is not None:
        next_value["display_name"] = _clean_text(req.display_name, limit=80, fallback=next_value["display_name"])
    if req.full_name is not None:
        next_value["full_name"] = _clean_text(req.full_name, limit=120)
    if req.avatar_url is not None:
        next_value["avatar_url"] = _clean_text(req.avatar_url, limit=2048)
    if req.workspace_name is not None:
        next_value["workspace_name"] = _clean_text(req.workspace_name, limit=100, fallback="Mon espace")

    save_setting_json(db, USER_PROFILE_KEY, raw_user_id, next_value)
    db.commit()

    return _build_identity_response(
        db,
        raw_user_id,
        user_email,
        get_user_id_from_header(authorization),
    )


@router.post("/organization-branding")
def update_organization_branding(
    req: OrganizationBrandingRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    scoped_user_id = get_user_id_from_header(authorization)
    org_slug = _extract_org_slug(scoped_user_id)
    organization = get_organization(org_slug)
    if not org_slug or not organization or not user_can_edit_organization(user_email, org_slug):
        raise HTTPException(status_code=403, detail="Organisation active requise.")

    next_value = load_organization_branding(db, scoped_user_id, organization)
    if req.organization_name is not None:
        next_value["organization_name"] = _clean_text(
            req.organization_name,
            limit=100,
            fallback=next_value["organization_name"],
        )
    if req.logo_url is not None:
        next_value["logo_url"] = _clean_text(req.logo_url, limit=2048)
    if req.workspace_name is not None:
        next_value["workspace_name"] = _clean_text(
            req.workspace_name,
            limit=100,
            fallback=next_value["workspace_name"],
        )
    if req.workspace_description is not None:
        next_value["workspace_description"] = _clean_text(
            req.workspace_description,
            limit=220,
            fallback=next_value["workspace_description"],
        )

    save_setting_json(db, ORGANIZATION_BRANDING_KEY, scoped_user_id, next_value)
    db.commit()

    return _build_identity_response(db, raw_user_id, user_email, scoped_user_id)


@router.post("/identity-asset")
def upload_identity_asset(
    req: IdentityAssetUploadRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    raw_user_id, user_email = get_user_identity(authorization)
    if raw_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    scoped_user_id = get_user_id_from_header(authorization)
    file_bytes = _decode_image_data_url(req.data_url, req.mime_type)
    safe_name = _safe_filename(req.file_name)

    if req.target == "user_avatar":
        storage_path = f"identity/users/{raw_user_id}/avatar/{uuid.uuid4().hex}-{safe_name}"
    else:
        org_slug = _extract_org_slug(scoped_user_id)
        organization = get_organization(org_slug)
        if not org_slug or not organization or not user_can_edit_organization(user_email, org_slug):
            raise HTTPException(status_code=403, detail="Organisation active requise.")
        storage_path = (
            f"identity/organizations/{organization_scope_id(org_slug)}/logo/"
            f"{uuid.uuid4().hex}-{safe_name}"
        )

    public_url = storage.upload_file(
        bucket_name="",
        path=storage_path,
        file_bytes=file_bytes,
        content_type=req.mime_type,
    )
    if not public_url:
        raise HTTPException(status_code=500, detail="Upload impossible pour le moment.")

    return {"status": "success", "url": public_url, "path": storage_path}


@router.get("/system-prompt")
def get_system_prompt_compat(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = get_user_id_from_header(authorization)
    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "user_preferences",
        SystemSetting.user_id == user_id,
    ).first()
    if setting:
        return {"value": setting.value}
    return {"value": ""}


@router.post("/system-prompt")
def update_system_prompt_compat(
    req: UpdatePreferencesRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "user_preferences",
        SystemSetting.user_id == user_id,
    ).first()
    if setting:
        setting.value = req.value
    else:
        setting = SystemSetting(key="user_preferences", user_id=user_id, value=req.value)
        db.add(setting)

    db.commit()
    return {"status": "success", "value": setting.value}


@router.delete("/system-prompt")
def reset_system_prompt_compat(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = get_user_id_from_header(authorization)
    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "user_preferences",
        SystemSetting.user_id == user_id,
    ).first()
    if setting:
        db.delete(setting)
        db.commit()
    return {"status": "success", "value": ""}
