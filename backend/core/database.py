import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    create_engine, Column, String, Integer, Text,
    DateTime, Float, ForeignKey, JSON, func, cast, inspect, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker
from pgvector.sqlalchemy import Vector

from .config import settings

# Correction du préfixe postgres pour SQLAlchemy 2.0+ et nettoyage des espaces invisibles
db_url = settings.DATABASE_URL or ""
db_url = db_url.strip()

# Suppression de ?pgbouncer=true si présent (incompatible avec psycopg2 en DSN direct)
if "?pgbouncer=true" in db_url:
    db_url = db_url.replace("?pgbouncer=true", "")
elif "&pgbouncer=true" in db_url:
    db_url = db_url.replace("&pgbouncer=true", "")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Moteur SQLAlchemy — SQLite pour dev, PostgreSQL pour prod
is_sqlite = "sqlite" in db_url
connect_args = {"check_same_thread": False} if is_sqlite else {"connect_timeout": 15}
pool_kwargs = {} if is_sqlite else {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_timeout": 15,
    "pool_recycle": 1800,
}
engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    **pool_kwargs,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="Nouvelle conversation")
    platform = Column(String, default="web")  # 'web', 'messenger'
    user_id = Column(String, default="default")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")  # active, archived
    summary = Column(Text, nullable=True)  # Résumé des anciens messages pour gestion tokens

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.timestamp"
    )

    folder_id = Column(String, ForeignKey("folders.id"), nullable=True)
    folder = relationship("Folder", back_populates="conversations")

    files = relationship("ConversationFile", back_populates="conversation", cascade="all, delete-orphan")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    color = Column(String, default="#FF7C1A")
    user_id = Column(String, default="default")
    created_at = Column(DateTime, default=datetime.utcnow)

    conversations = relationship("Conversation", back_populates="folder")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"))
    role = Column(String)  # 'user', 'assistant', 'system'
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    attachment_json = Column(JSON, nullable=True)
    response_time = Column(Float, nullable=True)  # Temps de réponse en secondes

    conversation = relationship("Conversation", back_populates="messages")


class CoreMemoryFact(Base):
    """Faits persistants sur l'utilisateur et l'agence."""
    __tablename__ = "core_memory_facts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, default="default")
    key = Column(String, nullable=False) # remove unique=True to allow same key for different users
    value = Column(Text, nullable=False)
    category = Column(String, default="general")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ConversationFile(Base):
    """Fichiers associés à une conversation (images, documents, etc.)."""
    __tablename__ = "conversation_files"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, index=True)
    file_name = Column(String, nullable=False)
    file_url = Column(Text, nullable=False)
    file_type = Column(String)  # 'image', 'document', 'audio', etc.
    mime_type = Column(String)
    file_size = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="files")


class ProspectLead(Base):
    """Leads générés par le Groupe de Prosp."""
    __tablename__ = "prospect_leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("prospecting_campaigns.id", ondelete="CASCADE"), index=True)
    company_name = Column(String)
    website = Column(String)
    email = Column(String)
    contact_person = Column(String)
    industry = Column(String)
    city = Column(String)
    status = Column(String, default="found")
    # Statuts : found → validated → email_sent → follow_up → responded → converted / rejected
    score = Column(Float, default=0.0)
    notes = Column(Text)
    social_links = Column(JSON, default={})  # {linkedin: ..., facebook: ...}
    custom_data = Column(JSON, default={})   # Données spécifiques extraites
    email_sent_at = Column(DateTime)
    follow_up_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ProspectingCampaign(Base):
    """Campagnes de prospection (Brouillons, Actives, CRM)."""
    __tablename__ = "prospecting_campaigns"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user_subscriptions.user_id"), index=True)
    title = Column(String, default="Campagne sans titre")
    sector = Column(String)
    city = Column(String)
    prompt_context = Column(Text)   # Le brief/contexte métier pour l'IA
    target_count = Column(Integer, default=10)
    schedule_cron = Column(String)  # Ex: "0 9 * * 2" (Mardi 9h)
    status = Column(String, default="draft")  # draft, queued, running, completed, paused
    
    integration_id = Column(String, ForeignKey("user_integrations.id"), nullable=True)
    
    leads_found = Column(Integer, default=0)
    emails_sent = Column(Integer, default=0)
    responses = Column(Integer, default=0)
    report = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)


class Skill(Base):
    """Compétences / automatisations créées par l'agent ou l'utilisateur."""
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, default="default")
    name = Column(String, nullable=False) # remove unique=True
    title = Column(String, nullable=False)
    description = Column(Text)
    prompt_template = Column(Text, nullable=False)
    category = Column(String, default="general")
    is_active = Column(String, default="true")
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class LocalKnowledgeDoc(Base):
    """Base de connaissances locale (SQLite) — utilisée quand les embeddings distants ne sont pas chargés."""
    __tablename__ = "knowledge_docs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, default="anonymous")
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String, default="")
    doc_type = Column(String, default="text")
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemSetting(Base):
    """Paramètres système de l'OS (ex: System Prompt personnalisé, etc.)"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, nullable=False)
    user_id = Column(String, default="default")
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PromptTemplate(Base):
    """Bibliothèque de prompts prédéfinis."""
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, default="default")
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, default="general")
    is_default = Column(String, default="false")  # "true" / "false" pour compat SQLite
    created_at = Column(DateTime, default=datetime.utcnow)


class KnowledgeEmbedding(Base):
    """
    Table pour les embeddings vectoriels (pgvector).
    Stocke le contenu et son vecteur pour la recherche sémantique.
    """
    __tablename__ = "knowledge_embeddings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(3072))  # 3072 pour Gemini embedding-001
    metadata_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Système d'Abonnements ──────────────────────────────────────────────────────

class SubscriptionPlan(Base):
    """Plans d'abonnement FLARE AI (Free, Pro, Business)."""
    __tablename__ = "subscription_plans"

    id = Column(String, primary_key=True)  # "free", "pro", "business"
    name = Column(String, nullable=False)
    daily_budget_usd = Column(Float, default=0.05)   # Budget quotidien en $ (-1 = illimité)
    allowed_models = Column(String, default="gemini-3-flash,gemini-2.5-flash-lite")  # CSV
    max_images_per_day = Column(Integer, default=0)   # -1 = illimité
    max_videos_per_day = Column(Integer, default=0)   # -1 = illimité
    stripe_price_id = Column(String, nullable=True)
    is_active = Column(String, default="true")


class UserSubscription(Base):
    """Lien Utilisateur ↔ Plan."""
    __tablename__ = "user_subscriptions"

    user_id = Column(String, primary_key=True)          # Firebase UID
    user_email = Column(String, nullable=True)           # Email pour admin/reporting
    plan_id = Column(String, ForeignKey("subscription_plans.id"), default="free")
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True)
    status = Column(String, default="active") # active, canceled, etc.
    last_seen_at = Column(DateTime, nullable=True, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("SubscriptionPlan", foreign_keys=[plan_id])


class UserIntegration(Base):
    """Intégrations tierces (Google Workspace) avec tokens chiffrés."""
    __tablename__ = "user_integrations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user_subscriptions.user_id"), index=True)
    integration_type = Column(String, default="google_workspace")
    account_email = Column(String)
    refresh_token_encrypted = Column(Text)
    is_active = Column(String, default="true")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FacebookPageConnection(Base):
    """Pages Facebook connectées à une organisation FLARE."""
    __tablename__ = "facebook_page_connections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    organization_scope_id = Column(String, index=True, nullable=False)
    page_id = Column(String, index=True, nullable=False)
    page_name = Column(String, nullable=False)
    page_picture_url = Column(String, nullable=True)
    page_category = Column(String, default="")
    page_tasks = Column(JSON, default=list)
    page_access_token_encrypted = Column(Text, nullable=True)
    user_access_token_encrypted = Column(Text, nullable=True)
    connected_by_email = Column(String, default="")
    status = Column(String, default="pending")  # pending, active, disconnected, sync_error, reconnect_required
    is_active = Column(String, default="false")
    webhook_subscribed = Column(String, default="false")
    direct_service_synced = Column(String, default="false")
    last_error = Column(Text, nullable=True)
    metadata_json = Column(JSON, default=dict)
    connected_at = Column(DateTime, default=datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatbotPreferences(Base):
    """Preferences de chatbot par organisation et par page."""
    __tablename__ = "chatbot_preferences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    page_id = Column(String, index=True, nullable=True)
    
    __table_args__ = (
        UniqueConstraint('organization_slug', 'page_id', name='uq_chatbot_prefs_org_page'),
    )

    bot_name = Column(String, default="L'assistant")
    tone = Column(String, default="amical")  # professionnel | amical | decontracte | formel
    language = Column(String, default="fr")
    primary_role = Column(String, default="mixte")  # vendeur | support_client | informateur | mixte
    greeting_message = Column(Text, default="")
    off_hours_message = Column(Text, default="")
    handoff_message = Column(Text, default="")
    handoff_mode = Column(String, default="auto")
    handoff_keywords = Column(Text, default="[]")
    company_description = Column(Text, default="")
    business_name = Column(String, default="")
    business_sector = Column(String, default="")
    business_address = Column(Text, default="")
    business_hours = Column(Text, default="")
    phone = Column(String, default="")
    contact_email = Column(String, default="")
    website_url = Column(String, default="")
    products_summary = Column(Text, default="")
    forbidden_topics_or_claims = Column(Text, default="")
    special_instructions = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatbotCatalogueItem(Base):
    """Items catalogue du chatbot par organisation et page."""
    __tablename__ = "chatbot_catalogue_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    page_id = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    price = Column(String, default="")          # "15 000 Ar", "Sur devis", "À partir de 50 000 Ar"
    category = Column(String, default="")
    image_url = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(String, default="true")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatbotPortfolioItem(Base):
    """Réalisations et portfolio du chatbot par organisation et page."""
    __tablename__ = "chatbot_portfolio_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    page_id = Column(String, index=True, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    video_url = Column(String, nullable=True)     # YouTube, Vimeo, TikTok
    external_url = Column(String, nullable=True)  # Site, image
    client_name = Column(String, default="")
    auto_share = Column(String, default="false")  # Partager auto en fin de conversation
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatbotSalesConfig(Base):
    """Script de vente et configuration CTA par organisation et page."""
    __tablename__ = "chatbot_sales_config"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    page_id = Column(String, index=True, nullable=True)
    __table_args__ = (
        UniqueConstraint('organization_slug', 'page_id', name='uq_chatbot_sales_org_page'),
    )

    # Étapes de qualification (JSON list de strings)
    qualification_steps = Column(JSON, default=list)
    # Objections + réponses (JSON list de {objection, response})
    objections = Column(JSON, default=list)
    # CTA principal
    cta_type = Column(String, default="call")   # call | quote | website | appointment | whatsapp
    cta_text = Column(String, default="")
    cta_url = Column(String, default="")
    # Signaux leads chauds
    hot_lead_signals = Column(JSON, default=list)  # ["asks_price", "specific_project", ...]
    # Transfert humain
    handoff_mode = Column(String, default="auto")  # auto | manual
    handoff_keywords = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Activation assistee et paiement manuel ────────────────────────────────────

ACTIVATION_REQUEST_STATUSES = [
    "draft", "awaiting_payment", "payment_submitted", "payment_verified",
    "awaiting_flare_page_admin_access", "queued_for_activation",
    "activation_in_progress", "testing", "active",
    "blocked", "rejected", "canceled",
]

ACTIVATION_TERMINAL_STATUSES = {"active", "rejected", "canceled"}

PAYMENT_STATUSES = ["draft", "submitted", "verified", "rejected"]

ORDER_STATUSES = ["detected", "contacted", "confirmed", "fulfilled", "canceled"]

REPORT_STATUSES = ["new", "in_review", "resolved", "dismissed"]


class ActivationRequest(Base):
    """Demande d'activation assistee par organisation."""
    __tablename__ = "activation_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    organization_scope_id = Column(String, index=True, nullable=False)
    requester_user_id = Column(String, nullable=False)
    selected_plan_id = Column(String, default="starter")
    status = Column(String, default="draft")
    payment_status = Column(String, default="pending")

    # Contact
    contact_full_name = Column(String, default="")
    contact_email = Column(String, default="")
    contact_phone = Column(String, default="")
    contact_whatsapp = Column(String, default="")

    # Entreprise
    business_name = Column(String, default="")
    business_sector = Column(String, default="")
    business_city = Column(String, default="")
    business_country = Column(String, default="Madagascar")
    business_description = Column(Text, default="")

    # Facebook
    facebook_page_name = Column(String, default="")
    facebook_page_url = Column(String, default="")
    facebook_admin_email = Column(String, default="")

    # Chatbot
    primary_language = Column(String, default="fr")
    bot_name = Column(String, default="L'assistant")
    tone = Column(String, default="amical")
    greeting_message = Column(Text, default="")

    # Vente
    offer_summary = Column(Text, default="")
    opening_hours = Column(String, default="")
    delivery_zones = Column(String, default="")

    # Notes
    notes_for_flare = Column(Text, default="")

    # Acces page FLARE
    flare_page_admin_confirmed = Column(String, default="false")
    flare_page_admin_confirmed_at = Column(DateTime, nullable=True)

    # Operateur
    assigned_operator_email = Column(String, nullable=True)
    internal_notes = Column(Text, default="")

    # Timestamps
    requested_at = Column(DateTime, default=datetime.utcnow)
    payment_verified_at = Column(DateTime, nullable=True)
    activation_started_at = Column(DateTime, nullable=True)
    tested_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    blocked_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivationRequestEvent(Base):
    """Audit trail pour les demandes d'activation."""
    __tablename__ = "activation_request_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    activation_request_id = Column(String, ForeignKey("activation_requests.id"), index=True, nullable=False)
    actor_type = Column(String, default="system")  # client | admin | system
    actor_id = Column(String, default="")
    event_type = Column(String, nullable=False)
    payload_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class ManualPaymentSubmission(Base):
    """Preuve de paiement manuel."""
    __tablename__ = "manual_payment_submissions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    organization_scope_id = Column(String, index=True, nullable=False)
    activation_request_id = Column(String, ForeignKey("activation_requests.id"), nullable=True)
    selected_plan_id = Column(String, default="starter")
    method_code = Column(String, nullable=False)
    amount = Column(String, default="")
    currency = Column(String, default="MGA")
    payer_full_name = Column(String, default="")
    payer_phone = Column(String, default="")
    transaction_reference = Column(String, index=True, default="")
    proof_file_url = Column(String, nullable=True)
    proof_file_name = Column(String, nullable=True)
    proof_file_size = Column(Integer, nullable=True)
    notes = Column(Text, default="")
    status = Column(String, default="draft")  # draft, submitted, verified, rejected
    submitted_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserReport(Base):
    """Signalement utilisateur remonte vers l'admin."""
    __tablename__ = "user_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    organization_scope_id = Column(String, index=True, nullable=False)
    reporter_user_id = Column(String, nullable=False)
    reporter_email = Column(String, default="")
    current_view = Column(String, default="")
    category = Column(String, default="other")
    severity = Column(String, default="normal")
    title = Column(String, default="")
    description = Column(Text, default="")
    expected_behavior = Column(Text, default="")
    contact_email = Column(String, default="")
    contact_phone = Column(String, default="")
    screenshot_url = Column(String, nullable=True)
    status = Column(String, default="new")
    admin_notes = Column(Text, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatbotOrder(Base):
    """Commande issue du chatbot Messenger."""
    __tablename__ = "chatbot_orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, index=True, nullable=False)
    organization_scope_id = Column(String, index=True, nullable=False)
    facebook_page_id = Column(String, nullable=True)
    page_name = Column(String, default="")
    contact_psid = Column(String, index=True, default="")
    contact_name = Column(String, default="")
    contact_phone = Column(String, default="")
    contact_email = Column(String, default="")
    source_conversation_id = Column(String, nullable=True)
    source_message_id = Column(String, nullable=True)
    product_summary = Column(Text, default="")
    quantity_text = Column(String, default="")
    amount_text = Column(String, default="")
    delivery_address = Column(Text, default="")
    customer_request_text = Column(Text, default="")
    confidence = Column(Float, default=0.0)
    source = Column(String, default="manual")  # signal | manual
    status = Column(String, default="detected")  # detected, contacted, confirmed, fulfilled, canceled
    needs_human_followup = Column(String, default="false")
    assigned_to = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



# ── Feature flags par plan ────────────────────────────────────────────────────
PLAN_FEATURES: dict[str, dict] = {
    "free": {
        "plan_id": "free",
        "plan_label": "Gratuit",
        "chatbot_messages_limit": 100,
        "catalogue_items_limit": 5,
        "has_leads": False,
        "has_budget": False,
        "has_portfolio": False,
        "has_sales_script": False,
        "has_chatbot_content": False,
        "has_multi_page": False,
        "has_team": False,
        "has_image_generation": False,
        "has_file_generation": False,
        "assistant_tier": "slow",    # lent, priorité basse
        "has_advanced_analytics": False,
        "upgrade_to": "starter",
    },
    "starter": {
        "plan_id": "starter",
        "plan_label": "Starter",
        "chatbot_messages_limit": 1000,
        "catalogue_items_limit": -1,
        "has_leads": True,
        "has_budget": False,
        "has_portfolio": False,
        "has_sales_script": False,
        "has_chatbot_content": True,
        "has_multi_page": False,
        "has_team": False,
        "has_image_generation": False,
        "has_file_generation": False,
        "assistant_tier": "fast",
        "has_advanced_analytics": False,
        "upgrade_to": "pro",
    },
    "pro": {
        "plan_id": "pro",
        "plan_label": "Pro",
        "chatbot_messages_limit": -1,
        "catalogue_items_limit": -1,
        "has_leads": True,
        "has_budget": True,
        "has_portfolio": True,
        "has_sales_script": True,
        "has_chatbot_content": True,
        "has_multi_page": False,
        "has_team": False,
        "has_image_generation": True,
        "has_file_generation": True,
        "assistant_tier": "full",
        "has_advanced_analytics": True,
        "upgrade_to": "business",
    },
    "business": {
        "plan_id": "business",
        "plan_label": "Business",
        "chatbot_messages_limit": -1,
        "catalogue_items_limit": -1,
        "has_leads": True,
        "has_budget": True,
        "has_portfolio": True,
        "has_sales_script": True,
        "has_chatbot_content": True,
        "has_multi_page": True,
        "has_team": True,
        "has_image_generation": True,
        "has_file_generation": True,
        "assistant_tier": "full",
        "has_advanced_analytics": True,
        "upgrade_to": None,
    },
}


def get_plan_features(plan_id: str) -> dict:
    """Retourne les feature flags pour un plan donné."""
    return PLAN_FEATURES.get(str(plan_id or "free").lower(), PLAN_FEATURES["free"])


class UsageLedger(Base):
    __tablename__ = 'usage_ledger'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    user_email = Column(String, nullable=True, index=True)
    model_name = Column(String, nullable=False)
    action_kind = Column(String, nullable=False)
    prompt_tokens = Column(Integer, default=0)
    candidate_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    usage_metadata = Column(JSON, nullable=True)

def record_usage(
    user_id: str,
    model_name: str,
    action_kind: str,
    prompt_tokens: int = 0,
    candidate_tokens: int = 0,
    user_email: Optional[str] = None,
    usage_metadata: Optional[Dict[str, Any]] = None,
):
    from .config import AI_PRICING

    total_tokens = prompt_tokens + candidate_tokens
    cost = 0.0

    pricing_info = AI_PRICING.get(model_name)
    if pricing_info:
        cost = (prompt_tokens * pricing_info.get("input", 0)) + (candidate_tokens * pricing_info.get("output", 0))

    db = SessionLocal()
    try:
        entry = UsageLedger(
            user_id=user_id,
            user_email=user_email,
            model_name=model_name,
            action_kind=action_kind,
            prompt_tokens=prompt_tokens,
            candidate_tokens=candidate_tokens,
            total_tokens=total_tokens,
            cost_usd=cost,
            usage_metadata=usage_metadata,
        )
        db.add(entry)
        db.commit()
    finally:
        db.close()


from sqlalchemy import text

def init_db():
    """Crée toutes les tables si elles n'existent pas.
    Active pgvector AVANT create_all pour que le type VECTOR soit disponible.
    """
    import logging
    _logger = logging.getLogger(__name__)

    # Activer pgvector en premier (nécessaire pour le type VECTOR dans knowledge_embeddings)
    if "postgresql" in (db_url or ""):
        db = SessionLocal()
        try:
            # Timeout de 10s pour éviter les locks morts
            db.execute(text("SET statement_timeout = '10s'"))
            db.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            db.commit()
            _logger.info("✅ Extension pgvector activée.")
        except Exception as e:
            db.rollback()
            _logger.warning(f"⚠️ pgvector extension: {e}")
        finally:
            db.close()

    _logger.info("📦 Création des tables...")
    Base.metadata.create_all(bind=engine)
    _logger.info("✅ Tables créées.")

    # Migration légère non destructive pour les nouvelles colonnes chatbot_preferences.
    chatbot_preferences_columns = {
        "page_id": "VARCHAR(255) DEFAULT NULL",
        "primary_role": "VARCHAR(40) DEFAULT 'mixte'",
        "business_name": "VARCHAR(160) DEFAULT ''",
        "business_sector": "VARCHAR(120) DEFAULT ''",
        "business_address": "TEXT DEFAULT ''",
        "business_hours": "TEXT DEFAULT ''",
        "phone": "VARCHAR(64) DEFAULT ''",
        "contact_email": "VARCHAR(254) DEFAULT ''",
        "website_url": "VARCHAR(500) DEFAULT ''",
        "off_hours_message": "TEXT DEFAULT ''",
        "handoff_message": "TEXT DEFAULT ''",
        "handoff_mode": "VARCHAR(40) DEFAULT 'auto'",
        "handoff_keywords": "TEXT DEFAULT '[]'",
        "forbidden_topics_or_claims": "TEXT DEFAULT ''",
    }
    db = SessionLocal()
    try:
        existing_columns = {
            str(column.get("name", "")).strip().lower()
            for column in inspect(engine).get_columns("chatbot_preferences")
        }
        for column_name, column_sql in chatbot_preferences_columns.items():
            if column_name in existing_columns:
                continue
            db.execute(text(f"ALTER TABLE chatbot_preferences ADD COLUMN {column_name} {column_sql}"))
            _logger.info("✅ Migration chatbot_preferences: colonne '%s' ajoutée.", column_name)
        db.commit()
    except Exception as e:
        db.rollback()
        _logger.warning("⚠️ Migration chatbot_preferences ignorée: %s", e)
    finally:
        db.close()

    # Migrations pour facebook_page_connections
    db = SessionLocal()
    try:
        existing_fb_cols = {str(c.get("name", "")).strip().lower() for c in inspect(engine).get_columns("facebook_page_connections")}
        if "page_picture_url" not in existing_fb_cols:
            db.execute(text("ALTER TABLE facebook_page_connections ADD COLUMN page_picture_url TEXT DEFAULT NULL"))
            _logger.info("✅ Migration facebook_page_connections: colonne 'page_picture_url' ajoutée.")
        db.commit()
    except Exception as e:
        db.rollback()
        _logger.warning("⚠️ Migration facebook_page_connections ignorée: %s", e)
    finally:
        db.close()

    # Migrations pour chatbot catalogue & portfolio (page_id)
    db = SessionLocal()
    try:
        if "page_id" not in {str(c.get("name", "")).strip().lower() for c in inspect(engine).get_columns("chatbot_catalogue_items")}:
            db.execute(text("ALTER TABLE chatbot_catalogue_items ADD COLUMN page_id VARCHAR(255) DEFAULT NULL"))
        if "page_id" not in {str(c.get("name", "")).strip().lower() for c in inspect(engine).get_columns("chatbot_portfolio_items")}:
            db.execute(text("ALTER TABLE chatbot_portfolio_items ADD COLUMN page_id VARCHAR(255) DEFAULT NULL"))
        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()

    # Migration manuelle pour pgvector (dimensions) — avec timeout court
    if "postgresql" in (db_url or ""):
        db = SessionLocal()
        try:
            db.execute(text("SET statement_timeout = '15s'"))
            db.execute(text("SET lock_timeout = '5s'"))
            db.execute(text("ALTER TABLE knowledge_embeddings ALTER COLUMN embedding TYPE vector(3072)"))
            db.commit()
            _logger.info("✅ Migration pgvector dimension (3072) réussie.")
        except Exception as e:
            # Soit déjà fait, soit la table n'existe pas, soit timeout
            db.rollback()
            _logger.info(f"ℹ️ pgvector migration skip: {e}")
        finally:
            db.close()


def get_db():
    """Générateur de session DB pour FastAPI Depends."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Fonctions CRUD pour LocalKnowledgeDoc (Fallback SQLite) ──────────────

def get_all_local_knowledge(user_id: str):
    db = SessionLocal()
    try:
        docs = db.query(LocalKnowledgeDoc).filter(
            LocalKnowledgeDoc.user_id == user_id
        ).order_by(LocalKnowledgeDoc.created_at.desc()).all()
        return [
            {
                "id": str(doc.id),
                "title": doc.title,
                "content": doc.content,
                "source": doc.source,
                "type": doc.doc_type,
                "word_count": doc.word_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None
            } for doc in docs
        ]
    finally:
        db.close()

def add_local_knowledge_doc(user_id: str, title: str, content: str, source: str = "", doc_type: str = "text") -> str:
    db = SessionLocal()
    try:
        doc = LocalKnowledgeDoc(
            user_id=user_id,
            title=title,
            content=content,
            source=source,
            doc_type=doc_type,
            word_count=len(content.split())
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return str(doc.id)
    finally:
        db.close()

def delete_local_knowledge_doc(user_id: str, doc_id: str) -> bool:
    db = SessionLocal()
    try:
        try:
            doc_id_int = int(doc_id)
        except ValueError:
            return False
        doc = db.query(LocalKnowledgeDoc).filter(
            LocalKnowledgeDoc.id == doc_id_int,
            LocalKnowledgeDoc.user_id == user_id
        ).first()
        if not doc:
            return False
        db.delete(doc)
        db.commit()
        return True
    finally:
        db.close()

def get_local_knowledge_doc_by_id(user_id: str, doc_id: str):
    """Retourne un document par ID, ou None si introuvable."""
    db = SessionLocal()
    try:
        try:
            doc_id_int = int(doc_id)
        except ValueError:
            return None
        doc = db.query(LocalKnowledgeDoc).filter(
            LocalKnowledgeDoc.id == doc_id_int,
            LocalKnowledgeDoc.user_id == user_id
        ).first()
        if not doc:
            return None
        return {
            "id": str(doc.id),
            "title": doc.title,
            "content": doc.content,
            "source": doc.source,
            "type": doc.doc_type,
            "word_count": doc.word_count,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
    finally:
        db.close()


def update_local_knowledge_doc(user_id: str, doc_id: str, additional_content: str, append: bool = True) -> bool:
    """Ajoute du contenu à un document existant (append) ou le remplace (replace)."""
    db = SessionLocal()
    try:
        try:
            doc_id_int = int(doc_id)
        except ValueError:
            return False
        doc = db.query(LocalKnowledgeDoc).filter(
            LocalKnowledgeDoc.id == doc_id_int,
            LocalKnowledgeDoc.user_id == user_id
        ).first()
        if not doc:
            return False
        if append:
            doc.content = doc.content + "\n\n" + additional_content
        else:
            doc.content = additional_content
        doc.word_count = len(doc.content.split())
        db.commit()
        return True
    finally:
        db.close()


def search_local_knowledge(user_id: str, query: str, max_results: int = 5):
    all_docs = get_all_local_knowledge(user_id)
    if not all_docs:
        return []
    query_lower = query.lower()
    keywords = [w for w in query_lower.split() if len(w) > 2]
    scored = []
    for doc in all_docs:
        text = (doc.get("title", "") + " " + doc.get("content", "")).lower()
        score = sum(text.count(kw) for kw in keywords)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:max_results]]


# ── Fonctions CRUD pour Folders ──────────────────────────────────────────

def get_local_folders(user_id: str):
    db = SessionLocal()
    try:
        folders = db.query(Folder).filter(Folder.user_id == user_id).all()
        return [
            {"id": f.id, "name": f.name, "color": f.color, "created_at": f.created_at.isoformat()}
            for f in folders
        ]
    finally:
        db.close()

def create_local_folder(user_id: str, name: str, color: str = "#FF7C1A"):
    db = SessionLocal()
    try:
        folder = Folder(id=str(uuid.uuid4()), user_id=user_id, name=name, color=color)
        db.add(folder)
        db.commit()
        return folder.id
    finally:
        db.close()

def update_local_folder(user_id: str, folder_id: str, name: Optional[str] = None, color: Optional[str] = None):
    db = SessionLocal()
    try:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == user_id).first()
        if not folder:
            return False
        if name: folder.name = name
        if color: folder.color = color
        db.commit()
        return True
    finally:
        db.close()

def delete_local_folder(user_id: str, folder_id: str):
    db = SessionLocal()
    try:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == user_id).first()
        if not folder:
            return False
        # Détacher les conversations
        db.query(Conversation).filter(Conversation.folder_id == folder_id).update({Conversation.folder_id: None})
        db.delete(folder)
        db.commit()
        return True
    finally:
        db.close()


# ── Fonctions Vectorielles (Google Cloud SQL / pgvector) ───────────────────

from sqlalchemy import text

def init_vector_extension():
    """Active l'extension pgvector sur PostgreSQL."""
    if "postgresql" in db_url:
        db = SessionLocal()
        try:
            db.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            db.commit()
            print("✅ Extension pgvector vérifiée/activée.")
        except Exception as e:
            # On ne bloque pas le démarrage si ça échoue (déjà actif ou manque de droits)
            print(f"⚠️ Warning: Could not verify pgvector extension: {e}")
        finally:
            db.close()

def add_vector_knowledge(user_id: str, title: str, content: str, vector: List[float], metadata: Dict[str, Any] = None):
    """Ajoute un document et son embedding dans Cloud SQL."""
    db = SessionLocal()
    try:
        doc = KnowledgeEmbedding(
            id=str(uuid.uuid4()),
            user_id=user_id,
            content=content,
            embedding=vector,
            metadata_json=metadata or {"title": title}
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc.id
    finally:
        db.close()

def search_vector_knowledge(user_id: str, query_vector: List[float], limit: int = 5, threshold: float = 0.5):
    """
    Recherche sémantique via cosine distance sur pgvector.
    Utilise l'opérateur <=> pour la cosine distance.
    """
    db = SessionLocal()
    try:
        # Cosine distance : embedding <=> query_vector
        # Similitude = 1 - distance
        results = db.query(KnowledgeEmbedding).filter(
            KnowledgeEmbedding.user_id == user_id
        ).order_by(
            KnowledgeEmbedding.embedding.cosine_distance(query_vector)
        ).limit(limit).all()
        
        formatted = []
        for doc in results:
            formatted.append({
                "id": doc.id,
                "content": doc.content,
                "metadata": doc.metadata_json,
                "user_id": doc.user_id
            })
        return formatted
    finally:
        db.close()

def list_vector_knowledge(user_id: str):
    db = SessionLocal()
    try:
        docs = db.query(KnowledgeEmbedding).filter(KnowledgeEmbedding.user_id == user_id).all()
        return [
            {
                "id": doc.id,
                "title": doc.metadata_json.get("title", "Sans titre"),
                "content": doc.content,
                "user_id": doc.user_id,
                "metadata": doc.metadata_json
            } for doc in docs
        ]
    finally:
        db.close()

def count_vector_knowledge(user_id: str) -> int:
    """Compte les documents KB d'un utilisateur (sans charger le contenu)."""
    db = SessionLocal()
    try:
        return db.query(func.count(KnowledgeEmbedding.id)).filter(KnowledgeEmbedding.user_id == user_id).scalar() or 0
    finally:
        db.close()

def delete_vector_knowledge(user_id: str, doc_id: str):
    db = SessionLocal()
    try:
        doc = db.query(KnowledgeEmbedding).filter(
            KnowledgeEmbedding.id == doc_id,
            KnowledgeEmbedding.user_id == user_id
        ).first()
        if not doc:
            return False
        db.delete(doc)
        db.commit()
        return True
    finally:
        db.close()


# ── CRUD Abonnements ───────────────────────────────────────────────────

def seed_subscription_plans():
    """Crée/met à jour les plans d'abonnement."""
    db = SessionLocal()
    try:
        plans_data = [
            {
                "id": "free", "name": "Free",
                "daily_budget_usd": 0.05,
                "allowed_models": "gemini-3-flash,gemini-2.5-flash-lite",
                "max_images_per_day": 2,
                "max_videos_per_day": 0,
            },
            {
                "id": "starter", "name": "Starter",
                "daily_budget_usd": 0.20,
                "allowed_models": "gemini-3-flash,gemini-2.5-flash-lite",
                "max_images_per_day": 5,
                "max_videos_per_day": 0,
            },
            {
                "id": "pro", "name": "Pro",
                "daily_budget_usd": 0.50,
                "allowed_models": "gemini-2.5-pro-preview,gemini-3-flash,gemini-2.5-flash-lite",
                "max_images_per_day": 20,
                "max_videos_per_day": 3,
            },
            {
                "id": "business", "name": "Business",
                "daily_budget_usd": -1,  # Illimité
                "allowed_models": "gemini-2.5-pro-preview,gemini-3-flash,gemini-2.5-flash-lite",
                "max_images_per_day": -1,
                "max_videos_per_day": -1,
            },
        ]
        for data in plans_data:
            existing = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == data["id"]).first()
            if existing:
                for key, val in data.items():
                    if key != "id":
                        setattr(existing, key, val)
            else:
                db.add(SubscriptionPlan(**data))
        db.commit()
    finally:
        db.close()


def get_user_subscription(user_id: str) -> Optional[Dict]:
    """Retourne le plan actuel + usage quotidien pour un utilisateur."""
    db = SessionLocal()
    try:
        sub = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()
        if not sub:
            return None
        plan = sub.plan

        # Calcul de l'usage du jour depuis UsageLedger
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        daily_cost = db.query(func.coalesce(func.sum(UsageLedger.cost_usd), 0.0)).filter(
            UsageLedger.user_id == user_id,
            UsageLedger.timestamp >= today_start,
        ).scalar() or 0.0

        daily_images = db.query(func.count(UsageLedger.id)).filter(
            UsageLedger.user_id == user_id,
            UsageLedger.timestamp >= today_start,
            UsageLedger.action_kind == "image",
        ).scalar() or 0

        daily_videos = db.query(func.count(UsageLedger.id)).filter(
            UsageLedger.user_id == user_id,
            UsageLedger.timestamp >= today_start,
            UsageLedger.action_kind == "video",
        ).scalar() or 0

        budget = plan.daily_budget_usd if plan else 0.05
        usage_percent = (daily_cost / budget * 100) if budget > 0 else 0.0

        return {
            "user_id": sub.user_id,
            "user_email": sub.user_email,
            "plan_id": sub.plan_id,
            "plan_name": plan.name if plan else "Free",
            "daily_budget_usd": budget,
            "daily_cost_usd": round(daily_cost, 6),
            "usage_percent": round(min(usage_percent, 100), 1),
            "daily_images": daily_images,
            "max_images_per_day": plan.max_images_per_day if plan else 0,
            "daily_videos": daily_videos,
            "max_videos_per_day": plan.max_videos_per_day if plan else 0,
            "allowed_models": (plan.allowed_models or "").split(",") if plan else [],
        }
    finally:
        db.close()


def create_user_subscription(
    user_id: str,
    plan_id: str = "free",
    user_email: Optional[str] = None,
) -> bool:
    """Crée un abonnement pour un nouvel utilisateur. Idempotent."""
    db = SessionLocal()
    try:
        existing = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
        if existing:
            # Mettre à jour l'email si on l'a maintenant
            if user_email and not existing.user_email:
                existing.user_email = user_email
                db.commit()
            return False  # Déjà inscrit
        sub = UserSubscription(
            user_id=user_id,
            plan_id=plan_id,
            user_email=user_email,
        )
        db.add(sub)
        db.commit()
        return True
    finally:
        db.close()


def check_quota(user_id: str, kind: str = "message") -> Dict:
    """
    Vérifie le quota quotidien basé sur les coûts réels (UsageLedger).
    kind: 'message' | 'image' | 'video'
    Retourne {'allowed': bool, 'daily_cost': float, 'daily_budget': float, 'plan_name': str, ...}
    """
    from .config import settings as _settings

    # Les comptes dev n'ont pas de limites
    dev_emails = [e.strip() for e in _settings.DEV_EMAILS.split(",")]

    db = SessionLocal()
    try:
        sub = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
        if not sub:
            return {"allowed": True, "daily_cost": 0, "daily_budget": -1, "plan_name": "none"}

        # Dev accounts = illimité
        if sub.user_email and sub.user_email in dev_emails:
            return {"allowed": True, "daily_cost": 0, "daily_budget": -1, "plan_name": "Dev"}

        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
        budget = plan.daily_budget_usd if plan else 0.05
        plan_name = plan.name if plan else "Free"

        # Budget illimité
        if budget == -1:
            return {"allowed": True, "daily_cost": 0, "daily_budget": -1, "plan_name": plan_name}

        # Calculer le coût du jour depuis UsageLedger
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        daily_cost = db.query(func.coalesce(func.sum(UsageLedger.cost_usd), 0.0)).filter(
            UsageLedger.user_id == user_id,
            UsageLedger.timestamp >= today_start,
        ).scalar() or 0.0

        # Vérification budget global
        if daily_cost >= budget:
            return {
                "allowed": False, "daily_cost": round(daily_cost, 4),
                "daily_budget": budget, "plan_name": plan_name, "plan_id": sub.plan_id,
                "reason": "budget",
            }

        # Vérification limites média
        if kind == "image":
            max_img = plan.max_images_per_day if plan else 0
            if max_img != -1:
                count = db.query(func.count(UsageLedger.id)).filter(
                    UsageLedger.user_id == user_id,
                    UsageLedger.timestamp >= today_start,
                    UsageLedger.action_kind == "image",
                ).scalar() or 0
                if count >= max_img:
                    return {
                        "allowed": False, "daily_cost": round(daily_cost, 4),
                        "daily_budget": budget, "plan_name": plan_name,
                        "reason": "image_limit", "usage": count, "limit": max_img,
                    }

        elif kind == "video":
            max_vid = plan.max_videos_per_day if plan else 0
            if max_vid != -1:
                count = db.query(func.count(UsageLedger.id)).filter(
                    UsageLedger.user_id == user_id,
                    UsageLedger.timestamp >= today_start,
                    UsageLedger.action_kind == "video",
                ).scalar() or 0
                if count >= max_vid:
                    return {
                        "allowed": False, "daily_cost": round(daily_cost, 4),
                        "daily_budget": budget, "plan_name": plan_name,
                        "reason": "video_limit", "usage": count, "limit": max_vid,
                    }

        return {
            "allowed": True, "daily_cost": round(daily_cost, 4),
            "daily_budget": budget, "plan_name": plan_name,
        }
    finally:
        db.close()


def upgrade_user_plan(user_id: str, new_plan_id: str) -> bool:
    """Met à jour le plan d'un utilisateur."""
    db = SessionLocal()
    try:
        sub = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
        if not sub:
            return False
        sub.plan_id = new_plan_id
        sub.updated_at = datetime.utcnow()
        db.commit()
        return True
    finally:
        db.close()








