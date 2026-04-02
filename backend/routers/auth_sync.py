"""
Router Auth Sync — FLARE AI
Appelé automatiquement après chaque login Firebase pour synchroniser le profil utilisateur.
Si c'est la première connexion, crée un abonnement Free.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from core.auth import get_user_id_from_header, get_user_email_from_header, get_user_identity
from core.database import (
    get_user_subscription,
    create_user_subscription,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Endpoint principal ────────────────────────────────────────────────────────

@router.post("/sync")
async def sync_user(
    authorization: Optional[str] = Header(None),
):
    """
    Synchronise l'utilisateur après login Firebase.
    - Si premier login : crée abonnement Free.
    - Si déjà inscrit : retourne le plan actuel.
    """
    user_id, user_email = get_user_identity(authorization)

    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise")

    # Vérifier si l'utilisateur existe déjà
    existing = get_user_subscription(user_id)
    if existing:
        return {
            "status": "existing",
            "plan": existing["plan_id"],
            "plan_name": existing["plan_name"],
            "daily_budget_usd": existing["daily_budget_usd"],
            "daily_cost_usd": existing["daily_cost_usd"],
            "usage_percent": existing["usage_percent"],
        }

    # Nouvel utilisateur — plan Free par défaut
    create_user_subscription(user_id=user_id, plan_id="free", user_email=user_email)
    logger.info(f"[auth_sync] Nouvel utilisateur inscrit: {user_id} ({user_email})")

    return {
        "status": "created",
        "plan": "free",
        "plan_name": "Free",
        "daily_budget_usd": 0.05,
        "daily_cost_usd": 0.0,
        "usage_percent": 0,
    }


@router.get("/plan")
async def get_user_plan(authorization: Optional[str] = Header(None)):
    """Retourne le plan actuel de l'utilisateur, son usage quotidien et ses limites."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise")

    sub = get_user_subscription(user_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Abonnement introuvable. Appelez /api/auth/sync d'abord.")

    return {
        "plan": sub["plan_id"],
        "plan_name": sub["plan_name"],
        "daily_budget_usd": sub["daily_budget_usd"],
        "daily_cost_usd": sub["daily_cost_usd"],
        "usage_percent": sub["usage_percent"],
        "daily_images": sub["daily_images"],
        "max_images_per_day": sub["max_images_per_day"],
        "daily_videos": sub["daily_videos"],
        "max_videos_per_day": sub["max_videos_per_day"],
        "allowed_models": sub["allowed_models"],
    }
