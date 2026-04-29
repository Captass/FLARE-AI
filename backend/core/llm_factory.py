"""
Fabrique LLM modulaire — bascule entre Gemini (défaut), Ollama (local) et OpenAI
via la variable d'environnement LLM_PROVIDER.

Usage :
    from core.llm_factory import get_llm
    llm = get_llm()
    llm = get_llm(temperature=0.3)
"""
import logging
from typing import Optional
from .config import settings

logger = logging.getLogger(__name__)

_PLACEHOLDER_TOKENS = {
    "",
    "a_remplir",
    "change-me",
    "changeme",
    "your-key-here",
    "your_api_key",
}


def _is_real_key(value: Optional[str]) -> bool:
    """Vérifie qu'une clé API n'est ni vide ni un placeholder."""
    return bool(value) and str(value).strip().lower() not in _PLACEHOLDER_TOKENS


def _validated_api_key(raw_value: Optional[str], *, provider: str, purpose: str) -> str:
    value = str(raw_value or "").strip()
    if value.lower() in _PLACEHOLDER_TOKENS:
        raise RuntimeError(
            f"{provider} n'est pas configuré correctement pour `{purpose}`. "
            "Ajoutez une vraie clé API côté serveur."
        )
    return value


def get_llm(temperature: float = 0.7, streaming: bool = False, model_override: Optional[str] = None, purpose: str = "default") -> BaseChatModel:
    """
    Retourne une instance LLM configurée selon LLM_PROVIDER.

    Providers supportés :
      - "vertexai" → Vertex AI Gemini 2.5 Flash (défaut — production GCP)
      - "gemini"   → Google Gemini API (AI Studio)
      - "openai"   → OpenAI GPT
      - "ollama"   → Ollama local (dev)

    Args:
        model_override: Modèle à utiliser (override le modèle global si fourni)
        purpose: Le contexte d'utilisation du LLM (ex: 'chatbot', 'assistant_reasoning', 'assistant_fast')
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "vertexai":

        import os
        # Set project and location for Vertex AI
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.GOOGLE_CLOUD_PROJECT
        os.environ["GOOGLE_CLOUD_REGION"] = settings.GOOGLE_CLOUD_REGION



    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        effective_model = model_override or settings.GEMINI_MODEL

        # Logique de fallback multi-clés Gemini
        # IMPORTANT: vérifier que la clé n'est PAS un placeholder avant de l'utiliser
        api_key = None
        if purpose == "chatbot" and _is_real_key(settings.GEMINI_API_KEY_CHATBOT):
            api_key = settings.GEMINI_API_KEY_CHATBOT
        elif purpose == "assistant_reasoning" and _is_real_key(settings.GEMINI_API_KEY_ASSISTANT_REASONING):
            api_key = settings.GEMINI_API_KEY_ASSISTANT_REASONING
        elif purpose == "assistant_fast" and _is_real_key(settings.GEMINI_API_KEY_ASSISTANT_FAST):
            api_key = settings.GEMINI_API_KEY_ASSISTANT_FAST

        # Fallback vers la clé globale si aucune clé spécifique valide n'a été trouvée
        if not _is_real_key(api_key):
            api_key = settings.GEMINI_API_KEY_GLOBAL
        api_key = _validated_api_key(api_key, provider="Gemini", purpose=purpose)

        # Configuration de base
        # IMPORTANT: convert_system_message_to_human=True est NÉCESSAIRE pour que
        # gemini-2.5-flash (et les thinking models) gèrent correctement le tool calling
        # avec beaucoup d'outils. Sans ce flag, le modèle renvoie des réponses vides.
        kwargs = dict(
            model=effective_model,
            google_api_key=api_key,
            temperature=temperature,
            streaming=streaming,
            convert_system_message_to_human=True,
            max_retries=3,
            timeout=120,
        )

        llm = ChatGoogleGenerativeAI(**kwargs)
        logger.info(f"[LLM Factory] {effective_model} créé (provider={provider}, convert_system=True)")
        return llm