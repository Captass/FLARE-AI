"""
FLARE AI — Backend FastAPI
Point d'entrée de l'application.
"""
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import settings
from core.database import init_db, SessionLocal, Skill
from routers.chat import router as chat_router
from routers.agents import router as agents_router
from routers.webhooks import router as webhooks_router
from routers.memory import router as memory_router
from routers.skills import router as skills_router
from routers.dashboard import router as dashboard_router
from routers.knowledge import router as knowledge_router
from routers.files import router as files_router
from routers.folders import router as folders_router
from routers.settings import router as settings_router
from routers.prompts import router as prompts_router
from routers.prompts import seed_default_prompts
from routers.auth_sync import router as auth_sync_router
from routers.prospecting import router as prospecting_router
from routers.admin import router as admin_router
from routers.email_verification import router as email_verification_router
from routers.guided_prompt import router as guided_prompt_router
from routers.billing import router as billing_router
from routers.google_auth import router as google_auth_router
from routers.facebook_pages import router as facebook_pages_router
from routers.chatbot import router as chatbot_router
from routers.organizations import router as organizations_router
from routers.users import router as users_router
from routers.content_studio import router as content_studio_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


def seed_default_skills():
    """Crée les skills par défaut si la table est vide."""
    db = SessionLocal()
    try:
        if db.query(Skill).count() > 0:
            return
        defaults = [
            Skill(
                name="post_instagram",
                title="Post Instagram",
                description="Rédige un post Instagram engageant avec hashtags",
                prompt_template="Rédige un post Instagram percutant pour {{sujet}}. Ton souhaité : {{ton}}. Inclus 5 hashtags pertinents et un call-to-action.",
                category="social",
                is_active="true",
            ),
            Skill(
                name="email_prospection",
                title="Email B2B Froid",
                description="Email de prospection B2B personnalisé",
                prompt_template="Rédige un email de prospection B2B pour le secteur {{secteur}} dans la ville de {{ville}}. Objet accrocheur, corps max 150 mots, call-to-action clair.",
                category="prospection",
                is_active="true",
            ),
            Skill(
                name="rapport_campagne",
                title="Rapport de Campagne",
                description="Rapport synthétique d'une campagne de prospection",
                prompt_template="Génère un rapport complet pour la campagne {{campagne_id}} : résultats obtenus, KPIs clés, points forts, points à améliorer, recommandations pour la prochaine campagne.",
                category="reporting",
                is_active="true",
            ),
            Skill(
                name="brief_creatif",
                title="Brief Créatif",
                description="Brief créatif structuré pour un projet",
                prompt_template="Crée un brief créatif complet pour {{projet}} : objectifs business, cible démographique, ton et univers visuel, formats recommandés, KPIs de succès.",
                category="creative",
                is_active="true",
            ),
            Skill(
                name="analyse_concurrence",
                title="Analyse Concurrents",
                description="Analyse concurrentielle d'un secteur",
                prompt_template="Analyse les principaux concurrents de {{entreprise}} dans le secteur {{secteur}}. Pour chaque concurrent : forces, faiblesses, positionnement prix, canaux marketing. Conclus avec les opportunités de différenciation.",
                category="strategie",
                is_active="true",
            ),
        ]
        for skill in defaults:
            db.add(skill)
        db.commit()
        logger.info(f"✅ {len(defaults)} skills par défaut créés")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialisation au démarrage."""
    logger.info("Initialisation de FLARE AI...")
    init_db()  # Crée toutes les tables
    seed_default_skills()
    seed_default_prompts()

    # Auto-migrations (PostgreSQL + SQLite local)
    from sqlalchemy import text
    _db = SessionLocal()
    try:
        is_postgres = "postgresql" in settings.DATABASE_URL
        is_sqlite   = "sqlite"     in settings.DATABASE_URL

        pg_migrations = [
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_time FLOAT",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS daily_budget_usd FLOAT DEFAULT 0.05",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS allowed_models TEXT DEFAULT 'gemini-3-flash'",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_images_per_day INTEGER DEFAULT 2",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_videos_per_day INTEGER DEFAULT 0",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id TEXT",
            "ALTER TABLE subscription_plans DROP COLUMN IF EXISTS monthly_messages",
            "ALTER TABLE subscription_plans DROP COLUMN IF EXISTS monthly_images",
            "ALTER TABLE subscription_plans DROP COLUMN IF EXISTS gemini_model",
            "ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS user_email TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
            "ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP",
            "UPDATE user_subscriptions SET last_seen_at = NULL WHERE last_seen_at IS NOT NULL AND last_seen_at < NOW() - INTERVAL '15 minutes'",
            "ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
            "ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS usage_metadata JSONB",
            "ALTER TABLE chatbot_preferences ADD COLUMN IF NOT EXISTS page_id TEXT",
            "ALTER TABLE chatbot_catalogue_items ADD COLUMN IF NOT EXISTS page_id TEXT",
            "ALTER TABLE chatbot_portfolio_items ADD COLUMN IF NOT EXISTS page_id TEXT",
            "ALTER TABLE chatbot_sales_config DROP CONSTRAINT IF EXISTS chatbot_sales_config_organization_slug_key",
            "ALTER TABLE chatbot_sales_config ADD COLUMN IF NOT EXISTS page_id TEXT",
        ]

        # SQLite ne supporte pas IF NOT EXISTS sur ALTER TABLE — try/except par colonne
        sqlite_migrations = [
            "ALTER TABLE messages ADD COLUMN response_time FLOAT",
            "ALTER TABLE subscription_plans ADD COLUMN daily_budget_usd FLOAT",
            "ALTER TABLE subscription_plans ADD COLUMN allowed_models TEXT",
            "ALTER TABLE subscription_plans ADD COLUMN max_images_per_day INTEGER",
            "ALTER TABLE subscription_plans ADD COLUMN max_videos_per_day INTEGER",
            "ALTER TABLE subscription_plans ADD COLUMN stripe_price_id TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN user_email TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN stripe_customer_id TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN stripe_subscription_id TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN status TEXT",
            "ALTER TABLE user_subscriptions ADD COLUMN last_seen_at TIMESTAMP",
            "ALTER TABLE user_subscriptions ADD COLUMN updated_at TIMESTAMP",
            "ALTER TABLE usage_ledger ADD COLUMN usage_metadata TEXT",
            "ALTER TABLE chatbot_preferences ADD COLUMN page_id TEXT",
            "ALTER TABLE chatbot_catalogue_items ADD COLUMN page_id TEXT",
            "ALTER TABLE chatbot_portfolio_items ADD COLUMN page_id TEXT",
            "ALTER TABLE chatbot_sales_config ADD COLUMN page_id TEXT",
        ]

        migrations = pg_migrations if is_postgres else (sqlite_migrations if is_sqlite else [])
        for sql in migrations:
            try:
                _db.execute(text(sql))
            except Exception:
                pass  # colonne déjà présente
        _db.commit()
        logger.info("✅ Migrations DB appliquées")
    except Exception as _e:
        logger.warning(f"⚠️ Auto-migration échouée: {_e}")
    finally:
        _db.close()

    from core.database import seed_subscription_plans
    seed_subscription_plans()

    model_name = {
        "gemini": f"{settings.GEMINI_PRO_MODEL} (pro) / {settings.GEMINI_MODEL} (flash)",
        "vertexai": f"{settings.GEMINI_PRO_MODEL} (pro) / {settings.GEMINI_MODEL} (flash)",
        "openai": settings.OPENAI_MODEL,
        "ollama": settings.OLLAMA_MODEL,
    }.get(settings.LLM_PROVIDER, settings.LLM_PROVIDER)
    logger.info(f"Base de données prête — LLM: {settings.LLM_PROVIDER} / {model_name}")
    yield
    logger.info("FLARE AI arrêté.")


app = FastAPI(
    title="FLARE AI",
    description="Orchestrateur IA central de RAM'S FLARE",
    version="2.0.0",
    lifespan=lifespan,
)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS — restreint aux origines autorisées
_allowed_origins = [
    settings.FRONTEND_URL,                        # http://localhost:3000 (dev)
    "http://localhost:3000",
    "http://localhost:3001",
    "https://flare-ai.app",                       # Ancien domaine
    "https://www.flare-ai.app",
    "https://rams-flare-ai.web.app",              # Projet Firebase actuel
    "https://rams-flare-ai.firebaseapp.com",
    "https://rams-flare.web.app",                 # Ancien Firebase Hosting
    "https://rams-flare.firebaseapp.com",
    "https://ramsflare.web.app",                  # Nouveau Firebase Hosting
    "https://ramsflare.firebaseapp.com",
    "https://flareai.ramsflare.com",              # Domaine custom production
    "https://www.flareai.ramsflare.com",
    "https://flare-frontend-t8i4.onrender.com",   # Static site Render (avant / sans DNS custom)
]

for _extra in (o.strip() for o in (settings.EXTRA_CORS_ORIGINS or "").split(",") if o.strip()):
    if _extra not in _allowed_origins:
        _allowed_origins.append(_extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(chat_router)
app.include_router(agents_router)
app.include_router(webhooks_router)
app.include_router(memory_router)
app.include_router(skills_router)
app.include_router(dashboard_router)
app.include_router(knowledge_router)
app.include_router(files_router)
app.include_router(folders_router)
app.include_router(settings_router)
app.include_router(prompts_router)
app.include_router(auth_sync_router)
app.include_router(email_verification_router)
app.include_router(prospecting_router)
app.include_router(admin_router)
app.include_router(guided_prompt_router)
app.include_router(billing_router)
app.include_router(google_auth_router)
app.include_router(facebook_pages_router)
app.include_router(chatbot_router)
app.include_router(organizations_router)
app.include_router(users_router)
app.include_router(content_studio_router)


def _active_model() -> str:
    return {
        "gemini": f"{settings.GEMINI_PRO_MODEL} / {settings.GEMINI_MODEL}",
        "openai": settings.OPENAI_MODEL,
        "ollama": settings.OLLAMA_MODEL,
    }.get(settings.LLM_PROVIDER, settings.LLM_PROVIDER)


@app.get("/")
async def root():
    return {
        "system": "FLARE AI",
        "version": "2.0.0",
        "status": "en ligne",
        "llm": f"{settings.LLM_PROVIDER} / {_active_model()}",
        "endpoints": {
            "chat": "POST /chat",
            "conversations": "GET /chat/conversations",
            "agents": "GET /agents/*",
            "webhook_facebook": "POST /webhook/facebook",
            "docs": "GET /docs",
        },
    }


@app.get("/health")
async def health():
    """Health check pour monitoring."""
    return {
        "status": "ok",
        "service": "flare-backend",
        "environment": settings.APP_ENV,
    }
