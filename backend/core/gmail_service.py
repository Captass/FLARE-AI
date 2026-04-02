import base64
import logging
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import settings
from .database import SessionLocal, UserIntegration
from .encryption_service import encryption_service

logger = logging.getLogger(__name__)

def send_email_via_api(user_id: str, to_email: str, subject: str, body: str):
    """
    Récupère les tokens de l'utilisateur, les déchiffre, 
    et envoie un email via l'API Gmail.
    """
    db = SessionLocal()
    try:
        # 1. Récupération de l'intégration OAuth
        integration = db.query(UserIntegration).filter(
            UserIntegration.user_id == user_id,
            UserIntegration.integration_type == "google_workspace",
            UserIntegration.is_active == "true"
        ).first()

        if not integration or not integration.refresh_token_encrypted:
            raise ValueError(f"Aucune intégration Gmail active trouvée pour l'utilisateur {user_id}")

        # 2. Déchiffrement du Token
        refresh_token = encryption_service.decrypt(integration.refresh_token_encrypted)
        
        # 3. Construction des Credentials
        creds = Credentials(
            None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
        )
        
        # 4. Envoi via Gmail API
        service = build("gmail", "v1", credentials=creds)
        
        # Construction du message MIME
        message = MIMEText(body)
        message["to"] = to_email
        message["subject"] = subject
        
        # Encodage base64url pour l'API Gmail
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
        send_result = service.users().messages().send(
            userId="me", 
            body={"raw": raw_message}
        ).execute()
        
        logger.info(f"✅ Email [ID: {send_result.get('id')}] envoyé avec succès à {to_email}")
        return send_result

    except Exception as e:
        logger.error(f"❌ Erreur send_email_via_api pour {user_id} -> {to_email}: {e}")
        raise e
    finally:
        db.close()






