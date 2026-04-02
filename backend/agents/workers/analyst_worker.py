"""
Worker Analyste de Fichiers — FLARE AI.
Spécialisé dans l'analyse de contenu de fichiers (images, documents, etc.).
"""
import logging
from langchain_core.messages import HumanMessage

from core.llm_factory import get_llm
from core.config import settings

logger = logging.getLogger(__name__)

ANALYST_SYSTEM_PROMPT = """Tu es un expert en analyse de fichiers. Un utilisateur a fourni un fichier (image, document, etc.) et une question.

Ta mission est d'analyser en profondeur le contenu du fichier et de répondre à la question de l'utilisateur de la manière la plus détaillée, précise et utile possible.

- Si c'est une image, décris ce que tu vois, identifie les objets, les personnes, le texte, et le contexte.
- Si c'est un document, résume les points clés, extrais les informations demandées et réponds aux questions sur son contenu.

Réponds directement à la question de l'utilisateur en te basant sur ton analyse."""

class AnalystWorker:
    """Worker spécialisé dans l'analyse de fichiers."""

    def __init__(self, model_override: str = None):
        self.llm = get_llm(
            temperature=0.3,
            model_override=model_override or settings.GEMINI_PRO_MODEL, # Utilise le modèle Pro pour une meilleure analyse
        )
        logger.info(f"[AnalystWorker] Initialisé.")

    async def run(self, task: str, file_type: str, file_content_base64: str, config: dict = None) -> str:
        """Exécute une tâche d'analyse sur un fichier et retourne le résultat texte."""
        
        content_parts = [
            {"type": "text", "text": ANALYST_SYSTEM_PROMPT},
            {"type": "text", "text": f"\n\nQuestion de l'utilisateur : {task}"}
        ]

        if "image" in file_type:
            content_parts.append({
                "type": "image_url",
                "image_url": f"data:{file_type};base64,{file_content_base64}"
            })
        # NOTE: La logique pour d'autres types de fichiers (PDF, DOCX) sera ajoutée ici.
        else:
            return "Désolé, je ne peux analyser que les images pour le moment."

        messages = [HumanMessage(content=content_parts)]
        
        response = await self.llm.ainvoke(messages, config=config)
        
        return response.content







