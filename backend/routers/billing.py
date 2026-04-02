"""
Router Billing — Gestion des paiements et abonnements via Stripe.
"""
import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db, UserSubscription, SubscriptionPlan
from core.auth import get_user_id_from_header
from core.config import settings

# Configuration de la clé API Stripe au démarrage
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

class CreateCheckoutSessionRequest(BaseModel):
    plan_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    return_url: Optional[str] = None


class CreatePortalSessionRequest(BaseModel):
    return_url: Optional[str] = None

@router.post("/create-checkout-session")
def create_checkout_session(
    req: CreateCheckoutSessionRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Crée une session de paiement Stripe pour un utilisateur authentifié."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe n'est pas configuré.")

    # Récupérer le plan depuis notre DB pour s'assurer qu'il est valide
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
    stripe_price_id = getattr(plan, "stripe_price_id", None) if plan else None
    if not plan or not stripe_price_id:
        raise HTTPException(status_code=404, detail="Plan non valide ou non configurable pour Stripe.")

    fallback_url = req.return_url or settings.FRONTEND_URL
    success_url = req.success_url or fallback_url
    cancel_url = req.cancel_url or fallback_url

    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    'price': stripe_price_id,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            # Associer la session à notre utilisateur interne
            client_reference_id=user_id,
            subscription_data={
                "metadata": {
                    "user_id": user_id
                }
            }
        )
        return {"sessionId": checkout_session.id, "url": checkout_session.url}
    except Exception as e:
        logger.error(f"Erreur Stripe Checkout: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de la session de paiement: {e}")

@router.post("/create-portal-session")
def create_portal_session(
    req: CreatePortalSessionRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Crée une session de portail client Stripe pour gérer l'abonnement."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe n'est pas configuré.")
    
    user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    if not user_subscription or not user_subscription.stripe_customer_id:
        raise HTTPException(status_code=404, detail="Abonnement Stripe non trouvé pour cet utilisateur.")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=user_subscription.stripe_customer_id,
            return_url=req.return_url or settings.FRONTEND_URL,
        )
        return {"url": portal_session.url}
    except Exception as e:
        logger.error(f"Erreur Stripe Portal: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création du portail client.")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Webhook pour recevoir les événements de Stripe."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET n'est pas configuré.")
        raise HTTPException(status_code=500, detail="Webhook Stripe non configuré.")

    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=sig_header, secret=settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e: # Invalid payload
        logger.error(f"Webhook Stripe - Payload invalide: {e}")
        raise HTTPException(status_code=400, detail="Payload invalide")
    except stripe.error.SignatureVerificationError as e: # Invalid signature
        logger.error(f"Webhook Stripe - Signature invalide: {e}")
        raise HTTPException(status_code=400, detail="Signature invalide")

    # Gérer l'événement
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id')
        stripe_subscription_id = session.get('subscription')
        stripe_customer_id = session.get('customer')
        
        if not user_id:
            logger.error("Webhook 'checkout.session.completed' reçu sans user_id (client_reference_id).")
            return {"status": "error", "message": "User ID manquant"}

        # Mettre à jour l'abonnement de l'utilisateur dans notre base de données
        user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
        if not user_subscription:
            logger.error(f"UserSubscription non trouvé pour user_id {user_id} lors du webhook.")
            return {"status": "error", "message": "Abonnement utilisateur non trouvé"}
        
        # Récupérer les détails de l'abonnement pour connaître le plan
        stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
        stripe_price_id = stripe_sub['items']['data'][0]['price']['id']
        
        # Trouver le plan correspondant dans notre DB
        new_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.stripe_price_id == stripe_price_id).first()
        if not new_plan:
            logger.error(f"Plan non trouvé pour stripe_price_id {stripe_price_id}.")
            return {"status": "error", "message": "Plan non trouvé"}
        
        # Mettre à jour la souscription de l'utilisateur
        user_subscription.plan_id = new_plan.id
        user_subscription.stripe_customer_id = stripe_customer_id
        user_subscription.stripe_subscription_id = stripe_subscription_id
        user_subscription.status = 'active'
        db.commit()
        
        logger.info(f"Abonnement mis à jour pour l'utilisateur {user_id} vers le plan {new_plan.name}.")

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        stripe_customer_id = subscription.get('customer')

        if not stripe_customer_id:
            logger.error("Webhook 'customer.subscription.deleted' reçu sans customer_id.")
            return {"status": "error", "message": "Customer ID manquant"}
        
        user_subscription = db.query(UserSubscription).filter(UserSubscription.stripe_customer_id == stripe_customer_id).first()
        if not user_subscription:
            logger.error(f"UserSubscription non trouvé pour stripe_customer_id {stripe_customer_id} lors de l'annulation.")
            return {"status": "error", "message": "Abonnement utilisateur non trouvé pour annulation"}
        
        # Rétrograder l'utilisateur au plan 'free'
        user_subscription.plan_id = 'free'
        user_subscription.status = 'canceled'
        # On garde l'ID de l'abonnement et du client pour l'historique
        # user_subscription.stripe_subscription_id = None 
        db.commit()

        logger.info(f"Abonnement annulé pour l'utilisateur {user_subscription.user_id}. Rétrogradation au plan 'free'.")

    return {"status": "success"}
