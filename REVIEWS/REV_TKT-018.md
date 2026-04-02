# CODE REVIEW REQUEST: TKT-018
**Auteur**: BETA
**Date**: 2026-03-21T13:49:22.925Z

## Changements

### NOUVEAU FICHIER : backend/routers/admin.py
```
from typing import Optional, List, Dict, Any
from collections import defaultdict
from fastapi import APIRouter, Header, HTTPException, Depends, Body
from sqlalchemy.orm import Session
import logging

from core.auth import get_user_identity
from core.database import SessionLocal, UsageLedger, UserSubscription, SubscriptionPlan, ConversationFile, Message, Conversation
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ── Normalisation des action_kind vers les labels frontend ──────────────────
ACTION_NORMALIZE = {
    "chat": "message",
    "researcher": "research",
    "deep_research": "deep_research",
    "research": "research",
    "image": "image_gen",
    "video": "video_gen",
    "media": "image_gen",
    "message": "message",
    "image_gen": "image_gen",
    "video_gen": "video_gen",
    "workspace": "message",
}

# ── Normalisation des model_name vers les catégories frontend ───────────────
def normalize_model(name: str) -> str:
    """Regroupe les variantes de modèle en 2 catégories pour le dashboard."""
    if not name:
        return "gemini-3-pro"
    n = name.lower()
    
    # Flash (Vitesse) — toutes les variantes
    if "flash" in n:
        return "gemini-3-flash"
    
    # Pro (Raisonnement)
    if "pro" in n or "gemini-3" in n:
        return "gemini-3-pro"
        
    # Média (image/vidéo) — on les met sous le modèle pro par défaut
    if "imagen" in n or "veo" in n:
        return "gemini-3-pro"
        
    return "gemini-3-pro"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_admin_auth(authorization: Optional[str] = Header(None)):
    """Vérifie que l'utilisateur est dans la liste des administrateurs (ADMIN_EMAILS dans .env)."""
    try:
        user_id, user_email = get_user_identity(authorization)
        admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",")]

        logger.info(f"[Admin] Requête de {user_email} (ID: {user_id})")

        if user_email not in admin_emails:
            logger.warning(f"[Admin] Tentative d'accès refusée pour {user_email}")
            raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur principal.")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin] Erreur auth: {e}")
        raise HTTPException(status_code=401, detail="Session expirée ou invalide.")


def _firebase_email_lookup(uid: str) -> str:
    """Lookup l'email via Firebase Admin SDK pour les UIDs sans email."""
    if not uid or uid == "anonymous" or "default" in uid:
        return ""
    try:
        from firebase_admin import auth as fb_auth
        user_record = fb_auth.get_user(uid)
        email = user_record.email or ""
        if email:
            logger.info(f"[Admin] Email trouvé via Firebase pour {uid}: {email}")
        return email
    except Exception as e:
        logger.error(f"[Admin] Firebase lookup a échoué pour {uid}: {e}", exc_info=True)
        return ""


EMPTY_BREAKDOWN = {"actions": 0, "tokens": 0, "cost": 0.0}
EMPTY_BY_ACTION = {
    "message": {**EMPTY_BREAKDOWN},
    "research": {**EMPTY_BREAKDOWN},
    "deep_research": {**EMPTY_BREAKDOWN},
    "image_gen": {**EMPTY_BREAKDOWN},
    "video_gen": {**EMPTY_BREAKDOWN},
}


@router.post("/sync-users")
async def sync_all_firebase_users(
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """
    Sync global: parcoure TOUS les utilisateurs Firebase et les importe en local.
    C'est l'automatisation 'cherche les et mes' demandée par l'administrateur.
    """
    try:
        from firebase_admin import auth as fb_auth
        from core.database import create_user_subscription
        
        # 1. Lister tous les utilisateurs de Firebase
        users_page = fb_auth.list_users()
        count_synced = 0
        count_created = 0
        
        while users_page:
            for user in users_page.users:
                uid = user.uid
                email = user.email or ""
                
                # Vérifier si l'utilisateur existe déjà
                sub = db.query(UserSubscription).filter(UserSubscription.user_id == uid).first()
                if not sub:
                    # Créer l'abonnement par défaut (Business pour Flare AI)
                    create_user_subscription(user_id=uid, plan_id="business")
                    sub = db.query(UserSubscription).filter(UserSubscription.user_id == uid).first()
                    count_created += 1
                
                # Mettre à jour l'email si nécessaire
                if email and sub.user_email != email:
                    sub.user_email = email
                    count_synced += 1
            
            # Page suivante s'il y en a une
            users_page = users_page.get_next_page()
        
        db.commit()
        logger.info(f"[Admin] Sync globale terminée : {count_created} créés, {count_synced} emails mis à jour.")
        
        return {
            "status": "success",
            "created": count_created,
            "updated": count_synced,
            "message": f"Synchronisation terminée : {count_created} nouveaux utilisateurs trouvés."
        }
    except Exception as e:
        logger.error(f"[Admin] Erreur lors de la sync globale: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-user")
async def create_user_by_admin(
    email: str = Body(...),
    password: str = Body(...),
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """Permet à un admin de créer un nouvel utilisateur directement."""
    try:
        from firebase_admin import auth as fb_auth
        from core.database import create_user_subscription

        try:
            existing = fb_auth.get_user_by_email(email)
            if existing:
                raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà.")
        except fb_auth.UserNotFoundError:
            pass # C'est bon, l'utilisateur n'existe pas

        new_user = fb_auth.create_user(
            email=email,
            password=password,
            email_verified=True
        )
        
        create_user_subscription(user_id=new_user.uid, user_email=email)
        
        logger.info(f"[Admin] L'admin {admin_id} a créé un nouvel utilisateur : {email} (UID: {new_user.uid})")
        return {"message": "Utilisateur créé avec succès", "uid": new_user.uid}
    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"[Admin] Erreur lors de la création de l'utilisateur: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur interne: {e}")


@router.get("/usage/summary")
async def get_usage_summary(
    days: int = 0,
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """Retourne la consommation ventilée par Modèle × Action avec filtrage temporel."""
    try:
        from sqlalchemy import func
        from datetime import datetime, timedelta
        from firebase_admin import auth as fb_auth

        # 1. Source de vérité : lister tous les utilisateurs depuis Firebase Auth
        user_map: Dict[str, dict] = {}
        subs = {s.user_id: s for s in db.query(UserSubscription).all()}
        
        fb_users_page = fb_auth.list_users()
        while fb_users_page:
            for user in fb_users_page.users:
                sub = subs.get(user.uid)
                user_email = ""
                if user and user.email:
                    user_email = user.email
                elif sub and sub.user_email:
                    user_email = sub.user_email

                user_map[user.uid] = {
                    "user_id": user.uid,
                    "email": user_email,
                    "plan": sub.plan_id if sub else "free",
                    "models": {
                        "gemini-3-pro": {"total": {**EMPTY_BREAKDOWN}, "by_action": {k: {**v} for k, v in EMPTY_BY_ACTION.items()}},
                        "gemini-3-flash": {"total": {**EMPTY_BREAKDOWN}, "by_action": {k: {**v} for k, v in EMPTY_BY_ACTION.items()}},
                    },
                    "grand_total": {"tokens": 0, "cost": 0.0},
                    "last_active": None,
                    "last_model": "",
                }
            fb_users_page = fb_users_page.get_next_page()

        logger.info(f"[Admin] {len(user_map)} utilisateurs trouvés dans Firebase Auth.")

        # 2. Récupérer les données d'usage agrégées depuis la DB locale
        query = db.query(
            UsageLedger.user_id,
            UsageLedger.model_name,
            UsageLedger.action_kind,
            func.count(UsageLedger.id).label("action_count"),
            func.sum(UsageLedger.total_tokens).label("total_tokens"),
            func.sum(UsageLedger.cost_usd).label("total_cost"),
            func.max(UsageLedger.timestamp).label("last_active"),
        )
        
        if days > 0:
            since = datetime.utcnow() - timedelta(days=days)
            query = query.filter(UsageLedger.timestamp >= since)
            
        rows = query.group_by(
            UsageLedger.user_id, UsageLedger.model_name, UsageLedger.action_kind
        ).all()

        logger.info(f"[Admin] {len(rows)} groupes d'usage trouvés pour la période.")

        # 3. Fusionner les données d'usage dans la user_map
        for row in rows:
            uid = row.user_id
            if uid not in user_map: 
                continue # Ignorer l'usage pour des utilisateurs qui n'existent plus dans Firebase Auth

            u = user_map[uid]
            model_key = normalize_model(row.model_name)
            action_key = ACTION_NORMALIZE.get(row.action_kind, "message")
            
            # Sécurisation avec .get() pour éviter les KeyError
            model_data = u.get("models", {}).get(model_key)
            if not model_data:
                continue

            actions = int(row.action_count or 0)
            tokens = int(row.total_tokens or 0)
            cost = round(float(row.total_cost or 0.0), 6)
            
            action_summary = model_data.get("by_action", {}).get(action_key)
            if action_summary is not None:
                action_summary["actions"] += actions
                action_summary["tokens"] += tokens
                action_summary["cost"] = round(action_summary["cost"] + cost, 6)
            
            model_data["total"]["actions"] += actions
            model_data["total"]["tokens"] += tokens
            model_data["total"]["cost"] = round(model_data["total"]["cost"] + cost, 6)
            
            u["grand_total"]["tokens"] += tokens
            u["grand_total"]["cost"] = round(u["grand_total"]["cost"] + cost, 6)
            
            ts = row.last_active
            if ts and (u["last_active"] is None or ts > u["last_active"]):
                u["last_active"] = ts
                u["last_model"] = row.model_name or ""

        # 4. Finaliser et trier
        for u in user_map.values():
            if u["last_active"]:
                u["last_active"] = u["last_active"].isoformat()

        users_list = sorted(user_map.values(), key=lambda x: x["grand_total"]["cost"], reverse=True)
        total_cost = round(sum(u["grand_total"]["cost"] for u in users_list), 6)
        
        return {
            "total_users": len(users_list),
            "total_cost": total_cost,
            "users": users_list,
        }
    except Exception as e:
        logger.error(f"[Admin] Erreur Cost Intelligence: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage/ledger")
async def get_usage_ledger(
    limit: int = 100,
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """Retourne les dernières entrées du livre de compte pour audit."""
    try:
        logs = db.query(UsageLedger).order_by(UsageLedger.timestamp.desc()).limit(limit).all()
        
        results = []
        for log in logs:
            results.append({
                "id": log.id,
                "user_email": log.user_email or log.user_id,
                "model": log.model_name,
                "action": ACTION_NORMALIZE.get(log.action_kind, log.action_kind),
                "tokens": log.total_tokens,
                "cost": round(log.cost_usd, 6),
                "timestamp": log.timestamp.isoformat()
            })
            
        return results
    except Exception as e:
        logger.error(f"[Admin] Erreur ledger: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backfill-usage")
async def backfill_usage_from_files(
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """
    Backfill : scanne conversation_files et messages pour créer
    les entrées UsageLedger manquantes (images, vidéos, messages).
    Idempotent — ne crée pas de doublons.
    """
    try:
        import uuid as _uuid
        from core.config import MEDIA_PRICING
        from sqlalchemy import func

        created = {"image_gen": 0, "video_gen": 0, "message": 0}

        # ── 1. Backfill images & vidéos depuis conversation_files ────────
        files = db.query(ConversationFile).filter(
            ConversationFile.file_type.in_(["image", "video"])
        ).all()

        # Récupérer les timestamps déjà enregistrés pour éviter les doublons
        existing_media = set()
        existing_entries = db.query(UsageLedger.timestamp, UsageLedger.user_id, UsageLedger.action_kind).filter(
            UsageLedger.action_kind.in_(["image_gen", "video_gen"])
        ).all()
        for e in existing_entries:
            existing_media.add((str(e.user_id), str(e.action_kind), str(e.timestamp)[:16]))

        for f in files:
            if not f.user_id or f.user_id == "anonymous":
                continue
            action = "image_gen" if f.file_type == "image" else "video_gen"
            ts_key = (f.user_id, action, str(f.created_at)[:16])
            if ts_key in existing_media:
                continue

            if action == "image_gen":
                cost = MEDIA_PRICING.get("imagen-3", 0.04)
                model = "imagen-3.0-generate-001"
            else:
                cost = MEDIA_PRICING.get("veo-3", 0.35) * 8
                model = "veo-3.0-generate-001"

            db.add(UsageLedger(
                id=str(_uuid.uuid4()),
                user_id=f.user_id,
                model_name=model,
                action_kind=action,
                prompt_tokens=0,
                candidate_tokens=0,
                total_tokens=0,
                cost_usd=cost,
                timestamp=f.created_at,
            ))
            created[action] += 1

        # ── 2. Backfill messages depuis messages → conversations (join) ──
        # Message n'a pas de user_id, on passe par Conversation
        msg_rows = db.query(
            Conversation.user_id,
            func.count(Message.id).label("cnt"),
        ).join(
            Message, Message.conversation_id == Conversation.id
        ).filter(
            Message.role == "assistant",
            Conversation.user_id.isnot(None),
            Conversation.user_id != "anonymous",
            Conversation.user_id != "default",
        ).group_by(Conversation.user_id).all()

        for row in msg_rows:
            uid = row.user_id
            msg_count = int(row.cnt or 0)

            # Compter les entrées UsageLedger existantes de type message pour cet user
            existing_msg_count = db.query(func.count(UsageLedger.id)).filter(
                UsageLedger.user_id == uid,
                UsageLedger.action_kind.in_(["chat", "message"]),
            ).scalar() or 0

            gap = msg_count - existing_msg_count
            if gap <= 0:
                continue

            # Créer les entrées manquantes
            for _ in range(gap):
                db.add(UsageLedger(
                    id=str(_uuid.uuid4()),
                    user_id=uid,
                    model_name="gemini-3.1-pro",
                    action_kind="chat",
                    prompt_tokens=0,
                    candidate_tokens=0,
                    total_tokens=0,
                    cost_usd=0.0,
                ))
                created["message"] += 1

        db.commit()

        total = sum(created.values())
        logger.info(f"[Admin] Backfill terminé: {created}")
        return {
            "status": "success",
            "created": created,
            "total": total,
            "message": f"Backfill terminé: {created['image_gen']} images, {created['video_gen']} vidéos, {created['message']} messages ajoutés au ledger."
        }
    except Exception as e:
        logger.error(f"[Admin] Erreur backfill: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connected-users")
async def get_connected_users(
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """
    Retourne les utilisateurs actifs récemment avec leur activité en temps réel.
    - En ligne : activité < 5 min
    - Récent : activité < 30 min
    """
    try:
        from sqlalchemy import func, desc
        from datetime import datetime, timedelta

        now = datetime.utcnow()
        since_30min = now - timedelta(minutes=30)

        # Récupérer l'activité récente par utilisateur, en joignant UserSubscription pour l'email
        rows = db.query(
            UsageLedger.user_id,
            UserSubscription.user_email,
            func.max(UsageLedger.timestamp).label("last_seen"),
            func.count(UsageLedger.id).label("actions_today"),
            func.sum(UsageLedger.total_tokens).label("total_tokens"),
            func.sum(UsageLedger.cost_usd).label("cost_today"),
        ).join(
            UserSubscription, UserSubscription.user_id == UsageLedger.user_id
        ).filter(
            UsageLedger.timestamp >= now - timedelta(hours=24),
            UserSubscription.user_email.isnot(None)
        ).group_by(
            UsageLedger.user_id, UserSubscription.user_email
        ).order_by(desc("last_seen")).all()

        users = []
        for row in rows:
            last_seen = row.last_seen
            if not last_seen:
                continue
            diff = (now - last_seen).total_seconds()
            if diff < 300:
                status = "online"
            elif diff < 1800:
                status = "recent"
            else:
                status = "away"

            # Dernière action de cet utilisateur
            last_action = db.query(UsageLedger.action_kind, UsageLedger.model_name).filter(
                UsageLedger.user_id == row.user_id
            ).order_by(UsageLedger.timestamp.desc()).first()

            users.append({
                "user_id": row.user_id,
                "email": row.user_email or "",
                "status": status,
                "last_seen": last_seen.isoformat(),
                "actions_today": int(row.actions_today or 0),
                "tokens_today": int(row.tokens_today or 0),
                "cost_today": round(float(row.cost_today or 0), 6),
                "last_action": ACTION_NORMALIZE.get(last_action.action_kind, last_action.action_kind) if last_action else None,
                "last_model": last_action.model_name if last_action else None,
            })

        online_count = sum(1 for u in users if u["status"] == "online")
        recent_count = sum(1 for u in users if u["status"] == "recent")

        return {
            "online_count": online_count,
            "recent_count": recent_count,
            "total_active_24h": len(users),
            "users": users,
        }
    except Exception as e:
        logger.error(f"[Admin] Erreur connected-users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/new-accounts")
async def get_new_accounts(
    days: int = 30,
    admin_id: str = Depends(check_admin_auth),
    db: Session = Depends(get_db)
):
    """Retourne les comptes créés récemment avec leur activité."""
    try:
        from sqlalchemy import func
        from datetime import datetime, timedelta

        since = datetime.utcnow() - timedelta(days=days)

        subs = db.query(UserSubscription).filter(
            UserSubscription.created_at >= since
        ).order_by(UserSubscription.created_at.desc()).all()

        accounts = []
        for sub in subs:
            # Compter l'usage total de cet utilisateur
            usage = db.query(
                func.count(UsageLedger.id).label("total_actions"),
                func.sum(UsageLedger.total_tokens).label("total_tokens"),
                func.sum(UsageLedger.cost_usd).label("total_cost"),
            ).filter(UsageLedger.user_id == sub.user_id).first()

            accounts.append({
                "user_id": sub.user_id,
                "email": sub.user_email or sub.user_id,
                "plan": sub.plan_id or "free",
                "created_at": sub.created_at.isoformat() if sub.created_at else None,
                "total_actions": int(usage.total_actions or 0) if usage else 0,
                "total_tokens": int(usage.total_tokens or 0) if usage else 0,
                "total_cost": round(float(usage.total_cost or 0), 6) if usage else 0,
                "is_active": (usage.total_actions or 0) > 0 if usage else False,
            })

        # Stats
        today = datetime.utcnow().replace(hour=0, minute=0, second=0)
        week_ago = datetime.utcnow() - timedelta(days=7)
        new_today = sum(1 for a in accounts if a["created_at"] and a["created_at"] >= today.isoformat())
        new_week = sum(1 for a in accounts if a["created_at"] and a["created_at"] >= week_ago.isoformat())

        return {
            "total": len(accounts),
            "new_today": new_today,
            "new_this_week": new_week,
            "accounts": accounts,
        }
    except Exception as e:
        logger.error(f"[Admin] Erreur new-accounts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

```


**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: `node flare_review.js approve TKT-018`
3. S'il y a des erreurs, tape: `node flare_review.js reject TKT-018 "Tes explications..."`
