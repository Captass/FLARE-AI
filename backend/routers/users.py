"""
Router for user-specific actions like pinging activity.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db, UserSubscription, FcmDeviceToken
from core.auth import get_user_id_from_header

logger = logging.getLogger(__name__)

class FcmSubscribePayload(BaseModel):
    token: str
    platform: str = "web"  # "web", "android", "windows"

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/ping")
def user_ping(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Records that the user is currently active."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        # Anonymous users can't have a subscription record, so we can ignore their pings.
        return {"status": "ok"}

    try:
        subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
        if subscription:
            subscription.last_seen_at = datetime.utcnow()
            db.commit()
        # If there's no subscription record, we can't do anything, but it's not an error.
        # This might happen for freshly created users before the sync runs.
    except Exception as e:
        logger.error(f"Error updating last_seen_at for user {user_id}: {e}")
        # Do not raise an exception, as this is a background task for the client.
        # A failed ping is not a critical error.
        pass

    return {"status": "ok"}

@router.post("/push-subscribe")
def subscribe_push(
    payload: FcmSubscribePayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Enregistre ou met à jour le token FCM d'un appareil."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise pour les notifications push")

    try:
        # Vérifie si le token existe déjà (pour ce user ou un autre)
        existing_token = db.query(FcmDeviceToken).filter(FcmDeviceToken.token == payload.token).first()
        
        if existing_token:
            # S'il existe, on met à jour le user_id et la plateforme (au cas où l'utilisateur s'est reconnecté avec un autre compte)
            existing_token.user_id = user_id
            existing_token.platform = payload.platform
            existing_token.updated_at = datetime.utcnow()
        else:
            # Sinon on le crée
            new_token = FcmDeviceToken(
                user_id=user_id,
                platform=payload.platform,
                token=payload.token
            )
            db.add(new_token)
            
        db.commit()
        return {"status": "ok", "message": "Token enregistré"}
    except Exception as e:
        db.rollback()
        logger.error(f"Erreur enregistrement token FCM: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne serveur")

@router.post("/push-test")
def test_push_notification(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Envoie une notification de test à tous les appareils de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise")

    from core.notifications import notify_user_priority_mail
    
    # On simule un email prioritaire
    notify_user_priority_mail(
        user_id=user_id,
        mail_subject="🚀 Test de Notification Push",
        mail_snippet="Ceci est un test du système unifié de notifications FLARE AI.",
        mail_id="test-1234"
    )
    
    return {"status": "ok", "message": "Notification de test envoyée"}
