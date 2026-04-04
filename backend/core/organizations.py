import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from core.config import settings

ACTIVE_ORGANIZATION_KEY = "active_organization"
ORGANIZATION_REGISTRY_KEY = "organization_registry_v1"
ORGANIZATION_REGISTRY_USER_ID = "system"
EDITABLE_ORGANIZATION_ROLES = {"owner", "admin"}
DEFAULT_ROLE = "member"

ROLE_LABELS = {
    "owner": "Proprietaire",
    "admin": "Admin",
    "member": "Membre",
    "viewer": "Lecture",
}

# Never ship a shared seed workspace by default in production. Every visible
# organization must come from the explicit registry JSON or dynamic creations.
DEFAULT_ORGANIZATIONS: List[Dict[str, Any]] = []


def _normalize_email(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _normalize_slug(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _normalize_role(value: Optional[str]) -> str:
    role = str(value or "").strip().lower()
    return role if role in ROLE_LABELS else DEFAULT_ROLE


def _slugify(value: Optional[str]) -> str:
    raw = str(value or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return normalized[:60]


def _fallback_display_name(email: str) -> str:
    local_part = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
    cleaned = " ".join(part for part in local_part.split() if part)
    return cleaned.title() if cleaned else email


def _normalize_members(item: Dict[str, Any]) -> List[Dict[str, str]]:
    raw_members = item.get("members")
    members: List[Dict[str, str]] = []

    if isinstance(raw_members, list):
        for raw_member in raw_members:
            if isinstance(raw_member, str):
                email = _normalize_email(raw_member)
                if not email:
                    continue
                members.append(
                    {
                        "email": email,
                        "display_name": _fallback_display_name(email),
                        "role": DEFAULT_ROLE,
                    }
                )
                continue

            if not isinstance(raw_member, dict):
                continue

            email = _normalize_email(raw_member.get("email"))
            if not email:
                continue

            members.append(
                {
                    "email": email,
                    "display_name": str(raw_member.get("display_name") or "").strip() or _fallback_display_name(email),
                    "role": _normalize_role(raw_member.get("role")),
                }
            )

    if members:
        return members

    for email in item.get("member_emails", []):
        normalized_email = _normalize_email(email)
        if not normalized_email:
            continue
        members.append(
            {
                "email": normalized_email,
                "display_name": _fallback_display_name(normalized_email),
                "role": DEFAULT_ROLE,
            }
        )
    return members


def _load_registry() -> Dict[str, Dict[str, Any]]:
    raw_registry = settings.ORGANIZATION_REGISTRY_JSON.strip() if settings.ORGANIZATION_REGISTRY_JSON else ""
    source: List[Dict[str, Any]]

    if raw_registry:
        try:
            parsed = json.loads(raw_registry)
            source = parsed if isinstance(parsed, list) else []
        except Exception:
            source = DEFAULT_ORGANIZATIONS
    else:
        source = DEFAULT_ORGANIZATIONS

    registry: Dict[str, Dict[str, Any]] = {}

    def _register(item: Dict[str, Any], *, is_dynamic: bool) -> None:
        slug = _normalize_slug(item.get("slug"))
        if not slug:
            return

        members = _normalize_members(item)
        member_emails = [member["email"] for member in members]

        registry[slug] = {
            "slug": slug,
            "name": item.get("name") or slug.upper(),
            "members": members,
            "member_emails": member_emails,
            "plan_id": item.get("plan_id") or "free",
            "offer_name": item.get("offer_name") or "Gratuit",
            "security_label": item.get("security_label") or "Compte + connexion a l'organisation",
            "description": item.get("description") or "Espace partage entre membres verifies.",
            "enabled_modules": item.get("enabled_modules") or ["chatbot", "assistant", "automations"],
            "is_dynamic": is_dynamic,
        }

    for item in source:
        _register(item, is_dynamic=False)

    try:
        from core.database import SessionLocal, SystemSetting

        db = SessionLocal()
        try:
            setting = db.query(SystemSetting).filter(
                SystemSetting.user_id == ORGANIZATION_REGISTRY_USER_ID,
                SystemSetting.key == ORGANIZATION_REGISTRY_KEY,
            ).first()
        finally:
            db.close()

        if setting and setting.value:
            parsed_dynamic = json.loads(setting.value)
            if isinstance(parsed_dynamic, list):
                for item in parsed_dynamic:
                    if isinstance(item, dict):
                        _register(item, is_dynamic=True)
    except Exception:
        pass

    return registry


def _persist_dynamic_organizations(organizations: List[Dict[str, Any]]) -> None:
    from core.database import SessionLocal, SystemSetting

    payload = json.dumps(organizations, ensure_ascii=False)
    db = SessionLocal()
    try:
        setting = db.query(SystemSetting).filter(
            SystemSetting.user_id == ORGANIZATION_REGISTRY_USER_ID,
            SystemSetting.key == ORGANIZATION_REGISTRY_KEY,
        ).first()
        if setting:
            setting.value = payload
        else:
            db.add(
                SystemSetting(
                    user_id=ORGANIZATION_REGISTRY_USER_ID,
                    key=ORGANIZATION_REGISTRY_KEY,
                    value=payload,
                )
            )
        db.commit()
    finally:
        db.close()


def list_dynamic_organizations() -> List[Dict[str, Any]]:
    return [organization for organization in _load_registry().values() if organization.get("is_dynamic")]


def create_organization(name: str, owner_email: str) -> Dict[str, Any]:
    normalized_owner = _normalize_email(owner_email)
    if not normalized_owner:
        raise ValueError("owner_email is required")

    base_slug = _slugify(name) or _slugify(normalized_owner.split("@")[0]) or "workspace"
    registry = _load_registry()
    slug = base_slug
    suffix = 2
    while slug in registry:
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    organization = {
        "slug": slug,
        "name": str(name or "").strip() or "Nouvel espace",
        "members": [
            {
                "email": normalized_owner,
                "display_name": _fallback_display_name(normalized_owner),
                "role": "owner",
            }
        ],
        "plan_id": "free",
        "offer_name": "Gratuit",
        "security_label": "Compte + connexion a l'organisation",
        "description": "Espace partage entre membres verifies.",
        "enabled_modules": ["chatbot", "assistant", "automations"],
        "is_dynamic": True,
    }

    dynamic = list_dynamic_organizations()
    dynamic.append(organization)
    _persist_dynamic_organizations(dynamic)
    return get_organization(slug) or organization


def delete_organization(slug: str, owner_email: str) -> bool:
    candidate = get_organization(slug)
    if not candidate or not candidate.get("is_dynamic"):
        return False
    if get_user_role_in_organization(owner_email, organization=candidate) != "owner":
        return False

    dynamic = [organization for organization in list_dynamic_organizations() if organization.get("slug") != candidate["slug"]]
    _persist_dynamic_organizations(dynamic)
    return True


def get_organization(slug: Optional[str]) -> Optional[Dict[str, Any]]:
    registry = _load_registry()
    return registry.get(_normalize_slug(slug))


def list_user_organizations(email: Optional[str]) -> List[Dict[str, Any]]:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return []

    memberships: List[Dict[str, Any]] = []
    for organization in _load_registry().values():
        if normalized_email in organization["member_emails"]:
            memberships.append(serialize_organization(organization, normalized_email))
    return memberships


def user_can_access_organization(email: Optional[str], slug: Optional[str]) -> bool:
    organization = get_organization(slug)
    if not organization:
        return False
    return _normalize_email(email) in organization["member_emails"]


def organization_scope_id(slug: str) -> str:
    return f"org:{_normalize_slug(slug)}"


def get_user_role_in_organization(email: Optional[str], slug: Optional[str] = None, organization: Optional[Dict[str, Any]] = None) -> Optional[str]:
    candidate = organization or get_organization(slug)
    normalized_email = _normalize_email(email)
    if not candidate or not normalized_email:
        return None

    for member in candidate.get("members", []):
        if member["email"] == normalized_email:
            return member["role"]
    return None


def get_user_role_label(role: Optional[str]) -> str:
    normalized_role = _normalize_role(role)
    return ROLE_LABELS.get(normalized_role, ROLE_LABELS[DEFAULT_ROLE])


def user_can_edit_organization(email: Optional[str], slug: Optional[str] = None, organization: Optional[Dict[str, Any]] = None) -> bool:
    return bool(get_user_role_in_organization(email, slug, organization) in EDITABLE_ORGANIZATION_ROLES)


def serialize_member(member: Dict[str, Any]) -> Dict[str, str]:
    role = _normalize_role(member.get("role"))
    return {
        "email": _normalize_email(member.get("email")),
        "display_name": str(member.get("display_name") or "").strip() or _fallback_display_name(_normalize_email(member.get("email"))),
        "role": role,
        "role_label": get_user_role_label(role),
    }


def serialize_organization(organization: Dict[str, Any], current_user_email: Optional[str] = None) -> Dict[str, Any]:
    current_user_role = get_user_role_in_organization(current_user_email, organization=organization)
    can_manage_facebook = current_user_role in EDITABLE_ORGANIZATION_ROLES
    return {
        "slug": organization["slug"],
        "name": organization["name"],
        "offer_name": organization["offer_name"],
        "plan_id": organization["plan_id"],
        "security_label": organization["security_label"],
        "description": organization["description"],
        "enabled_modules": organization["enabled_modules"],
        "member_count": len(organization["member_emails"]),
        "members": [serialize_member(member) for member in organization.get("members", [])],
        "current_user_role": current_user_role,
        "current_user_role_label": get_user_role_label(current_user_role),
        "can_edit_branding": can_manage_facebook,
        "can_manage_facebook": can_manage_facebook,
        "is_dynamic": bool(organization.get("is_dynamic")),
        "can_delete": bool(organization.get("is_dynamic")) and current_user_role == "owner",
    }


def encode_active_organization(slug: str, connected_at: Optional[datetime] = None) -> str:
    payload = {
        "slug": _normalize_slug(slug),
        "connected_at": (connected_at or datetime.utcnow()).isoformat(),
    }
    return json.dumps(payload)


def decode_active_organization(value: Optional[str]) -> tuple[Optional[str], Optional[datetime]]:
    raw = str(value or "").strip()
    if not raw:
        return None, None

    try:
        payload = json.loads(raw)
    except Exception:
        return _normalize_slug(raw), None

    slug = _normalize_slug(payload.get("slug"))
    connected_at_raw = str(payload.get("connected_at") or "").strip()
    if not connected_at_raw:
        return slug or None, None

    try:
        connected_at = datetime.fromisoformat(connected_at_raw)
    except ValueError:
        connected_at = None

    return slug or None, connected_at


def is_active_organization_session_valid(connected_at: Optional[datetime]) -> bool:
    if not connected_at:
        return False
    ttl = max(1, int(settings.ORGANIZATION_SESSION_HOURS))
    return connected_at >= datetime.utcnow() - timedelta(hours=ttl)
