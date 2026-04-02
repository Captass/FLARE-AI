import logging
from typing import Optional

import firebase_admin
from firebase_admin import auth, credentials
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from core.config import settings
from core.organizations import (
    ACTIVE_ORGANIZATION_KEY,
    decode_active_organization,
    get_organization,
    is_active_organization_session_valid,
    organization_scope_id,
    user_can_access_organization,
)

logger = logging.getLogger(__name__)

_firebase_apps: list[firebase_admin.App] = []
_google_request = google_requests.Request()


def _candidate_project_ids() -> list[str]:
    raw_ids = [
        settings.GOOGLE_CLOUD_PROJECT,
        settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        settings.FIREBASE_AUTH_PROJECT_IDS,
        "ramsflare",
        "rams-flare-ai",
    ]
    project_ids: list[str] = []
    for value in raw_ids:
        if not value:
            continue
        for item in str(value).split(","):
            project_id = item.strip()
            if project_id and project_id not in project_ids:
                project_ids.append(project_id)
    return project_ids


def _initialize_firebase_apps() -> list[firebase_admin.App]:
    apps: list[firebase_admin.App] = []
    try:
        cred = credentials.ApplicationDefault()
        for project_id in _candidate_project_ids():
            app_name = f"auth-{project_id}"
            try:
                app = firebase_admin.get_app(app_name)
            except ValueError:
                app = firebase_admin.initialize_app(
                    cred,
                    {"projectId": project_id},
                    name=app_name,
                )
            apps.append(app)
        if apps:
            logger.info(
                "Firebase Admin initialisé pour les projets auth: %s",
                ", ".join(_candidate_project_ids()),
            )
            return apps
    except Exception as exc:
        logger.warning(
            "Firebase Admin initialization (ApplicationDefault) failed: %s. Falling back to default app.",
            exc,
        )

    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        apps.append(firebase_admin.get_app())
    except Exception as exc:
        logger.error("Firebase Admin fallback initialization failed: %s", exc)
    return apps


_firebase_apps = _initialize_firebase_apps()


def _resolve_active_scope_id(raw_user_id: str, user_email: str) -> str:
    if not raw_user_id or raw_user_id == "anonymous":
        return "anonymous"

    try:
        from core.database import SessionLocal, SystemSetting

        db = SessionLocal()
        try:
            setting = db.query(SystemSetting).filter(
                SystemSetting.user_id == raw_user_id,
                SystemSetting.key == ACTIVE_ORGANIZATION_KEY,
            ).first()
        finally:
            db.close()
    except Exception as exc:
        logger.warning("Organisation lookup failed for %s: %s", raw_user_id, exc)
        return raw_user_id

    if not setting or not setting.value:
        return raw_user_id

    slug, connected_at = decode_active_organization(setting.value)
    if not slug or not get_organization(slug):
        return raw_user_id

    if not user_can_access_organization(user_email, slug):
        return raw_user_id

    if not is_active_organization_session_valid(connected_at):
        return raw_user_id

    return organization_scope_id(slug)


def _decode_token(authorization: Optional[str]) -> Optional[dict]:
    """Decode and verify a Firebase ID token from the Authorization header. Returns None on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    id_token = authorization.removeprefix("Bearer ").strip()
    if not id_token:
        return None

    last_error: Optional[Exception] = None

    # Vérification indépendante du projet GCP hébergeur.
    # Permet d'accepter les tokens Firebase des projets frontend actifs.
    for project_id in _candidate_project_ids():
        try:
            return google_id_token.verify_firebase_token(
                id_token,
                _google_request,
                audience=project_id,
            )
        except Exception as exc:
            last_error = exc

    for app in _firebase_apps:
        try:
            return auth.verify_id_token(id_token, check_revoked=True, app=app)
        except auth.RevokedIdTokenError:
            logger.warning("Token Firebase révoqué")
            return None
        except Exception as exc:
            last_error = exc

    if last_error:
        logger.error("Erreur vérification Firebase Token: %s", last_error)
    return None


def get_user_id_from_header(authorization: Optional[str]) -> str:
    """
    Vérifie le token Firebase ID présent dans le header Authorization.
    Utilise firebase-admin pour valider la signature et l'expiration.
    """
    decoded = _decode_token(authorization)
    if decoded:
        user_id = decoded.get("uid") or decoded.get("user_id") or decoded.get("sub")
        if user_id:
            return _resolve_active_scope_id(user_id, decoded.get("email", ""))
    return "anonymous"


def get_user_email_from_header(authorization: Optional[str]) -> str:
    """Extrait l'email du token Firebase ID."""
    decoded = _decode_token(authorization)
    if decoded:
        return decoded.get("email", "")
    return ""


def get_user_identity(authorization: Optional[str]) -> tuple[str, str]:
    """Decode token once and return (user_id, email). Avoids double verification."""
    decoded = _decode_token(authorization)
    if not decoded:
        return "anonymous", ""
    user_id = decoded.get("uid") or decoded.get("user_id") or decoded.get("sub") or "anonymous"
    return user_id, decoded.get("email", "")
