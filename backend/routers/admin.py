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
FALLBACK_ADMIN_EMAILS = {
    "cptskevin@gmail.com",
    "kevin.costa.pro@gmail.com",
    "flareshowoff@gmail.com",
}

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
    "animate_image": "video_gen",
    "doc_gen": "doc_gen",
    "sheet_gen": "sheet_gen",
    "document": "message",
    "sheet": "message",
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

    # Workers document/spreadsheet — modèle flash (worker léger)
    if "document-worker" in n or "spreadsheet-worker" in n:
        return "gemini-3-flash"

    return "gemini-3-pro"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _configured_admin_emails() -> set[str]:
    configured = {
        email.strip().lower()
        for email in str(settings.ADMIN_EMAILS or "").split(",")
        if email and email.strip()
    }
    return configured | FALLBACK_ADMIN_EMAILS


def check_admin_auth(authorization: Optional[str] = Header(None)):
    """Vérifie que l'utilisateur est dans la liste des administrateurs (ADMIN_EMAILS dans .env)."""
    try:
        user_id, user_email = get_user_identity(authorization)
        if user_id == "anonymous":
            raise HTTPException(status_code=401, detail="Session expiree ou invalide.")
        resolved_email = str(user_email or "").strip()
        if not resolved_email:
            resolved_email = _firebase_email_lookup(user_id).strip()
        if not resolved_email:
            logger.warning("[Admin] Aucun email resolu pour l'utilisateur %s", user_id)
            raise HTTPException(status_code=401, detail="Session expiree ou invalide.")
        admin_emails = _configured_admin_emails()
        if not admin_emails:
            logger.error("[Admin] ADMIN_EMAILS est vide ou invalide.")
            raise HTTPException(status_code=503, detail="Configuration admin indisponible.")

        logger.info("[Admin] Requete de %s (ID: %s)", resolved_email, user_id)
        if resolved_email.lower() not in admin_emails:
            logger.warning("[Admin] Tentative d'acces refusee pour %s", resolved_email)
            raise HTTPException(status_code=403, detail="Acces reserve a l'administrateur principal.")
        return user_id

        logger.info(f"[Admin] Requête de {user_email} (ID: {user_id})")

        if user_email.lower() not in admin_emails:
            logger.warning(f"[Admin] Tentative d'accès refusée pour {user_email}")
            raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur principal.")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin] Erreur auth: {e}")
        raise HTTPException(status_code=401, detail="Session expiree ou invalide.")


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
    "doc_gen": {**EMPTY_BREAKDOWN},
    "sheet_gen": {**EMPTY_BREAKDOWN},
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
                    # Créer l'abonnement par défaut (Free — le plan payant est activé après validation manuelle)
                    create_user_subscription(user_id=uid, plan_id="free")
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

        def _make_user_entry(uid: str, email: str, plan: str) -> dict:
            return {
                "user_id": uid,
                "email": email,
                "plan": plan,
                "models": {
                    "gemini-3-pro": {"total": {**EMPTY_BREAKDOWN}, "by_action": {k: {**v} for k, v in EMPTY_BY_ACTION.items()}},
                    "gemini-3-flash": {"total": {**EMPTY_BREAKDOWN}, "by_action": {k: {**v} for k, v in EMPTY_BY_ACTION.items()}},
                },
                "grand_total": {"tokens": 0, "cost": 0.0},
                "last_active": None,
                "last_model": "",
            }

        # 1. Source de vérité : Firebase Auth, avec fallback sur la BDD locale
        user_map: Dict[str, dict] = {}
        subs = {s.user_id: s for s in db.query(UserSubscription).all()}

        firebase_ok = False
        try:
            from firebase_admin import auth as fb_auth
            fb_users_page = fb_auth.list_users()
            while fb_users_page:
                for user in fb_users_page.users:
                    sub = subs.get(user.uid)
                    user_email = ""
                    if user and user.email:
                        user_email = user.email
                    elif sub and sub.user_email:
                        user_email = sub.user_email

                    user_map[user.uid] = _make_user_entry(user.uid, user_email, sub.plan_id if sub else "free")
                fb_users_page = fb_users_page.get_next_page()
            firebase_ok = True
            logger.info(f"[Admin] {len(user_map)} utilisateurs trouvés dans Firebase Auth.")
        except Exception as fb_err:
            logger.warning(f"[Admin] Firebase list_users échoué, fallback sur BDD locale: {fb_err}")
            # Fallback : utiliser les utilisateurs de la table user_subscriptions
            for sub in subs.values():
                if sub.user_id and sub.user_id not in ("anonymous", "default"):
                    user_map[sub.user_id] = _make_user_entry(
                        sub.user_id,
                        sub.user_email or sub.user_id,
                        sub.plan_id or "free"
                    )
            logger.info(f"[Admin] {len(user_map)} utilisateurs trouvés dans la BDD locale (fallback).")

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

        created = {"image_gen": 0, "video_gen": 0, "doc_gen": 0, "sheet_gen": 0, "message": 0}

        # ── 1. Backfill images, vidéos, documents et tableurs depuis conversation_files ──
        files = db.query(ConversationFile).filter(
            ConversationFile.file_type.in_(["image", "video", "document", "spreadsheet"])
        ).all()

        # Récupérer les timestamps déjà enregistrés pour éviter les doublons
        existing_media = set()
        existing_entries = db.query(UsageLedger.timestamp, UsageLedger.user_id, UsageLedger.action_kind).filter(
            UsageLedger.action_kind.in_(["image_gen", "video_gen", "doc_gen", "sheet_gen"])
        ).all()
        for e in existing_entries:
            existing_media.add((str(e.user_id), str(e.action_kind), str(e.timestamp)[:16]))

        for f in files:
            if not f.user_id or f.user_id == "anonymous":
                continue

            # Mapper file_type → action_kind
            type_map = {
                "image": "image_gen",
                "video": "video_gen",
                "document": "doc_gen",
                "spreadsheet": "sheet_gen",
            }
            action = type_map.get(f.file_type)
            if not action:
                continue

            ts_key = (f.user_id, action, str(f.created_at)[:16])
            if ts_key in existing_media:
                continue

            if action == "image_gen":
                cost = MEDIA_PRICING.get("imagen-3", 0.04)
                model = "imagen-3.0-generate-001"
            elif action == "video_gen":
                cost = MEDIA_PRICING.get("veo-3", 0.35) * 8
                model = "veo-3.0-generate-001"
            elif action == "doc_gen":
                cost = MEDIA_PRICING.get("doc_gen", 0.005)
                model = "document-worker"
            elif action == "sheet_gen":
                cost = MEDIA_PRICING.get("sheet_gen", 0.005)
                model = "spreadsheet-worker"
            else:
                continue

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
            "message": f"Backfill terminé: {created['image_gen']} images, {created['video_gen']} vidéos, {created['doc_gen']} docs, {created['sheet_gen']} tableurs, {created['message']} messages."
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
    Retourne les utilisateurs actifs en se basant sur le ping heartbeat (30s) et l'usage.
    - En ligne : ping < 90s (le frontend ping toutes les 30s)
    - Récemment actif : ping < 10 min
    - Actif (24h) : usage API dans les dernières 24h (même sans ping)

    Note: L'auto-refresh est géré côté frontend. Ce endpoint est appelé périodiquement.
    """
    try:
        from sqlalchemy import func, desc
        from datetime import datetime, timedelta

        now = datetime.utcnow()
        since_24h = now - timedelta(hours=24)

        # 1. Utilisateurs avec un ping récent (heartbeat, dernières 15 min max)
        since_15min = now - timedelta(minutes=15)
        pinged_subs = db.query(UserSubscription).filter(
            UserSubscription.last_seen_at.isnot(None),
            UserSubscription.last_seen_at >= since_15min,
        ).order_by(desc(UserSubscription.last_seen_at)).all()

        user_map = {}
        for sub in pinged_subs:
            if not sub.user_id or sub.user_id in ("anonymous", "default"):
                continue
            
            email = sub.user_email
            if not email:
                email = _firebase_email_lookup(sub.user_id)

            user_map[sub.user_id] = {
                "user_id": sub.user_id,
                "email": email or sub.user_id,
                "status": "away",
                "last_seen": sub.last_seen_at.isoformat(),
                "actions_today": 0,
                "tokens_today": 0,
                "cost_today": 0.0,
                "last_action": None,
                "last_model": None,
            }

        # 2. Compléter avec les utilisateurs actifs via usage (24h) mais sans ping récent
        active_uids_from_usage = db.query(UsageLedger.user_id).filter(
            UsageLedger.timestamp >= since_24h,
            UsageLedger.user_id.isnot(None),
        ).distinct().all()

        subs_by_uid = {s.user_id: s for s in db.query(UserSubscription).all()}
        for (uid,) in active_uids_from_usage:
            if uid not in user_map and uid not in ("anonymous", "default"):
                sub = subs_by_uid.get(uid)
                email = (sub.user_email if sub else None)
                if not email:
                    email = _firebase_email_lookup(uid)

                user_map[uid] = {
                    "user_id": uid,
                    "email": email or uid,
                    "status": "away",
                    "last_seen": sub.last_seen_at.isoformat() if (sub and sub.last_seen_at) else None,
                    "actions_today": 0,
                    "tokens_today": 0,
                    "cost_today": 0.0,
                    "last_action": None,
                    "last_model": None,
                }

        # 3. Enrichissement avec les données d'usage du jour
        if user_map:
            user_ids = list(user_map.keys())
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            usage_stats = db.query(
                UsageLedger.user_id,
                func.count(UsageLedger.id).label("actions_today"),
                func.sum(UsageLedger.total_tokens).label("total_tokens"),
                func.sum(UsageLedger.cost_usd).label("cost_today"),
            ).filter(
                UsageLedger.user_id.in_(user_ids),
                UsageLedger.timestamp >= today_start
            ).group_by(UsageLedger.user_id).all()

            for stats in usage_stats:
                if stats.user_id in user_map:
                    user_map[stats.user_id]["actions_today"] = int(stats.actions_today or 0)
                    user_map[stats.user_id]["tokens_today"] = int(stats.total_tokens or 0)
                    user_map[stats.user_id]["cost_today"] = round(float(stats.cost_today or 0), 6)

            # 4. Récupérer la dernière action pour chaque utilisateur
            last_actions_subquery = db.query(
                UsageLedger.user_id,
                func.max(UsageLedger.timestamp).label('max_ts')
            ).filter(UsageLedger.user_id.in_(user_ids)).group_by(UsageLedger.user_id).subquery()

            last_actions_q = db.query(UsageLedger.user_id, UsageLedger.action_kind, UsageLedger.model_name).join(
                last_actions_subquery,
                (UsageLedger.user_id == last_actions_subquery.c.user_id) & (UsageLedger.timestamp == last_actions_subquery.c.max_ts)
            )
            last_actions = {r.user_id: r for r in last_actions_q.all()}

            for uid, user_data in user_map.items():
                action = last_actions.get(uid)
                if action:
                    user_data["last_action"] = ACTION_NORMALIZE.get(action.action_kind, action.action_kind)
                    user_data["last_model"] = action.model_name

        # 5. Calculer le statut basé UNIQUEMENT sur le ping heartbeat
        users_list = list(user_map.values())
        for u in users_list:
            if not u["last_seen"]:
                u["status"] = "away"
                continue
            try:
                last_seen_dt = datetime.fromisoformat(u["last_seen"])
                diff = (now - last_seen_dt).total_seconds()
                if diff < 90:        # < 90s = en ligne (ping toutes les 30s + marge)
                    u["status"] = "online"
                elif diff < 600:     # < 10 min = récemment actif
                    u["status"] = "recent"
                else:
                    u["status"] = "away"
            except (ValueError, TypeError):
                u["status"] = "away"

        # Trier : online > recent > away, puis par activité
        status_order = {"online": 0, "recent": 1, "away": 2}
        users_list.sort(key=lambda u: (status_order.get(u["status"], 3), -(u["actions_today"] or 0)))

        online_count = sum(1 for u in users_list if u["status"] == "online")
        recent_count = sum(1 for u in users_list if u["status"] == "recent")

        return {
            "online_count": online_count,
            "recent_count": recent_count,
            "total_active_24h": len(users_list),
            "users": users_list,
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
            UserSubscription.created_at >= since,
            UserSubscription.user_id.isnot(None),
            UserSubscription.user_id != "anonymous",
            UserSubscription.user_id != "default",
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
