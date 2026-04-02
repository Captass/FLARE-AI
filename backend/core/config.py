from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Serveur
    APP_ENV: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    
    # Comptes de développement (pas de limites pour ces emails)
    DEV_EMAILS: str = "kevin.costa.pro@gmail.com,kevin@ramsflare.com,cptskevin@gmail.com"

    # LLM
    LLM_PROVIDER: str = "gemini"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_PRO_MODEL: str = "gemini-2.5-pro"
    GEMINI_IMAGE_MODEL: str = "imagen-4"
    GEMINI_AUDIO_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_TTS_MODEL: str = "gemini-2.5-flash-preview-tts"
    GEMINI_ROUTING_MODEL: str = "gemini-2.5-flash-lite"

    # Firebase / Google Cloud
    GOOGLE_CLOUD_PROJECT: str = "ramsflare"
    GOOGLE_CLOUD_REGION: str = "us-central1"
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None
    FIREBASE_AUTH_PROJECT_IDS: str = "ramsflare,rams-flare-ai"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Optional[str] = None
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: str = "ramsflare.firebasestorage.app"
    
    # Base de données (Cloud SQL PostgreSQL legacy migration)
    DATABASE_URL: str = "sqlite:///./flare_ai_os.db"
    TESTING: bool = False

    # Meta / Facebook
    META_APP_ID: Optional[str] = None
    META_ACCESS_TOKEN: Optional[str] = None
    META_VERIFY_TOKEN: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    META_PAGE_ID: Optional[str] = None
    META_GRAPH_VERSION: str = "v25.0"
    MESSENGER_DIRECT_URL: str = "https://messenger-direct-236458687422.europe-west9.run.app"
    MESSENGER_DIRECT_DASHBOARD_KEY: Optional[str] = None

    # Google Workspace & Prospecting
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_OAUTH_MASTER_KEY: Optional[str] = None  # Clé Fernet pour UserIntegrations

    # Stripe (Paiements)
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    
    # Prospecting APIs (Global Keys)
    HUNTER_API_KEY: Optional[str] = None
    APOLLO_API_KEY: Optional[str] = None
    APIFY_API_KEY: Optional[str] = None

    # Admin
    ADMIN_EMAILS: str = "cptskevin@gmail.com,kevin.costa.pro@gmail.com"
    ORGANIZATION_REGISTRY_JSON: Optional[str] = None
    ORGANIZATION_SESSION_HOURS: int = 12

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_NAME: str = "RAM'S FLARE"


settings = Settings()

# ── Prix Gemini API — Mars 2026 (USD par token, PAS par million) ──────────
# Source : https://ai.google.dev/gemini-api/docs/pricing
AI_PRICING = {
    # Gemini 3.1 Pro — Raisonnement avancé
    "gemini-2.5-pro": {
        "input": 1.25 / 1_000_000,
        "output": 10.00 / 1_000_000,
    },
    # Gemini 3.1 Flash — Rapide & polyvalent
    "gemini-2.5-flash": {
        "input": 0.50 / 1_000_000,
        "output": 3.00 / 1_000_000,
    },
    "gemini-2.5-flash-preview": {
        "input": 0.50 / 1_000_000,
        "output": 3.00 / 1_000_000,
    },
    # Gemini 3.1 Flash-Lite — Ultra-rapide, tâches légères (routage, résumé)
    "gemini-2.5-flash-lite": {
        "input": 0.25 / 1_000_000,
        "output": 1.50 / 1_000_000,
    },
    # Legacy models (encore utilisés dans certains workers)
    "gemini-2.5-flash": {
        "input": 0.15 / 1_000_000,
        "output": 0.60 / 1_000_000,
    },
    "gemini-2.5-flash-lite": {
        "input": 0.075 / 1_000_000,
        "output": 0.30 / 1_000_000,
    },
    "gemini-2.5-flash-8b": {
        "input": 0.0375 / 1_000_000,
        "output": 0.15 / 1_000_000,
    },
}

# Coûts fixes par génération média / documents
MEDIA_PRICING = {
    "imagen-3": 0.04,        # $ par image
    "imagen-4": 0.04,        # $ par image
    "veo-3": 0.35,           # $ par seconde
    "veo-3.1": 0.35,         # $ par seconde (VEO 3.1 — premium)
    "doc_gen": 0.005,        # $ par document Word généré
    "sheet_gen": 0.005,      # $ par tableur Excel généré
}






