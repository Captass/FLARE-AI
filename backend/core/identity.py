import json
import re
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from core.database import SystemSetting

USER_PROFILE_KEY = "user_profile_v1"


def _compact_text(value: Optional[str], fallback: str = "", limit: int = 120) -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    return text[:limit]


def _pretty_name_from_email(email: Optional[str]) -> str:
    local = str(email or "").split("@")[0].strip()
    if not local:
        return "Utilisateur"
    normalized = re.sub(r"[_\-.]+", " ", local)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return "Utilisateur"
    return normalized.title()


def _load_setting_json(db: Session, key: str, user_id: str) -> Dict[str, Any]:
    setting = (
        db.query(SystemSetting)
        .filter(SystemSetting.key == key, SystemSetting.user_id == user_id)
        .first()
    )
    if not setting or not setting.value:
        return {}

    try:
        parsed = json.loads(setting.value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def save_setting_json(db: Session, key: str, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    setting = (
        db.query(SystemSetting)
        .filter(SystemSetting.key == key, SystemSetting.user_id == user_id)
        .first()
    )
    raw_value = json.dumps(payload, ensure_ascii=False)

    if setting:
        setting.value = raw_value
    else:
        db.add(SystemSetting(key=key, user_id=user_id, value=raw_value))

    return payload


def default_user_profile(email: Optional[str] = None) -> Dict[str, Any]:
    return {
        "display_name": _pretty_name_from_email(email),
        "full_name": "",
        "avatar_url": "",
        "workspace_name": "Mon compte",
        "guide_assistant_enabled": True,
    }


def load_user_profile(db: Session, user_id: str, email: Optional[str] = None) -> Dict[str, Any]:
    payload = default_user_profile(email)
    stored = _load_setting_json(db, USER_PROFILE_KEY, user_id)

    payload["display_name"] = _compact_text(
        stored.get("display_name"),
        fallback=payload["display_name"],
        limit=80,
    )
    payload["full_name"] = _compact_text(stored.get("full_name"), fallback="", limit=120)
    payload["avatar_url"] = _compact_text(stored.get("avatar_url"), fallback="", limit=2048)
    payload["workspace_name"] = _compact_text(
        stored.get("workspace_name"),
        fallback=payload["workspace_name"],
        limit=100,
    )
    payload["guide_assistant_enabled"] = bool(
        stored.get("guide_assistant_enabled", payload["guide_assistant_enabled"])
    )
    return payload
