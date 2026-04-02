import base64
import logging
from cryptography.fernet import Fernet
from .config import settings

logger = logging.getLogger(__name__)

class EncryptionService:
    """
    Service de chiffrement pour les données sensibles (OAuth Refresh Tokens, API Keys).
    Utilise Fernet (AES-128 CBC avec HMAC SHA256).
    """
    
    def __init__(self):
        self.master_key = settings.GOOGLE_OAUTH_MASTER_KEY
        self._fernet = None
        
        if self.master_key:
            try:
                # Assurer que la clé est en bytes et valide pour Fernet
                if isinstance(self.master_key, str):
                    key_bytes = self.master_key.encode()
                else:
                    key_bytes = self.master_key
                
                self._fernet = Fernet(key_bytes)
                logger.info("✅ EncryptionService initialisé avec la Master Key.")
            except Exception as e:
                logger.error(f"❌ Erreur lors de l'initialisation de Fernet : {e}")
        else:
            logger.warning("⚠️ GOOGLE_OAUTH_MASTER_KEY non configurée. Le chiffrement sera désactivé (NON SÉCURISÉ).")

    def encrypt(self, data: str) -> str:
        """Chiffre une chaîne de caractères et retourne un hash base64."""
        if not self._fernet or not data:
            return data
        
        try:
            encrypted_bytes = self._fernet.encrypt(data.encode())
            return encrypted_bytes.decode()
        except Exception as e:
            logger.error(f"❌ Erreur lors du chiffrement : {e}")
            return data

    def decrypt(self, encrypted_data: str) -> str:
        """Déchiffre un hash base64 et retourne la chaîne originale."""
        if not self._fernet or not encrypted_data:
            return encrypted_data
        
        try:
            decrypted_bytes = self._fernet.decrypt(encrypted_data.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            logger.error(f"❌ Erreur lors du déchiffrement : {e}")
            return encrypted_data

# Instance unique globale
encryption_service = EncryptionService()






