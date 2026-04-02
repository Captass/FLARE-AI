"""
Router for user-specific actions like pinging activity.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, UserSubscription
from core.auth import get_user_id_from_header

logger = logging.getLogger(__name__)

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
