"""
Router for Google OAuth2 flow.
"""
import logging
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from core.database import get_db, get_user_subscription, UserIntegration
from core.auth import get_user_id_from_header
from core.config import settings
from core.encryption_service import encryption_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google", tags=["google-auth"])

# Scopes required for the application
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly'
]

def get_google_flow(state: Optional[str] = None) -> Flow:
    """Initializes the Google OAuth Flow."""
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "redirect_uris": [f"{settings.BACKEND_URL}/api/google/callback"]
        }
    }
    return Flow.from_client_config(
        client_config=client_config,
        scopes=SCOPES,
        redirect_uri=f"{settings.BACKEND_URL}/api/google/callback",
        state=state
    )

@router.get("/auth")
def google_auth_start(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Starts the Google OAuth flow by returning an authorization URL."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Check user subscription
    subscription = get_user_subscription(user_id)
    if not subscription or subscription.get("plan_id") == "free":
        raise HTTPException(status_code=403, detail="Google integration is a premium feature.")
    
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on the server.")

    flow = get_google_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent'
    )
    
    # Store the state in the session or a temporary storage to verify in callback
    # For this stateless example, we will rely on the user's session in the browser
    # A more robust implementation would use a temporary server-side cache.

    return {"authorization_url": authorization_url}

@router.get("/callback")
async def google_auth_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handles the callback from Google OAuth2."""
    
    # The user must be logged in to our app in the browser session 
    # where this callback is handled.
    # We extract the user_id from our own app's auth header.
    user_id = get_user_id_from_header(request.headers.get("authorization"))
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required to link Google account.")

    flow = get_google_flow(state=request.query_params.get("state"))
    
    try:
        flow.fetch_token(authorization_response=str(request.url))
    except Exception as e:
        logger.error(f"Error fetching Google token: {e}")
        raise HTTPException(status_code=400, detail=f"Error fetching token: {e}")

    credentials = flow.credentials
    
    # Get user email from Google
    try:
        user_info_service = build('oauth2', 'v2', credentials=credentials)
        user_info = user_info_service.userinfo().get().execute()
        google_email = user_info.get('email')
        if not google_email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Google.")
    except Exception as e:
        logger.error(f"Error fetching user info from Google: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user profile from Google.")


    # Encrypt the refresh token for secure storage
    if not credentials.refresh_token:
        # This can happen if the user has already granted consent and is re-authenticating.
        # We should handle this gracefully, perhaps by updating the access token if needed.
        # For now, we will require a refresh token for the initial setup.
        existing_integration = db.query(UserIntegration).filter(
            UserIntegration.user_id == user_id, 
            UserIntegration.account_email == google_email
        ).first()
        if not existing_integration:
            raise HTTPException(
                status_code=400, 
                detail="A refresh token is required but was not provided by Google. Please re-authenticate and ensure you grant offline access."
            )
        refresh_token_encrypted = existing_integration.refresh_token_encrypted
    else:
        refresh_token_encrypted = encryption_service.encrypt(credentials.refresh_token)

    # Save or update the integration in the database
    integration = db.query(UserIntegration).filter(
        UserIntegration.user_id == user_id, 
        UserIntegration.integration_type == 'google_workspace'
    ).first()

    if integration:
        integration.account_email = google_email
        integration.refresh_token_encrypted = refresh_token_encrypted
        integration.is_active = "true"
    else:
        integration = UserIntegration(
            user_id=user_id,
            integration_type='google_workspace',
            account_email=google_email,
            refresh_token_encrypted=refresh_token_encrypted,
            is_active="true"
        )
        db.add(integration)
    
    db.commit()

    logger.info(f"Successfully linked Google account {google_email} for user {user_id}")

    return {"status": "success", "message": f"Google account {google_email} linked successfully."}
