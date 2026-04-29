import logging
from typing import Dict, Any, List
from .database import SessionLocal, FcmDeviceToken
from .firebase_client import fcm_manager

logger = logging.getLogger(__name__)

def notify_user_priority_mail(user_id: str, mail_subject: str, mail_snippet: str, mail_id: str):
    """
    Récupère tous les tokens (web, android, windows) d'un utilisateur et
    lui envoie une notification push FCM concernant un email prioritaire.
    """
    db = SessionLocal()
    try:
        tokens_db = db.query(FcmDeviceToken).filter(FcmDeviceToken.user_id == user_id).all()
        if not tokens_db:
            logger.info(f"[Notifications] Aucun token FCM pour l'utilisateur {user_id}. Push ignoré.")
            return

        token_list = [t.token for t in tokens_db]
        
        # Titre et corps formatés pour le prestige
        title = "Nouveau Mail Prioritaire 📧"
        body = f"{mail_subject}\n{mail_snippet[:120]}..." if mail_snippet else mail_subject
        
        # Data payload (utilisé pour le routage au clic)
        data = {
            "type": "priority_mail",
            "url": f"https://flareai.ramsflare.com/app?view=executive-mail&mail_id={mail_id}",
            "mail_id": mail_id
        }
        
        # Envoi
        logger.info(f"[Notifications] Envoi push FCM à {len(token_list)} appareils pour {user_id}")
        fcm_manager.send_notification(tokens=token_list, title=title, body=body, data=data)
        
    except Exception as e:
        logger.error(f"[Notifications] Erreur globale notify_user_priority_mail: {e}")
    finally:
        db.close()
