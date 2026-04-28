"""
Router pour le versioning de l'application FLARE AI.
Fournit les versions minimales requises pour forcer la mise à jour sur chaque plateforme.
"""
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/app", tags=["app-version"])

# ─── Versions minimales requises ─────────────────────────────────────────────
# Incrémentez ces valeurs pour forcer une mise à jour obligatoire sur chaque plateforme.
# Format: "MAJOR.MINOR.PATCH"
MIN_REQUIRED_VERSIONS = {
    "android": "2.0.1",
    "windows": "2.0.1",
    "web":     "2.0.1",
}

APP_VERSION = "2.0.1"

@router.get("/version")
def get_app_version():
    """
    Retourne les informations de version de l'application.
    Utilisé par les clients pour détecter et forcer les mises à jour obligatoires.
    """
    return {
        "current_version": APP_VERSION,
        "min_required": MIN_REQUIRED_VERSIONS,
        "force_update_message": "Une nouvelle version de FLARE AI est disponible. Veuillez mettre à jour pour continuer.",
        "release_notes": "Système de notifications push multi-plateformes, Assistant Mail amélioré.",
    }
