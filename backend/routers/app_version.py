"""
Application version manifest for FLARE AI.

The web app, Android APK and Windows installer all use this endpoint to know
whether an update is available or mandatory. The legacy fields stay in the
response so already-distributed builds keep working.
"""
import logging

from fastapi import APIRouter

from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/app", tags=["app-version"])

PLATFORM_LABELS = {
    "web": "Web / PWA",
    "android": "Android APK",
    "windows": "Windows EXE",
}


def _platform_manifest(platform: str, min_required: str, download_url: str | None = None) -> dict:
    return {
        "platform": platform,
        "label": PLATFORM_LABELS[platform],
        "latest_version": settings.APP_CURRENT_VERSION,
        "min_required_version": min_required,
        "mandatory": min_required == settings.APP_CURRENT_VERSION,
        "download_url": download_url,
        "release_notes": settings.APP_RELEASE_NOTES,
    }


def build_app_version_manifest() -> dict:
    min_required_versions = {
        "android": settings.APP_MIN_REQUIRED_ANDROID_VERSION,
        "windows": settings.APP_MIN_REQUIRED_WINDOWS_VERSION,
        "web": settings.APP_MIN_REQUIRED_WEB_VERSION,
    }

    platforms = {
        "web": _platform_manifest("web", min_required_versions["web"], settings.FRONTEND_URL),
        "android": _platform_manifest("android", min_required_versions["android"], settings.APP_ANDROID_RELEASE_URL),
        "windows": _platform_manifest("windows", min_required_versions["windows"], settings.APP_WINDOWS_RELEASE_URL),
    }

    return {
        "current_version": settings.APP_CURRENT_VERSION,
        "latest_version": settings.APP_CURRENT_VERSION,
        "min_required": min_required_versions,
        "platforms": platforms,
        "force_update_message": "Une nouvelle version de FLARE AI est requise pour continuer.",
        "optional_update_message": "Une mise a jour de FLARE AI est disponible.",
        "release_notes": settings.APP_RELEASE_NOTES,
    }


@router.get("/version")
def get_app_version():
    """Return the update manifest used by all FLARE AI clients."""
    return build_app_version_manifest()
