import logging
from typing import List, Optional, Dict, Any
from google.cloud import storage as gcs_storage
import firebase_admin
from firebase_admin import credentials, messaging

from .config import settings

logger = logging.getLogger(__name__)

# Initialisation globale de Firebase Admin si les credentials sont présents
try:
    if not firebase_admin._apps:
        # Si vous avez un google-services.json ou serviceAccountKey.json
        # vous pouvez utiliser credentials.Certificate("chemin")
        # Par défaut, Firebase Admin utilise les Default Credentials (idéal sur GCP)
        firebase_admin.initialize_app()
        logger.info("[Firebase Admin] Initialisé avec succès.")
except Exception as e:
    logger.error(f"Erreur d'initialisation Firebase Admin: {e}")


class FirebaseStorageManager:
    """
    Gère les fichiers binaires sur Google Cloud Storage.
    Bucket configuré via NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.
    """

    def __init__(self):
        try:
            self._client = gcs_storage.Client()
            self.bucket = self._client.bucket(settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
            logger.info(f"[Storage] Bucket initialisé: {settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}")
        except Exception as e:
            logger.error(f"Erreur initialisation bucket GCS: {e}")
            self.bucket = None

    def upload_file(self, bucket_name: str, path: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> Optional[str]:
        """Upload un fichier et retourne son URL publique."""
        if not self.bucket:
            return None
        try:
            blob = self.bucket.blob(path)
            blob.upload_from_string(file_bytes, content_type=content_type)
            url = f"https://storage.googleapis.com/{self.bucket.name}/{path}"
            logger.info(f"[Storage] Fichier uploadé: {path} -> {url}")
            return url
        except Exception as e:
            logger.error(f"Erreur upload GCS ({path}): {e}")
            return None

    def list_files(self, prefix: str) -> List[Any]:
        """Liste les fichiers dans un dossier spécifique."""
        if not self.bucket:
            return []
        try:
            blobs = self.bucket.list_blobs(prefix=prefix)
            return [{"name": b.name, "size": b.size, "updated": b.updated} for b in blobs]
        except Exception as e:
            logger.error(f"Erreur list_files GCS: {e}")
            return []

    def delete_file(self, path: str) -> bool:
        """Supprime un fichier."""
        if not self.bucket:
            return False
        try:
            blob = self.bucket.blob(path)
            blob.delete()
            return True
        except Exception as e:
            logger.error(f"Erreur delete_file GCS: {e}")
            return False

class KnowledgeManager:
    """
    Gère la base de connaissances vectorielle sur Cloud SQL (pgvector).
    Remplace SupabaseKnowledgeManager.
    """
    
    def __init__(self):
        # Initialisation du modèle d'embeddings Gemini
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=settings.GEMINI_API_KEY
            )
            logger.info("[Knowledge] Embeddings Gemini initialisés")
        except Exception as e:
            logger.error(f"Erreur initialisation embeddings Gemini: {e}")
            self.embeddings = None

    def add_knowledge(self, user_id: str, title: str, content: str, source: str = "manual", doc_type: str = "text", file_url: Optional[str] = None, word_count: int = 0) -> str:
        """Génère un embedding et stocke le document dans Cloud SQL via SQLAlchemy."""
        try:
            from .database import add_vector_knowledge
            if not self.embeddings:
                raise RuntimeError("Embeddings non initialisés (clé Gemini manquante ?)")
            vector = self.embeddings.embed_query(content)
            metadata = {
                "title": title,
                "source": source,
                "type": doc_type,
                "file_url": file_url,
                "word_count": word_count
            }
            return add_vector_knowledge(user_id, title, content, vector, metadata)
        except Exception as e:
            logger.error(f"Erreur add_knowledge (SQLAlchemy): {e}")
            return ""

    def search_knowledge(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Recherche sémantique via pgvector."""
        try:
            from .database import search_vector_knowledge
            query_vector = self.embeddings.embed_query(query)
            return search_vector_knowledge(user_id, query_vector, limit)
        except Exception as e:
            logger.error(f"Erreur search_knowledge (SQLAlchemy): {e}")
            return []

    def get_knowledge(self, user_id: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Récupère un document."""
        try:
            from .database import list_vector_knowledge
            # Pour l'instant list et filter localement ou ajouter get_by_id
            docs = list_vector_knowledge(user_id)
            for d in docs:
                if d["id"] == doc_id:
                    return d
            return None
        except Exception as e:
            logger.error(f"Erreur get_knowledge (SQLAlchemy): {e}")
            return None

    def delete_knowledge(self, user_id: str, doc_id: str) -> bool:
        """Supprime un document."""
        try:
            from .database import delete_vector_knowledge
            return delete_vector_knowledge(user_id, doc_id)
        except Exception as e:
            logger.error(f"Erreur delete_knowledge (SQLAlchemy): {e}")
            return False

    def get_user_knowledge(self, user_id: str) -> List[Dict[str, Any]]:
        """Liste tous les documents d'un utilisateur."""
        try:
            from .database import list_vector_knowledge
            return list_vector_knowledge(user_id)
        except Exception as e:
            logger.error(f"Erreur get_user_knowledge (SQLAlchemy): {e}")
            return []

# Singleton interfaces
firebase_storage = FirebaseStorageManager()
knowledge_manager = KnowledgeManager()


class FcmNotificationManager:
    """Gère l'envoi de notifications push via Firebase Cloud Messaging."""
    
    def send_notification(self, tokens: List[str], title: str, body: str, data: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Envoie une notification push à une liste de tokens FCM avec support multi-plateforme riche.
        """
        if not firebase_admin._apps:
            logger.warning("Impossible d'envoyer la notification: Firebase Admin non initialisé.")
            return {"success": 0, "failure": len(tokens)}
        
        if not tokens:
            return {"success": 0, "failure": 0}

        try:
            icon_url = "https://flareai.ramsflare.com/br-symbol-v4-192.png"
            
            # Configuration spécifique pour le Web (Windows / PWA / Chrome)
            webpush = messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon=icon_url,
                    badge=icon_url,
                    tag="priority-mail",
                    renotify=True,
                ),
                fcm_options=messaging.WebpushFcmOptions(
                    link=data.get("url") if data else "https://flareai.ramsflare.com/app?view=executive-mail"
                )
            )

            # Configuration spécifique pour Android (APK)
            android = messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    title=title,
                    body=body,
                    icon="stock_ticker_update", # Doit correspondre à une ressource drawable si possible, sinon FCM gère
                    color="#000000",
                    click_action="OPEN_MAIL_DETAIL",
                )
            )

            # On construit le message multicast
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                tokens=tokens,
                webpush=webpush,
                android=android
            )
            
            response = messaging.send_each_for_multicast(message)
            logger.info(f"[FCM] Notification riche envoyée: {response.success_count} succès, {response.failure_count} échecs.")
            
            return {"success": response.success_count, "failure": response.failure_count}
        except Exception as e:
            logger.error(f"[FCM] Erreur d'envoi de notification riche: {e}")
            return {"success": 0, "failure": len(tokens)}

fcm_manager = FcmNotificationManager()






