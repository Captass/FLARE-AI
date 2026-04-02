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
from langchain_core.language_models import BaseChatModel
from .config import settings

logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.7, streaming: bool = False, model_override: Optional[str] = None) -> BaseChatModel:
    """
    Retourne une instance LLM configurée selon LLM_PROVIDER.

    Providers supportés :
      - "vertexai" → Vertex AI Gemini 2.5 Flash (défaut — production GCP)
      - "gemini"   → Google Gemini API (AI Studio)
      - "openai"   → OpenAI GPT
      - "ollama"   → Ollama local (dev)

    Args:
        model_override: Modèle à utiliser (override le modèle global si fourni)
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "vertexai":
        from langchain_google_vertexai import ChatVertexAI
        import os
        # Set project and location for Vertex AI
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.GOOGLE_CLOUD_PROJECT
        os.environ["GOOGLE_CLOUD_REGION"] = settings.GOOGLE_CLOUD_REGION

        effective_model = model_override or settings.GEMINI_MODEL
        return ChatVertexAI(
            model_name=effective_model,
            temperature=temperature,
            streaming=streaming,
            max_retries=3,
        )

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        effective_model = model_override or settings.GEMINI_MODEL

        # Configuration de base
        # IMPORTANT: convert_system_message_to_human=True est NÉCESSAIRE pour que
        # gemini-2.5-flash (et les thinking models) gèrent correctement le tool calling
        # avec beaucoup d'outils. Sans ce flag, le modèle renvoie des réponses vides.
        kwargs = dict(
            model=effective_model,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=temperature,
            streaming=streaming,
            convert_system_message_to_human=True,
            max_retries=3,
            timeout=120,
        )

        llm = ChatGoogleGenerativeAI(**kwargs)
        logger.info(f"[LLM Factory] {effective_model} créé (provider={provider}, convert_system=True)")
        return llm

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=temperature,
            streaming=streaming,
        )

    # Fallback : Ollama (dev local)
    from langchain_ollama import ChatOllama
    return ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
        temperature=temperature,
    )






