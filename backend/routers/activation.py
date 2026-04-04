"""
Router Activation — Activation assistee, paiement manuel, commandes chatbot.
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
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
    UserSubscription,
    get_db,
)
from core.organizations import (
    get_organization,
    organization_scope_id,
    user_can_access_organization,
    user_can_edit_organization,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["activation"])

# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_active_scope(authorization: Optional[str]) -> tuple[str, str, str, dict]:
    """Return (user_id, user_email, org_slug, organization) or raise."""
    scoped_user_id = get_user_id_from_header(authorization)
    user_email = get_user_email_from_header(authorization).strip().lower()

    if scoped_user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    if not scoped_user_id.startswith("org:"):
        raise HTTPException(status_code=400, detail="Selectionnez d'abord une organisation active.")

    org_slug = scoped_user_id.split(":", 1)[1].strip().lower()
    organization = get_organization(org_slug)
    if not organization or not user_can_access_organization(user_email, org_slug):
        raise HTTPException(status_code=404, detail="Organisation introuvable ou inaccessible.")

    return scoped_user_id, user_email, org_slug, organization


def _require_edit_permission(user_email: str, org_slug: str) -> None:
    if not user_can_edit_organization(user_email, org_slug):
        raise HTTPException(status_code=403, detail="Seuls le proprietaire ou un admin peuvent effectuer cette action.")


def _check_admin(authorization: Optional[str]) -> tuple[str, str]:
    user_id, user_email = get_user_identity(authorization)
    admin_emails = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",")]
    if user_email.lower() not in admin_emails:
        raise HTTPException(status_code=403, detail="Acces admin requis.")
    return user_id, user_email


def _add_event(db: Session, request_id: str, event_type: str, actor_type: str, actor_id: str, payload: Optional[dict] = None) -> None:
    db.add(ActivationRequestEvent(
        activation_request_id=request_id,
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        payload_json=payload or {},
    ))


def _get_manual_payment_methods() -> List[Dict[str, Any]]:
    raw = (settings.MANUAL_PAYMENT_METHODS_JSON or "").strip()
    if not raw:
        return []
    try:
        methods = json.loads(raw)
        if not isinstance(methods, list):
            return []
        return [m for m in methods if isinstance(m, dict) and m.get("enabled")]
    except Exception:
        return []


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
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    _require_edit_permission(user_email, org_slug)

    scope_id = organization_scope_id(org_slug)

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
        organization_slug=org_slug,
        organization_scope_id=scope_id,
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
        if ar and ar.organization_slug == org_slug:
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

    logger.info(f"[activation] Payment submitted: {submission.id} by {user_email} for {org_slug}")
    return {"id": submission.id, "status": submission.status}


@router.get("/api/billing/manual-payments/me")
def get_my_manual_payments(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    scope_id = organization_scope_id(org_slug)

    submissions = db.query(ManualPaymentSubmission).filter(
        ManualPaymentSubmission.organization_scope_id == scope_id,
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
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    scope_id = organization_scope_id(org_slug)

    ar = db.query(ActivationRequest).filter(
        ActivationRequest.organization_scope_id == scope_id,
        ~ActivationRequest.status.in_(ACTIVATION_TERMINAL_STATUSES - {"active"}),
    ).order_by(ActivationRequest.created_at.desc()).first()

    if not ar:
        return {"activation_request": None}

    return {"activation_request": _serialize_activation_request(ar)}


@router.post("/api/chatbot/activation-request")
def create_activation_request(
    req: ActivationRequestPayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    _require_edit_permission(user_email, org_slug)
    scope_id = organization_scope_id(org_slug)

    # Only one non-terminal request per org
    existing = db.query(ActivationRequest).filter(
        ActivationRequest.organization_scope_id == scope_id,
        ~ActivationRequest.status.in_(ACTIVATION_TERMINAL_STATUSES),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Une demande d'activation est deja en cours pour cet espace.")

    ar = ActivationRequest(
        organization_slug=org_slug,
        organization_scope_id=scope_id,
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
        facebook_page_name=req.facebook_page_name,
        facebook_page_url=req.facebook_page_url,
        facebook_admin_email=req.facebook_admin_email,
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

    _add_event(db, ar.id, "request_created", "client", user_email, {"plan": req.selected_plan_id})

    # Initialize chatbot preferences from the form data
    prefs = db.query(ChatbotPreferences).filter(
        ChatbotPreferences.organization_slug == org_slug,
        ChatbotPreferences.page_id.is_(None),
    ).first()
    if not prefs:
        prefs = ChatbotPreferences(organization_slug=org_slug)
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

    logger.info(f"[activation] Request created: {ar.id} for {org_slug} by {user_email}")
    return {"activation_request": _serialize_activation_request(ar)}


@router.patch("/api/chatbot/activation-request")
def update_activation_request(
    updates: Dict[str, Any],
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    _require_edit_permission(user_email, org_slug)
    scope_id = organization_scope_id(org_slug)

    ar = db.query(ActivationRequest).filter(
        ActivationRequest.organization_scope_id == scope_id,
        ~ActivationRequest.status.in_(ACTIVATION_TERMINAL_STATUSES),
    ).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Aucune demande d'activation en cours.")

    # Client-updatable fields
    allowed_fields = {
        "contact_full_name", "contact_email", "contact_phone", "contact_whatsapp",
        "business_name", "business_sector", "business_city", "business_country", "business_description",
        "facebook_page_name", "facebook_page_url", "facebook_admin_email",
        "primary_language", "bot_name", "tone", "greeting_message",
        "offer_summary", "opening_hours", "delivery_zones", "notes_for_flare",
    }

    for key, value in updates.items():
        if key in allowed_fields and hasattr(ar, key):
            setattr(ar, key, value)

    # Handle FLARE page admin confirmation
    if updates.get("flare_page_admin_confirmed") == "true" and ar.flare_page_admin_confirmed != "true":
        ar.flare_page_admin_confirmed = "true"
        ar.flare_page_admin_confirmed_at = datetime.utcnow()
        _add_event(db, ar.id, "fb_access_confirmed", "client", user_email)

        # Auto-advance status if payment is verified
        if ar.status == "awaiting_flare_page_admin_access":
            ar.status = "queued_for_activation"

    db.commit()
    db.refresh(ar)
    return {"activation_request": _serialize_activation_request(ar)}


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

    return {
        "payments": [
            {
                "id": s.id,
                "organization_slug": s.organization_slug,
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
            }
            for s in submissions
        ]
    }


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
    return {
        "id": s.id,
        "organization_slug": s.organization_slug,
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

    s.status = "verified"
    s.verified_at = datetime.utcnow()
    s.verified_by = admin_email

    # Upgrade org plan
    scope_id = s.organization_scope_id
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == scope_id).first()
    if sub:
        sub.plan_id = s.selected_plan_id
        sub.status = "active"
        logger.info(f"[activation] Plan upgraded to {s.selected_plan_id} for {scope_id}")

    # Update activation request if linked
    if s.activation_request_id:
        ar = db.query(ActivationRequest).filter(ActivationRequest.id == s.activation_request_id).first()
        if ar:
            ar.payment_status = "verified"
            ar.payment_verified_at = datetime.utcnow()
            if ar.status == "payment_submitted":
                if ar.flare_page_admin_confirmed == "true":
                    ar.status = "queued_for_activation"
                else:
                    ar.status = "awaiting_flare_page_admin_access"
            _add_event(db, ar.id, "payment_verified", "admin", admin_email, {
                "submission_id": s.id,
                "plan": s.selected_plan_id,
            })

    db.commit()
    logger.info(f"[activation] Payment verified: {s.id} by {admin_email}")
    return {"status": "verified", "id": s.id}


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

    return {"activations": [_serialize_activation_request(ar) for ar in requests]}


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

    data = _serialize_activation_request(ar)
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
    "payment_submitted": {"payment_verified", "rejected", "canceled"},
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
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    scope_id = organization_scope_id(org_slug)

    orders = db.query(ChatbotOrder).filter(
        ChatbotOrder.organization_scope_id == scope_id,
    ).order_by(ChatbotOrder.created_at.desc()).limit(200).all()

    return {"orders": [_serialize_order(o) for o in orders]}


@router.post("/api/chatbot/orders")
def create_order(
    req: CreateOrderRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    _require_edit_permission(user_email, org_slug)
    scope_id = organization_scope_id(org_slug)

    order = ChatbotOrder(
        organization_slug=org_slug,
        organization_scope_id=scope_id,
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

    logger.info(f"[orders] Order created: {order.id} for {org_slug}")
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
    user_id, user_email, org_slug, organization = _get_active_scope(authorization)
    _require_edit_permission(user_email, org_slug)
    scope_id = organization_scope_id(org_slug)

    order = db.query(ChatbotOrder).filter(
        ChatbotOrder.id == order_id,
        ChatbotOrder.organization_scope_id == scope_id,
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


def _serialize_activation_request(ar: ActivationRequest) -> Dict[str, Any]:
    return {
        "id": ar.id,
        "organization_slug": ar.organization_slug,
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
        "assigned_operator_email": ar.assigned_operator_email,
        "internal_notes": ar.internal_notes,
        "blocked_reason": ar.blocked_reason,
        "requested_at": ar.requested_at.isoformat() if ar.requested_at else None,
        "payment_verified_at": ar.payment_verified_at.isoformat() if ar.payment_verified_at else None,
        "activation_started_at": ar.activation_started_at.isoformat() if ar.activation_started_at else None,
        "tested_at": ar.tested_at.isoformat() if ar.tested_at else None,
        "completed_at": ar.completed_at.isoformat() if ar.completed_at else None,
        "created_at": ar.created_at.isoformat() if ar.created_at else None,
        "updated_at": ar.updated_at.isoformat() if ar.updated_at else None,
    }


def _serialize_order(o: ChatbotOrder) -> Dict[str, Any]:
    return {
        "id": o.id,
        "organization_slug": o.organization_slug,
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
