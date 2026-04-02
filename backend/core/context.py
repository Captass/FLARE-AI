"""
Variables de contexte partagées entre l'orchestrateur et les workers.
Module séparé pour éviter les imports circulaires.
"""
from contextvars import ContextVar
from typing import Optional, List, Dict, Any

from .memory import CoreMemory

# Identifiant utilisateur courant (thread-safe via contextvars)
current_user_id: ContextVar[str] = ContextVar("current_user_id", default="anonymous")

# Images/vidéos générées pendant le tour courant
generated_images: ContextVar[Optional[List[dict]]] = ContextVar("generated_images", default=None)

# Identifiant unique de la requête courante
current_request_id: ContextVar[Optional[str]] = ContextVar("current_request_id", default=None)

# Identifiant de la session/conversation courante
current_session_id: ContextVar[Optional[str]] = ContextVar("current_session_id", default=None)

# Titres des documents sauvegardés dans la base de connaissances ce tour
knowledge_saved: ContextVar[Optional[List[str]]] = ContextVar("knowledge_saved", default=None)

# Registre global thread-safe pour les images générées (RequestID -> List[Images])
GLOBAL_IMAGE_REGISTRY: dict = {}

# Instance partagée de CoreMemory
core_memory = CoreMemory()

# Fichier inline courant (utile pour l'édition de documents/tableurs sans URL cloud)
current_inline_file: ContextVar[Optional[Dict[str, Any]]] = ContextVar("current_inline_file", default=None)






