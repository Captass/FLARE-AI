"""
Router Activation — Activation assistee, paiement manuel, commandes chatbot.
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.auth import get_user_email_from_header, get_user_id_from_header, get_user_identity
from core.config import settings
from core.database import (
    ActivationRequest,
    ActivationRequestEvent,
    ACTIVATION_TERMINAL_STATUSES,
    ChatbotOrder,
    ChatbotPreferences,
    ManualPaymentSubmission,
    REPORT_STATUSES,
    SubscriptionPlan,
    UserReport,
    UserSubscription,
    get_db,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["activation"])

# ── Helpers ───────────────────────────────────────────────────────────────────


def _configured_admin_emails() -> set[str]:
    return {
        email.strip().lower()
        for email in str(settings.ADMIN_EMAILS or "").split(",")
        if email and email.strip()
    }


def _get_user_context(authorization: Optional[str]) -> tuple[str, str]:
    """Return (user_id, user_email) or raise."""
    user_id = get_user_id_from_header(authorization)
    user_email = get_user_email_from_header(authorization).strip().lower()

    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    return user_id, user_email


def _check_admin(authorization: Optional[str]) -> tuple[str, str]:
    user_id, user_email = get_user_identity(authorization)
    if user_id == "anonymous" or not str(user_email or "").strip():
        raise HTTPException(status_code=401, detail="Authentification admin requise.")
    admin_emails = _configured_admin_emails()
    if not admin_emails:
        logger.error("[activation] ADMIN_EMAILS est vide ou invalide.")
        raise HTTPException(status_code=503, detail="Configuration admin indisponible.")
    if user_email.lower() not in admin_emails:
        raise HTTPException(status_code=403, detail="Acces admin requis.")
    return user_id, user_email


def _add_event(
    db: Session,
    request_id: str,
    event_type: str,
    actor_type: str,
    actor_id: str,
    payload: Optional[dict] = None,
    user_id: Optional[str] = None,
) -> None:
    resolved_user_id = user_id
    if not resolved_user_id:
        ar = db.query(ActivationRequest).filter(ActivationRequest.id == request_id).first()
        if ar:
            resolved_user_id = ar.user_id or ar.requester_user_id
    db.add(ActivationRequestEvent(
        activation_request_id=request_id,
        user_id=resolved_user_id,
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        payload_json=payload or {},
    ))


def _normalize_facebook_pages_context(raw_pages: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_pages, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for raw in raw_pages:
        if not isinstance(raw, dict):
            continue
        page_id = str(raw.get("page_id") or raw.get("id") or "").strip()
        page_name = str(raw.get("page_name") or raw.get("name") or "").strip()
        if not page_id and not page_name:
            continue
        item: Dict[str, Any] = {
            "page_id": page_id,
            "page_name": page_name,
        }
        page_url = str(raw.get("page_url") or raw.get("url") or "").strip()
        if page_url:
            item["page_url"] = page_url[:1000]
        if "is_selected" in raw:
            item["is_selected"] = bool(raw.get("is_selected"))
        if "is_active" in raw:
            item["is_active"] = bool(raw.get("is_active"))
        normalized.append(item)
        if len(normalized) >= 50:
            break
    return normalized


def _decode_facebook_pages_context(raw_json: Optional[str]) -> List[Dict[str, Any]]:
    if not raw_json:
        return []
    try:
        parsed = json.loads(raw_json)
    except Exception:
        return []
    return _normalize_facebook_pages_context(parsed)


def _normalize_page_name(value: str) -> str:
    return str(value or "").strip().lower()


def _resolve_flare_selected_page(
    pages_context: List[Dict[str, Any]],
    requested_id: str,
    requested_name: str,
) -> tuple[str, str]:
    explicit_id = (requested_id or "").strip()
    explicit_name = (requested_name or "").strip()
    selected_page = next((page for page in pages_context if page.get("is_selected")), None)

    if explicit_id:
        for page in pages_context:
            if str(page.get("page_id") or "").strip() == explicit_id:
                return explicit_id, str(page.get("page_name") or explicit_name or "").strip()
        return explicit_id, explicit_name

    if explicit_name:
        norm = _normalize_page_name(explicit_name)
        for page in pages_context:
            if _normalize_page_name(str(page.get("page_name") or "")) == norm:
                return str(page.get("page_id") or "").strip(), str(page.get("page_name") or explicit_name).strip()
        return "", explicit_name

    if selected_page:
        return (
            str(selected_page.get("page_id") or "").strip(),
            str(selected_page.get("page_name") or "").strip(),
        )

    if pages_context:
        return (
            str(pages_context[0].get("page_id") or "").strip(),
            str(pages_context[0].get("page_name") or "").strip(),
        )

    return "", ""


def _resolve_activation_target(
    requested_id: str,
    requested_name: str,
    pages_context: List[Dict[str, Any]],
) -> tuple[str, str]:
    page_id = (requested_id or "").strip()
    page_name = (requested_name or "").strip()
    if page_id or page_name:
        if not pages_context:
            raise HTTPException(
                status_code=400,
                detail="Importez vos pages Facebook avant de choisir une page cible.",
            )

        if page_id:
            for page in pages_context:
                ctx_page_id = str(page.get("page_id") or "").strip()
                if ctx_page_id == page_id:
                    resolved_name = str(page.get("page_name") or page_name or "").strip()
                    return page_id, resolved_name
            raise HTTPException(
                status_code=400,
                detail="La page cible selectionnee n'appartient pas aux pages importees dans cet espace.",
            )

        normalized_requested_name = _normalize_page_name(page_name)
        name_matches = [
            page for page in pages_context
            if _normalize_page_name(str(page.get("page_name") or "")) == normalized_requested_name
        ]
        if len(name_matches) == 1:
            matched = name_matches[0]
            return (
                str(matched.get("page_id") or "").strip(),
                str(matched.get("page_name") or page_name).strip(),
            )
        if len(name_matches) > 1:
            raise HTTPException(
                status_code=400,
                detail="Plusieurs pages portent ce nom. Selectionnez la page cible par identifiant.",
            )
        raise HTTPException(
            status_code=400,
            detail="La page cible selectionnee n'appartient pas aux pages importees dans cet espace.",
        )

    selected_page = next((page for page in pages_context if page.get("is_selected")), None)
    fallback_page = selected_page or (pages_context[0] if pages_context else None)
    if not fallback_page:
        return "", ""
    return (
        str(fallback_page.get("page_id") or "").strip(),
        str(fallback_page.get("page_name") or "").strip(),
    )


def _activation_summary(ar: Optional[ActivationRequest]) -> Optional[Dict[str, Any]]:
    if not ar:
        return None
    selected_pages = _decode_facebook_pages_context(ar.selected_facebook_pages_json)
    return {
        "id": ar.id,
        "user_id": ar.user_id or ar.requester_user_id,
        "selected_plan_id": ar.selected_plan_id,
        "status": ar.status,
        "payment_status": ar.payment_status,
        "contact_full_name": ar.contact_full_name,
        "contact_email": ar.contact_email,
        "contact_phone": ar.contact_phone,
        "contact_whatsapp": ar.contact_whatsapp,
        "business_name": ar.business_name,
        "business_sector": ar.business_sector,
        "facebook_page_name": ar.facebook_page_name,
        "flare_selected_page_id_at_submission": ar.flare_selected_page_id_at_submission,
        "flare_selected_page_name_at_submission": ar.flare_selected_page_name_at_submission,
        "activation_target_page_id": ar.activation_target_page_id,
        "activation_target_page_name": ar.activation_target_page_name,
        "selected_facebook_pages_snapshot": selected_pages,
        "selected_facebook_pages_count": len(selected_pages),
        "facebook_page_url": ar.facebook_page_url,
        "facebook_admin_email": ar.facebook_admin_email,
        "bot_name": ar.bot_name,
        "primary_language": ar.primary_language,
        "notes_for_flare": ar.notes_for_flare,
        "assigned_operator_email": ar.assigned_operator_email,
    }


def _serialize_subscription(sub: Optional[UserSubscription]) -> Optional[Dict[str, Any]]:
    if not sub:
        return None
    return {
        "user_id": sub.user_id,
        "user_email": sub.user_email,
        "plan_id": sub.plan_id,
        "status": sub.status,
        "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
    }


DEFAULT_PAYMENT_METHODS: List[Dict[str, Any]] = [
    {
        "code": "mvola",
        "label": "MVola",
        "recipient_name": "FLARE AI",
        "recipient_number": "034 02 107 31",
        "instructions": "Envoyez le montant exact via MVola au numero ci-dessus, puis saisissez la reference de transaction generee.",
        "currency": "MGA",
        "enabled": True,
    },
    {
        "code": "orange_money",
        "label": "Orange Money",
        "recipient_name": "FLARE AI",
        "recipient_number": "034 02 107 31",
        "instructions": "Envoyez le montant exact via Orange Money au numero ci-dessus, puis saisissez la reference de transaction generee.",
        "currency": "MGA",
        "enabled": True,
    },
]


def _get_manual_payment_methods() -> List[Dict[str, Any]]:
    raw = (settings.MANUAL_PAYMENT_METHODS_JSON or "").strip()
    if not raw:
        # Fallback to defaults when env var is not configured
        return DEFAULT_PAYMENT_METHODS
    try:
        methods = json.loads(raw)
        if not isinstance(methods, list):
            return DEFAULT_PAYMENT_METHODS
        configured = [m for m in methods if isinstance(m, dict) and m.get("enabled")]
        return configured if configured else DEFAULT_PAYMENT_METHODS
    except Exception:
        return DEFAULT_PAYMENT_METHODS


# ── Launch config ─────────────────────────────────────────────────────────────


@router.get("/api/chatbot/assisted-launch-config")
def get_assisted_launch_config(authorization: Optional[str] = Header(None)):
    """Config publique pour le tunnel d'activation assistee."""
    get_user_id_from_header(authorization)  # auth check

    methods = _get_manual_payment_methods()
    return {
        "payment_methods": [
            {
                "code": m.get("code", ""),
                "label": m.get("label", ""),
                "recipient_name": m.get("recipient_name", ""),
                "recipient_number": m.get("recipient_number", ""),
                "instructions": m.get("instructions", ""),
                "currency": m.get("currency", "MGA"),
            }
            for m in methods
        ],
        "flare_operator": {
            "name": settings.FLARE_FACEBOOK_OPERATOR_NAME,
            "contact": settings.FLARE_FACEBOOK_OPERATOR_CONTACT,
        },
        "sla_minutes": settings.ACTIVATION_SLA_MINUTES,
        "assistance_text": "Nous activons votre chatbot pour vous apres paiement et validation. Ajoutez le compte FLARE comme admin de votre page, nous faisons le reste.",
    }


# ── Manual payment methods ────────────────────────────────────────────────────


@router.get("/api/billing/manual-methods")
def get_manual_methods(authorization: Optional[str] = Header(None)):
    get_user_id_from_header(authorization)
    return {"methods": _get_manual_payment_methods()}


# ── Manual payment submissions (client) ───────────────────────────────────────


class ManualPaymentRequest(BaseModel):
    activation_request_id: Optional[str] = None
    selected_plan_id: str = "starter"
    method_code: str
    amount: str = ""
    currency: str = "MGA"
    payer_full_name: str = ""
    payer_phone: str = ""
    transaction_reference: str = ""
    proof_file_url: Optional[str] = None
    proof_file_name: Optional[str] = None
    proof_file_size: Optional[int] = None
    notes: str = ""


@router.post("/api/billing/manual-payments")
def submit_manual_payment(
    req: ManualPaymentRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    # Validate method
    methods = _get_manual_payment_methods()
    valid_codes = {m["code"] for m in methods}
    if req.method_code not in valid_codes:
        raise HTTPException(status_code=400, detail="Methode de paiement invalide.")

    # Anti-duplicate: same reference + method
    ref = req.transaction_reference.strip()
    if ref:
        existing = db.query(ManualPaymentSubmission).filter(
            ManualPaymentSubmission.method_code == req.method_code,
            ManualPaymentSubmission.transaction_reference == ref,
            ManualPaymentSubmission.status.in_(["submitted", "verified"]),
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Cette reference de transaction a deja ete soumise.")

    submission = ManualPaymentSubmission(
        organization_slug=user_id,
        organization_scope_id=scope_id,
        user_id=user_id,
        activation_request_id=req.activation_request_id,
        selected_plan_id=req.selected_plan_id,
        method_code=req.method_code,
        amount=req.amount,
        currency=req.currency,
        payer_full_name=req.payer_full_name,
        payer_phone=req.payer_phone,
        transaction_reference=ref,
        proof_file_url=req.proof_file_url,
        proof_file_name=req.proof_file_name,
        proof_file_size=req.proof_file_size,
        notes=req.notes,
        status="submitted",
        submitted_at=datetime.utcnow(),
    )
    db.add(submission)

    # Update activation request payment status if linked
    if req.activation_request_id:
        ar = db.query(ActivationRequest).filter(ActivationRequest.id == req.activation_request_id).first()
        if ar and (ar.user_id == user_id or ar.requester_user_id == user_id):
            ar.payment_status = "submitted"
            if ar.status == "awaiting_payment":
                ar.status = "payment_submitted"
            _add_event(db, ar.id, "payment_submitted", "client", user_email, {
                "submission_id": submission.id,
                "method": req.method_code,
                "amount": req.amount,
            })

    db.commit()
    db.refresh(submission)

    logger.info(f"[activation] Payment submitted: {submission.id} by {user_email} for {user_id}")
    return {"id": submission.id, "status": submission.status}


@router.get("/api/billing/manual-payments/me")
def get_my_manual_payments(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    submissions = db.query(ManualPaymentSubmission).filter(
        or_(
            ManualPaymentSubmission.user_id == user_id,
            ManualPaymentSubmission.organization_scope_id == scope_id,
        )
    ).order_by(ManualPaymentSubmission.created_at.desc()).all()

    return {
        "submissions": [
            {
                "id": s.id,
                "method_code": s.method_code,
                "amount": s.amount,
                "currency": s.currency,
                "transaction_reference": s.transaction_reference,
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "verified_at": s.verified_at.isoformat() if s.verified_at else None,
                "rejection_reason": s.rejection_reason,
                "proof_file_url": s.proof_file_url,
            }
            for s in submissions
        ]
    }


# ── Activation request (client) ──────────────────────────────────────────────


class ActivationRequestPayload(BaseModel):
    selected_plan_id: str = "starter"
    contact_full_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    contact_whatsapp: str = ""
    business_name: str = ""
    business_sector: str = ""
    business_city: str = ""
    business_country: str = "Madagascar"
    business_description: str = ""
    facebook_page_name: str = ""
    facebook_page_url: str = ""
    facebook_admin_email: str = ""
    selected_facebook_pages: List[Dict[str, Any]] = Field(default_factory=list)
    flare_selected_page_id: str = ""
    flare_selected_page_name: str = ""
    activation_target_page_id: str = ""
    activation_target_page_name: str = ""
    primary_language: str = "fr"
    bot_name: str = "L'assistant"
    tone: str = "amical"
    greeting_message: str = ""
    offer_summary: str = ""
    opening_hours: str = ""
    delivery_zones: str = ""
    notes_for_flare: str = ""


@router.get("/api/chatbot/activation-request")
def get_my_activation_request(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    ar = db.query(ActivationRequest).filter(
        or_(
            ActivationRequest.user_id == user_id,
            ActivationRequest.requester_user_id == user_id,
            ActivationRequest.organization_scope_id == scope_id,
        ),
        ~ActivationRequest.status.in_(ACTIVATION_TERMINAL_STATUSES - {"active"}),
    ).order_by(ActivationRequest.created_at.desc()).first()

    if not ar:
        return {"activation_request": None}
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == (ar.user_id or ar.requester_user_id)
    ).first()
    return {"activation_request": _serialize_activation_request(ar, subscription=subscription)}


@router.post("/api/chatbot/activation-request")
def create_activation_request(
    req: ActivationRequestPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    # Only one non-terminal request per user
    existing = db.query(ActivationRequest).filter(
        or_(
            ActivationRequest.user_id == user_id,
            ActivationRequest.requester_user_id == user_id,
            ActivationRequest.organization_scope_id == scope_id,
        ),
        ~ActivationRequest.status.in_(ACTIVATION_TERMINAL_STATUSES),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Une demande d'activation est deja en cours pour ce compte.")

    selected_pages_context = _normalize_facebook_pages_context(req.selected_facebook_pages)
    flare_selected_page_id, flare_selected_page_name = _resolve_flare_selected_page(
        selected_pages_context,
        req.flare_selected_page_id,
        req.flare_selected_page_name,
    )
    target_page_id, target_page_name = _resolve_activation_target(
        req.activation_target_page_id,
        req.activation_target_page_name or req.facebook_page_name or flare_selected_page_name,
        selected_pages_context,
    )
    legacy_page_name = (req.facebook_page_name or target_page_name or flare_selected_page_name or "").strip()

    ar = ActivationRequest(
        organization_slug=user_id,
        organization_scope_id=scope_id,
        user_id=user_id,
        requester_user_id=user_id,
        selected_plan_id=req.selected_plan_id,
        status="awaiting_payment",
        contact_full_name=req.contact_full_name,
        contact_email=req.contact_email or user_email,
        contact_phone=req.contact_phone,
        contact_whatsapp=req.contact_whatsapp,
        business_name=req.business_name,
        business_sector=req.business_sector,
        business_city=req.business_city,
        business_country=req.business_country,
        business_description=req.business_description,
        facebook_page_name=legacy_page_name,
        facebook_page_url=req.facebook_page_url,
        facebook_admin_email=req.facebook_admin_email,
        selected_facebook_pages_json=json.dumps(selected_pages_context, ensure_ascii=False),
        flare_selected_page_id_at_submission=flare_selected_page_id,
        flare_selected_page_name_at_submission=flare_selected_page_name,
        activation_target_page_id=target_page_id,
        activation_target_page_name=target_page_name,
        primary_language=req.primary_language,
        bot_name=req.bot_name,
        tone=req.tone,
        greeting_message=req.greeting_message,
        offer_summary=req.offer_summary,
        opening_hours=req.opening_hours,
        delivery_zones=req.delivery_zones,
        notes_for_flare=req.notes_for_flare,
        requested_at=datetime.utcnow(),
    )
    db.add(ar)
    db.flush()

    _add_event(
        db,
        ar.id,
        "request_created",
        "client",
        user_email,
        {
            "plan": req.selected_plan_id,
            "target_page_id": target_page_id,
            "target_page_name": target_page_name,
            "flare_selected_page_id_at_submission": flare_selected_page_id,
            "flare_selected_page_name_at_submission": flare_selected_page_name,
            "selected_pages_count": len(selected_pages_context),
        },
    )

    # Initialize chatbot preferences from the form data
    prefs = db.query(ChatbotPreferences).filter(
        or_(
            ChatbotPreferences.user_id == user_id,
            ChatbotPreferences.organization_slug == user_id,
        ),
        ChatbotPreferences.page_id.is_(None),
    ).first()
    if not prefs:
        prefs = ChatbotPreferences(organization_slug=user_id, user_id=user_id)
        db.add(prefs)

    prefs.bot_name = req.bot_name or prefs.bot_name
    prefs.tone = req.tone or prefs.tone
    prefs.language = req.primary_language or prefs.language
    prefs.greeting_message = req.greeting_message or prefs.greeting_message
    prefs.business_name = req.business_name or prefs.business_name
    prefs.business_sector = req.business_sector or prefs.business_sector
    prefs.company_description = req.business_description or prefs.company_description
    prefs.business_hours = req.opening_hours or prefs.business_hours
    prefs.phone = req.contact_phone or prefs.phone
    prefs.contact_email = req.contact_email or prefs.contact_email
    prefs.products_summary = req.offer_summary or prefs.products_summary

    db.commit()
    db.refresh(ar)

    logger.info(f"[activation] Request created: {ar.id} for {user_id} by {user_email}")
    subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    return {"activation_request": _serialize_activation_request(ar, subscription=subscription)}


@router.patch("/api/chatbot/activation-request")
def update_activation_request(
    updates: Dict[str, Any],
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    ar = db.query(ActivationRequest).filter(
        or_(
            ActivationRequest.user_id == user_id,
            ActivationRequest.requester_user_id == user_id,
            ActivationRequest.organization_scope_id == scope_id,
        ),
        ~ActivationRequest.status.in_(ACTIVATION_TERMINAL_STATUSES),
    ).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Aucune demande d'activation en cours.")

    request_context_locked = ar.status not in {"draft", "awaiting_payment"}

    # Client-updatable fields
    allowed_fields = {
        "contact_full_name", "contact_email", "contact_phone", "contact_whatsapp",
        "business_name", "business_sector", "business_city", "business_country", "business_description",
        "facebook_page_name", "facebook_page_url", "facebook_admin_email",
        "flare_selected_page_id", "flare_selected_page_name",
        "activation_target_page_id", "activation_target_page_name",
        "primary_language", "bot_name", "tone", "greeting_message",
        "offer_summary", "opening_hours", "delivery_zones", "notes_for_flare",
    }

    immutable_context_fields = {
        "selected_facebook_pages",
        "flare_selected_page_id",
        "flare_selected_page_name",
        "activation_target_page_id",
        "activation_target_page_name",
    }
    if request_context_locked and any(field in updates for field in immutable_context_fields):
        raise HTTPException(
            status_code=409,
            detail="Le contexte de page est verrouille apres soumission du paiement.",
        )

    selected_pages_context: Optional[List[Dict[str, Any]]] = None
    current_pages_context = _decode_facebook_pages_context(ar.selected_facebook_pages_json)
    if "selected_facebook_pages" in updates:
        selected_pages_context = _normalize_facebook_pages_context(updates.get("selected_facebook_pages"))
        ar.selected_facebook_pages_json = json.dumps(selected_pages_context, ensure_ascii=False)
        current_pages_context = selected_pages_context

    for key, value in updates.items():
        if key in {"flare_selected_page_id", "flare_selected_page_name"}:
            continue
        if key in allowed_fields and hasattr(ar, key):
            setattr(ar, key, value)

    if "flare_selected_page_id" in updates or "flare_selected_page_name" in updates or selected_pages_context is not None:
        resolved_flare_selected_page_id, resolved_flare_selected_page_name = _resolve_flare_selected_page(
            current_pages_context,
            str(updates.get("flare_selected_page_id", ar.flare_selected_page_id_at_submission) or ""),
            str(updates.get("flare_selected_page_name", ar.flare_selected_page_name_at_submission) or ""),
        )
        ar.flare_selected_page_id_at_submission = resolved_flare_selected_page_id
        ar.flare_selected_page_name_at_submission = resolved_flare_selected_page_name

    if updates.get("activation_target_page_name") and not updates.get("facebook_page_name"):
        ar.facebook_page_name = str(updates.get("activation_target_page_name") or "").strip()

    ar.activation_target_page_id = str(ar.activation_target_page_id or "").strip()
    ar.activation_target_page_name = str(ar.activation_target_page_name or "").strip()

    if any(field in updates for field in {"activation_target_page_id", "activation_target_page_name"}) or selected_pages_context is not None:
        resolved_target_id, resolved_target_name = _resolve_activation_target(
            str(updates.get("activation_target_page_id", ar.activation_target_page_id) or ""),
            str(updates.get("activation_target_page_name", ar.activation_target_page_name or ar.facebook_page_name) or ""),
            current_pages_context,
        )
        ar.activation_target_page_id = resolved_target_id
        ar.activation_target_page_name = resolved_target_name

    # Handle FLARE page admin confirmation
    if updates.get("flare_page_admin_confirmed") == "true" and ar.flare_page_admin_confirmed != "true":
        ar.flare_page_admin_confirmed = "true"
        ar.flare_page_admin_confirmed_at = datetime.utcnow()
        ar.flare_page_admin_confirmed_by = user_email
        _add_event(db, ar.id, "fb_access_confirmed", "client", user_email)

        # Auto-advance status if payment is verified
        if ar.status == "awaiting_flare_page_admin_access":
            ar.status = "queued_for_activation"

    db.commit()
    db.refresh(ar)
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == (ar.user_id or ar.requester_user_id)
    ).first()
    return {"activation_request": _serialize_activation_request(ar, subscription=subscription)}


# ── Admin: payments ───────────────────────────────────────────────────────────


@router.get("/api/admin/payments")
def admin_list_payments(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)

    submissions = db.query(ManualPaymentSubmission).order_by(
        ManualPaymentSubmission.created_at.desc()
    ).limit(200).all()
    activation_ids = [s.activation_request_id for s in submissions if s.activation_request_id]
    activation_map: Dict[str, ActivationRequest] = {}
    if activation_ids:
        activations = db.query(ActivationRequest).filter(ActivationRequest.id.in_(activation_ids)).all()
        activation_map = {a.id: a for a in activations}
    user_ids = {
        str(s.user_id).strip()
        for s in submissions
        if str(s.user_id or "").strip()
    }
    user_ids.update(
        str((activation_map.get(s.activation_request_id).user_id or activation_map.get(s.activation_request_id).requester_user_id) or "").strip()
        for s in submissions
        if s.activation_request_id and activation_map.get(s.activation_request_id)
    )
    user_ids = {user_id for user_id in user_ids if user_id}
    subscription_map: Dict[str, UserSubscription] = {}
    if user_ids:
        subscriptions = db.query(UserSubscription).filter(UserSubscription.user_id.in_(list(user_ids))).all()
        subscription_map = {sub.user_id: sub for sub in subscriptions}

    payments: List[Dict[str, Any]] = []
    for s in submissions:
        activation = activation_map.get(s.activation_request_id) if s.activation_request_id else None
        target_user_id = str(
            s.user_id
            or (activation.user_id if activation else "")
            or (activation.requester_user_id if activation else "")
            or ""
        ).strip()
        subscription = subscription_map.get(target_user_id) if target_user_id else None
        payments.append({
            "id": s.id,
            "user_id": target_user_id or None,
            "activation_request_id": s.activation_request_id,
            "selected_plan_id": s.selected_plan_id,
            "method_code": s.method_code,
            "amount": s.amount,
            "currency": s.currency,
            "payer_full_name": s.payer_full_name,
            "payer_phone": s.payer_phone,
            "transaction_reference": s.transaction_reference,
            "proof_file_url": s.proof_file_url,
            "proof_file_name": s.proof_file_name,
            "status": s.status,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "verified_at": s.verified_at.isoformat() if s.verified_at else None,
            "verified_by": s.verified_by,
            "rejection_reason": s.rejection_reason,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "applied_plan_id": subscription.plan_id if subscription else None,
            "subscription_status": subscription.status if subscription else None,
            "activation_summary": _activation_summary(activation),
        })

    return {"payments": payments}


@router.get("/api/admin/payments/{payment_id}")
def admin_get_payment(
    payment_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)
    s = db.query(ManualPaymentSubmission).filter(ManualPaymentSubmission.id == payment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")
    activation = None
    if s.activation_request_id:
        activation = db.query(ActivationRequest).filter(ActivationRequest.id == s.activation_request_id).first()
    subscription = None
    target_user_id = str(s.user_id or (activation.user_id if activation else "") or (activation.requester_user_id if activation else "") or "").strip()
    if target_user_id:
        subscription = db.query(UserSubscription).filter(UserSubscription.user_id == target_user_id).first()
    return {
        "id": s.id,
        "user_id": s.user_id,
        "activation_request_id": s.activation_request_id,
        "selected_plan_id": s.selected_plan_id,
        "method_code": s.method_code,
        "amount": s.amount,
        "currency": s.currency,
        "payer_full_name": s.payer_full_name,
        "payer_phone": s.payer_phone,
        "transaction_reference": s.transaction_reference,
        "proof_file_url": s.proof_file_url,
        "proof_file_name": s.proof_file_name,
        "proof_file_size": s.proof_file_size,
        "notes": s.notes,
        "status": s.status,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        "verified_at": s.verified_at.isoformat() if s.verified_at else None,
        "verified_by": s.verified_by,
        "rejection_reason": s.rejection_reason,
        "applied_plan_id": subscription.plan_id if subscription else None,
        "subscription_status": subscription.status if subscription else None,
        "subscription": _serialize_subscription(subscription),
        "activation_summary": _activation_summary(activation),
    }


class PaymentVerifyRequest(BaseModel):
    notes: str = ""


@router.post("/api/admin/payments/{payment_id}/verify")
def admin_verify_payment(
    payment_id: str,
    req: PaymentVerifyRequest = PaymentVerifyRequest(),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    admin_id, admin_email = _check_admin(authorization)

    s = db.query(ManualPaymentSubmission).filter(ManualPaymentSubmission.id == payment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")
    if s.status == "verified":
        raise HTTPException(status_code=409, detail="Paiement deja valide.")
    if s.status != "submitted":
        raise HTTPException(status_code=400, detail="Seuls les paiements soumis peuvent etre verifies.")

    target_plan_id = str(s.selected_plan_id or "").strip().lower()
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.id == target_plan_id,
        SubscriptionPlan.is_active == "true",
    ).first()
    if not plan:
        raise HTTPException(status_code=400, detail="Plan cible invalide pour cette verification.")

    s.status = "verified"
    s.verified_at = datetime.utcnow()
    s.verified_by = admin_email

    # Upgrade user plan
    target_user_id = s.user_id
    if not target_user_id and s.activation_request_id:
        ar_target = db.query(ActivationRequest).filter(ActivationRequest.id == s.activation_request_id).first()
        if ar_target:
            target_user_id = ar_target.user_id or ar_target.requester_user_id
            if not s.user_id and target_user_id:
                s.user_id = target_user_id
    if not target_user_id:
        raise HTTPException(status_code=400, detail="Paiement sans utilisateur cible.")
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == target_user_id).first()
    if not sub:
        sub = UserSubscription(
            user_id=target_user_id,
            plan_id=target_plan_id,
            status="active",
        )
        db.add(sub)
    else:
        sub.plan_id = target_plan_id
        sub.status = "active"
    sub.updated_at = datetime.utcnow()
    logger.info(f"[activation] Plan upgraded to {target_plan_id} for {target_user_id}")

    # Update activation request if linked
    activation_payload: Optional[Dict[str, Any]] = None
    if s.activation_request_id:
        ar = db.query(ActivationRequest).filter(ActivationRequest.id == s.activation_request_id).first()
        if ar:
            ar.selected_plan_id = target_plan_id
            ar.payment_status = "verified"
            ar.payment_verified_at = datetime.utcnow()
            if ar.status == "payment_submitted":
                if ar.flare_page_admin_confirmed == "true":
                    ar.status = "queued_for_activation"
                else:
                    ar.status = "awaiting_flare_page_admin_access"
            _add_event(db, ar.id, "payment_verified", "admin", admin_email, {
                "submission_id": s.id,
                "plan": target_plan_id,
                "notes": req.notes.strip(),
            })
            activation_payload = {
                "id": ar.id,
                "payment_status": ar.payment_status,
                "status": ar.status,
                "selected_plan_id": ar.selected_plan_id,
            }

    db.commit()
    logger.info(f"[activation] Payment verified: {s.id} by {admin_email}")
    return {
        "payment": {
            "id": s.id,
            "status": s.status,
            "selected_plan_id": target_plan_id,
            "verified_at": s.verified_at.isoformat() if s.verified_at else None,
            "verified_by": s.verified_by,
            "applied_plan_id": sub.plan_id,
            "subscription_status": sub.status,
        },
        "activation_request": activation_payload,
        "subscription": _serialize_subscription(sub),
    }


class PaymentRejectRequest(BaseModel):
    reason: str


@router.post("/api/admin/payments/{payment_id}/reject")
def admin_reject_payment(
    payment_id: str,
    req: PaymentRejectRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    admin_id, admin_email = _check_admin(authorization)

    s = db.query(ManualPaymentSubmission).filter(ManualPaymentSubmission.id == payment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")
    if s.status == "verified":
        raise HTTPException(status_code=409, detail="Impossible de refuser un paiement deja valide.")

    s.status = "rejected"
    s.rejection_reason = req.reason
    s.verified_at = datetime.utcnow()
    s.verified_by = admin_email

    if s.activation_request_id:
        ar = db.query(ActivationRequest).filter(ActivationRequest.id == s.activation_request_id).first()
        if ar:
            ar.payment_status = "rejected"
            _add_event(db, ar.id, "payment_rejected", "admin", admin_email, {
                "submission_id": s.id,
                "reason": req.reason,
            })

    db.commit()
    logger.info(f"[activation] Payment rejected: {s.id} by {admin_email} — {req.reason}")
    return {"status": "rejected", "id": s.id}


# ── Admin: activations ────────────────────────────────────────────────────────


@router.get("/api/admin/activations")
def admin_list_activations(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)

    requests = db.query(ActivationRequest).order_by(
        ActivationRequest.created_at.desc()
    ).limit(200).all()
    user_ids = {
        str(ar.user_id or ar.requester_user_id or "").strip()
        for ar in requests
        if str(ar.user_id or ar.requester_user_id or "").strip()
    }
    subscription_map: Dict[str, UserSubscription] = {}
    if user_ids:
        subscriptions = db.query(UserSubscription).filter(UserSubscription.user_id.in_(list(user_ids))).all()
        subscription_map = {sub.user_id: sub for sub in subscriptions}

    return {
        "activations": [
            _serialize_activation_request(
                ar,
                subscription=subscription_map.get(str(ar.user_id or ar.requester_user_id or "").strip()),
            )
            for ar in requests
        ]
    }


@router.get("/api/admin/activations/{request_id}")
def admin_get_activation(
    request_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)

    ar = db.query(ActivationRequest).filter(ActivationRequest.id == request_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    events = db.query(ActivationRequestEvent).filter(
        ActivationRequestEvent.activation_request_id == request_id
    ).order_by(ActivationRequestEvent.created_at.asc()).all()

    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == (ar.user_id or ar.requester_user_id)
    ).first()
    data = _serialize_activation_request(ar, subscription=subscription)
    data["events"] = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "actor_type": e.actor_type,
            "actor_id": e.actor_id,
            "payload": e.payload_json,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]

    # Include linked payment
    payment = db.query(ManualPaymentSubmission).filter(
        ManualPaymentSubmission.activation_request_id == request_id
    ).order_by(ManualPaymentSubmission.created_at.desc()).first()
    if payment:
        data["payment"] = {
            "id": payment.id,
            "method_code": payment.method_code,
            "amount": payment.amount,
            "transaction_reference": payment.transaction_reference,
            "proof_file_url": payment.proof_file_url,
            "status": payment.status,
            "payer_full_name": payment.payer_full_name,
            "payer_phone": payment.payer_phone,
            "selected_plan_id": payment.selected_plan_id,
            "applied_plan_id": subscription.plan_id if subscription else None,
            "subscription_status": subscription.status if subscription else None,
        }

    return data


class ActivationAssignRequest(BaseModel):
    operator_email: Optional[str] = None


@router.post("/api/admin/activations/{request_id}/assign")
def admin_assign_activation(
    request_id: str,
    req: ActivationAssignRequest = ActivationAssignRequest(),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    admin_id, admin_email = _check_admin(authorization)

    ar = db.query(ActivationRequest).filter(ActivationRequest.id == request_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    ar.assigned_operator_email = req.operator_email or admin_email
    _add_event(db, ar.id, "activation_assigned", "admin", admin_email, {"operator": ar.assigned_operator_email})
    db.commit()

    return {"status": "assigned", "operator": ar.assigned_operator_email}


class ActivationSetStatusRequest(BaseModel):
    status: str
    reason: Optional[str] = None


# Valid transitions
VALID_TRANSITIONS: Dict[str, set] = {
    "draft": {"awaiting_payment", "canceled"},
    "awaiting_payment": {"payment_submitted", "canceled"},
    "payment_submitted": {"rejected", "canceled"},
    "payment_verified": {"awaiting_flare_page_admin_access", "queued_for_activation", "blocked", "canceled"},
    "awaiting_flare_page_admin_access": {"queued_for_activation", "blocked", "canceled"},
    "queued_for_activation": {"activation_in_progress", "blocked", "canceled"},
    "activation_in_progress": {"testing", "blocked", "canceled"},
    "testing": {"active", "activation_in_progress", "blocked", "canceled"},
    "blocked": {"queued_for_activation", "activation_in_progress", "canceled"},
}


@router.post("/api/admin/activations/{request_id}/set-status")
def admin_set_activation_status(
    request_id: str,
    req: ActivationSetStatusRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    admin_id, admin_email = _check_admin(authorization)

    ar = db.query(ActivationRequest).filter(ActivationRequest.id == request_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    allowed = VALID_TRANSITIONS.get(ar.status, set())
    if req.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Transition invalide: {ar.status} → {req.status}")

    # Additional checks
    if req.status == "payment_verified":
        raise HTTPException(status_code=400, detail="Utilisez la validation de paiement pour confirmer un paiement.")

    if req.status in {"awaiting_flare_page_admin_access", "queued_for_activation", "activation_in_progress", "testing", "active"} and ar.payment_status != "verified":
        raise HTTPException(status_code=400, detail="Le paiement doit etre verifie avant de poursuivre l'activation.")

    if req.status in {"queued_for_activation", "activation_in_progress", "testing", "active"} and ar.flare_page_admin_confirmed != "true":
        raise HTTPException(status_code=400, detail="L'acces admin FLARE a la page doit etre confirme avant de poursuivre.")

    if req.status == "active" and not ar.tested_at:
        raise HTTPException(status_code=400, detail="Le test Messenger doit etre valide avant de marquer actif.")

    if req.status == "blocked" and not req.reason:
        raise HTTPException(status_code=400, detail="Une raison est requise pour bloquer une demande.")

    old_status = ar.status
    ar.status = req.status

    if req.status == "blocked":
        ar.blocked_reason = req.reason

    if req.status == "activation_in_progress":
        ar.activation_started_at = datetime.utcnow()

    if req.status == "testing":
        ar.tested_at = datetime.utcnow()

    if req.status == "active":
        ar.completed_at = datetime.utcnow()

    _add_event(db, ar.id, f"status_{req.status}", "admin", admin_email, {
        "from": old_status,
        "to": req.status,
        "reason": req.reason,
    })
    db.commit()

    logger.info(f"[activation] Status change: {ar.id} {old_status} → {req.status} by {admin_email}")
    return {"status": req.status, "id": ar.id}


class ActivationNoteRequest(BaseModel):
    note: str


@router.post("/api/admin/activations/{request_id}/add-note")
def admin_add_note(
    request_id: str,
    req: ActivationNoteRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    admin_id, admin_email = _check_admin(authorization)

    ar = db.query(ActivationRequest).filter(ActivationRequest.id == request_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    existing = ar.internal_notes or ""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    ar.internal_notes = f"{existing}\n[{timestamp}] {admin_email}: {req.note}".strip()
    _add_event(db, ar.id, "note_added", "admin", admin_email, {"note": req.note})
    db.commit()

    return {"status": "ok"}
class UserReportPayload(BaseModel):
    category: str = "other"
    priority: str = ""
    severity: str = "medium"
    subject: str = ""
    title: str = ""
    message: str = ""
    details: str = ""
    description: str = ""
    screen_source: str = ""
    page_context: str = ""
    current_view: str = ""
    preferred_contact: str = "email"
    expected_behavior: str = ""
    contact_detail: str = ""
    contact_email: str = ""
    contact_phone: str = ""


@router.post("/api/reports")
def create_user_report(
    req: UserReportPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = get_user_identity(authorization)

    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")
    preferred_contact = (req.preferred_contact or ("phone" if req.contact_phone.strip() else "email")).strip().lower()
    normalized_title = (req.subject or req.title or "").strip()
    normalized_description = (req.message or req.details or req.description or "").strip()
    normalized_view = (req.screen_source or req.page_context or req.current_view or "").strip()
    normalized_contact_email = (req.contact_email or "").strip()
    normalized_contact_phone = (req.contact_phone or req.contact_detail or "").strip()
    normalized_severity = (req.priority or req.severity or "normal").strip().lower()
    if normalized_severity == "high":
        normalized_severity = "critical"
    if normalized_severity in {"low", "normal", "medium", "critical"}:
        severity = normalized_severity
    else:
        severity = "normal"

    report = UserReport(
        organization_slug=user_id,
        organization_scope_id=user_id,
        user_id=user_id,
        reporter_user_id=user_id,
        reporter_email=user_email,
        current_view=normalized_view,
        category=(req.category or "other").strip().lower(),
        severity=severity,
        title=normalized_title,
        description=normalized_description,
        expected_behavior=req.expected_behavior.strip(),
        contact_email=(normalized_contact_email or user_email) if preferred_contact == "email" else "",
        contact_phone=normalized_contact_phone if preferred_contact in {"phone", "whatsapp"} else "",
        status="new",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    logger.info(f"[reports] Report created: {report.id} by {user_email} ({user_id})")
    return {"report": _serialize_report(report)}


@router.get("/api/reports/me")
def get_my_reports(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _, user_email = get_user_identity(authorization)
    reports = db.query(UserReport).filter(
        UserReport.reporter_email == user_email,
    ).order_by(UserReport.created_at.desc()).limit(100).all()
    return {"reports": [_serialize_report(report) for report in reports]}


class AdminUpdateReportRequest(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None


@router.get("/api/admin/reports")
def admin_list_reports(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)
    reports = db.query(UserReport).order_by(UserReport.created_at.desc()).limit(200).all()
    return {"reports": [_serialize_report(report) for report in reports]}


@router.patch("/api/admin/reports/{report_id}")
def admin_update_report(
    report_id: str,
    req: AdminUpdateReportRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _, admin_email = _check_admin(authorization)

    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Signalement introuvable.")

    if req.status:
        next_status = req.status.strip().lower()
        if next_status not in REPORT_STATUSES:
            raise HTTPException(status_code=400, detail="Statut de signalement invalide.")
        report.status = next_status
        if next_status in {"resolved", "dismissed"}:
            report.resolved_at = datetime.utcnow()
            report.resolved_by = admin_email
        else:
            report.resolved_at = None
            report.resolved_by = None

    if req.admin_note is not None:
        report.admin_notes = req.admin_note.strip()

    db.commit()
    db.refresh(report)
    return {"report": _serialize_report(report)}


# ── Chatbot orders (client) ──────────────────────────────────────────────────


class CreateOrderRequest(BaseModel):
    facebook_page_id: Optional[str] = None
    page_name: str = ""
    contact_psid: str = ""
    contact_name: str = ""
    contact_phone: str = ""
    contact_email: str = ""
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    product_summary: str = ""
    quantity_text: str = ""
    amount_text: str = ""
    delivery_address: str = ""
    customer_request_text: str = ""
    source: str = "manual"


@router.get("/api/chatbot/orders")
def get_my_orders(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    orders = db.query(ChatbotOrder).filter(
        or_(
            ChatbotOrder.user_id == user_id,
            ChatbotOrder.organization_scope_id == scope_id,
        ),
    ).order_by(ChatbotOrder.created_at.desc()).limit(200).all()

    return {"orders": [_serialize_order(o) for o in orders]}


@router.post("/api/chatbot/orders")
def create_order(
    req: CreateOrderRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    order = ChatbotOrder(
        organization_slug=user_id,
        organization_scope_id=scope_id,
        user_id=user_id,
        facebook_page_id=req.facebook_page_id,
        page_name=req.page_name,
        contact_psid=req.contact_psid,
        contact_name=req.contact_name,
        contact_phone=req.contact_phone,
        contact_email=req.contact_email,
        source_conversation_id=req.source_conversation_id,
        source_message_id=req.source_message_id,
        product_summary=req.product_summary,
        quantity_text=req.quantity_text,
        amount_text=req.amount_text,
        delivery_address=req.delivery_address,
        customer_request_text=req.customer_request_text,
        source=req.source if req.source in ("signal", "manual") else "manual",
        status="detected",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    logger.info(f"[orders] Order created: {order.id} for {user_id}")
    return {"order": _serialize_order(order)}


class UpdateOrderRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    needs_human_followup: Optional[str] = None


@router.patch("/api/chatbot/orders/{order_id}")
def update_order(
    order_id: str,
    req: UpdateOrderRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email = _get_user_context(authorization)
    scope_id = user_id

    order = db.query(ChatbotOrder).filter(
        ChatbotOrder.id == order_id,
        or_(
            ChatbotOrder.user_id == user_id,
            ChatbotOrder.organization_scope_id == scope_id,
        ),
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")

    if req.status and req.status in ("detected", "contacted", "confirmed", "fulfilled", "canceled"):
        order.status = req.status
    if req.assigned_to is not None:
        order.assigned_to = req.assigned_to
    if req.needs_human_followup is not None:
        order.needs_human_followup = req.needs_human_followup

    db.commit()
    db.refresh(order)
    return {"order": _serialize_order(order)}


# ── Admin: orders ─────────────────────────────────────────────────────────────


@router.get("/api/admin/orders")
def admin_list_orders(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)

    orders = db.query(ChatbotOrder).order_by(
        ChatbotOrder.created_at.desc()
    ).limit(200).all()

    return {"orders": [_serialize_order(o) for o in orders]}


@router.get("/api/admin/orders/{order_id}")
def admin_get_order(
    order_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_admin(authorization)

    order = db.query(ChatbotOrder).filter(ChatbotOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    return _serialize_order(order)


@router.patch("/api/admin/orders/{order_id}")
def admin_update_order(
    order_id: str,
    req: UpdateOrderRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    admin_id, admin_email = _check_admin(authorization)

    order = db.query(ChatbotOrder).filter(ChatbotOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")

    if req.status and req.status in ("detected", "contacted", "confirmed", "fulfilled", "canceled"):
        order.status = req.status
    if req.assigned_to is not None:
        order.assigned_to = req.assigned_to
    if req.needs_human_followup is not None:
        order.needs_human_followup = req.needs_human_followup

    db.commit()
    db.refresh(order)
    return {"order": _serialize_order(order)}






# ── Serializers ───────────────────────────────────────────────────────────────


def _serialize_activation_request(
    ar: ActivationRequest,
    subscription: Optional[UserSubscription] = None,
) -> Dict[str, Any]:
    selected_pages = _decode_facebook_pages_context(ar.selected_facebook_pages_json)
    return {
        "id": ar.id,
        "user_id": ar.user_id or ar.requester_user_id,
        "requester_user_id": ar.requester_user_id,
        "selected_plan_id": ar.selected_plan_id,
        "status": ar.status,
        "payment_status": ar.payment_status,
        "contact_full_name": ar.contact_full_name,
        "contact_email": ar.contact_email,
        "contact_phone": ar.contact_phone,
        "contact_whatsapp": ar.contact_whatsapp,
        "business_name": ar.business_name,
        "business_sector": ar.business_sector,
        "business_city": ar.business_city,
        "business_country": ar.business_country,
        "business_description": ar.business_description,
        "selected_facebook_pages": selected_pages,
        "selected_facebook_pages_snapshot": selected_pages,
        "selected_facebook_pages_count": len(selected_pages),
        "flare_selected_page_id_at_submission": ar.flare_selected_page_id_at_submission,
        "flare_selected_page_name_at_submission": ar.flare_selected_page_name_at_submission,
        "activation_target_page_id": ar.activation_target_page_id,
        "activation_target_page_name": ar.activation_target_page_name,
        "facebook_page_name": ar.facebook_page_name,
        "facebook_page_url": ar.facebook_page_url,
        "facebook_admin_email": ar.facebook_admin_email,
        "primary_language": ar.primary_language,
        "bot_name": ar.bot_name,
        "tone": ar.tone,
        "greeting_message": ar.greeting_message,
        "offer_summary": ar.offer_summary,
        "opening_hours": ar.opening_hours,
        "delivery_zones": ar.delivery_zones,
        "notes_for_flare": ar.notes_for_flare,
        "flare_page_admin_confirmed": ar.flare_page_admin_confirmed,
        "flare_page_admin_confirmed_at": ar.flare_page_admin_confirmed_at.isoformat() if ar.flare_page_admin_confirmed_at else None,
        "flare_page_admin_confirmed_by": ar.flare_page_admin_confirmed_by,
        "assigned_operator_email": ar.assigned_operator_email,
        "internal_notes": ar.internal_notes,
        "blocked_reason": ar.blocked_reason,
        "applied_plan_id": subscription.plan_id if subscription else None,
        "subscription_status": subscription.status if subscription else None,
        "subscription_updated_at": subscription.updated_at.isoformat() if subscription and subscription.updated_at else None,
        "requested_at": ar.requested_at.isoformat() if ar.requested_at else None,
        "payment_verified_at": ar.payment_verified_at.isoformat() if ar.payment_verified_at else None,
        "activation_started_at": ar.activation_started_at.isoformat() if ar.activation_started_at else None,
        "tested_at": ar.tested_at.isoformat() if ar.tested_at else None,
        "completed_at": ar.completed_at.isoformat() if ar.completed_at else None,
        "created_at": ar.created_at.isoformat() if ar.created_at else None,
        "updated_at": ar.updated_at.isoformat() if ar.updated_at else None,
    }


def _serialize_report(report: UserReport) -> Dict[str, Any]:
    preferred_contact = "email" if report.contact_email else ("phone" if report.contact_phone else "email")
    normalized_priority = report.severity or "normal"
    if normalized_priority == "critical":
        normalized_priority = "high"
    return {
        "id": report.id,
        "user_id": report.user_id or report.reporter_user_id,
        "reporter_user_id": report.reporter_user_id,
        "reporter_email": report.reporter_email,
        "user_email": report.reporter_email,
        "current_view": report.current_view,
        "screen_source": report.current_view,
        "page_context": report.current_view,
        "category": report.category,
        "severity": report.severity,
        "priority": normalized_priority,
        "title": report.title,
        "subject": report.title,
        "description": report.description,
        "details": report.description,
        "message": report.description,
        "expected_behavior": report.expected_behavior,
        "contact_email": report.contact_email,
        "contact_phone": report.contact_phone,
        "preferred_contact": preferred_contact,
        "screenshot_url": report.screenshot_url,
        "status": report.status,
        "admin_notes": report.admin_notes,
        "admin_note": report.admin_notes,
        "resolved_by": report.resolved_by,
        "resolved_at": report.resolved_at.isoformat() if report.resolved_at else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


def _serialize_order(o: ChatbotOrder) -> Dict[str, Any]:
    return {
        "id": o.id,
        "user_id": o.user_id,
        "facebook_page_id": o.facebook_page_id,
        "page_name": o.page_name,
        "contact_psid": o.contact_psid,
        "contact_name": o.contact_name,
        "contact_phone": o.contact_phone,
        "contact_email": o.contact_email,
        "source_conversation_id": o.source_conversation_id,
        "product_summary": o.product_summary,
        "quantity_text": o.quantity_text,
        "amount_text": o.amount_text,
        "delivery_address": o.delivery_address,
        "customer_request_text": o.customer_request_text,
        "confidence": o.confidence,
        "source": o.source,
        "status": o.status,
        "needs_human_followup": o.needs_human_followup,
        "assigned_to": o.assigned_to,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }




