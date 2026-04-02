# CODE REVIEW REQUEST: TKT-006
**Auteur**: BETA
**Date**: 2026-03-21T10:01:58.177Z

## Changements

### DIFF POUR backend/routers/
```diff
diff --git a/backend/routers/auth_sync.py b/backend/routers/auth_sync.py
index 3522a75..72a5341 100644
--- a/backend/routers/auth_sync.py
+++ b/backend/routers/auth_sync.py
@@ -42,31 +42,28 @@ async def sync_user(
             "status": "existing",
             "plan": existing["plan_id"],
             "plan_name": existing["plan_name"],
-            "usage_messages": existing["usage_messages"],
-            "monthly_messages": existing["monthly_messages"],
-            "reset_at": existing["reset_at"],
+            "daily_budget_usd": existing["daily_budget_usd"],
+            "daily_cost_usd": existing["daily_cost_usd"],
+            "usage_percent": existing["usage_percent"],
         }
 
-    # Nouvel utilisateur — préciser le reset_at pour le frontend
-    reset_at = create_user_subscription(user_id=user_id, plan_id="business")
+    # Nouvel utilisateur — plan Free par défaut
+    create_user_subscription(user_id=user_id, plan_id="free", user_email=user_email)
     logger.info(f"[auth_sync] Nouvel utilisateur inscrit: {user_id} ({user_email})")
-    
-    # reset_at est maintenant un objet datetime ou None (si erreur, mais create_user_subscription est robuste)
-    reset_str = reset_at.isoformat() if reset_at else None
 
     return {
         "status": "created",
-        "plan": "business",
-        "plan_name": "Business",
-        "usage_messages": 0,
-        "monthly_messages": 2000,
-        "reset_at": reset_str,
+        "plan": "free",
+        "plan_name": "Free",
+        "daily_budget_usd": 0.05,
+        "daily_cost_usd": 0.0,
+        "usage_percent": 0,
     }
 
 
 @router.get("/plan")
 async def get_user_plan(authorization: Optional[str] = Header(None)):
-    """Retourne le plan actuel de l'utilisateur et son usage."""
+    """Retourne le plan actuel de l'utilisateur, son usage quotidien et ses limites."""
     user_id = get_user_id_from_header(authorization)
     if user_id == "anonymous":
         raise HTTPException(status_code=401, detail="Authentification requise")
@@ -75,18 +72,15 @@ async def get_user_plan(authorization: Optional[str] = Header(None)):
     if not sub:
         raise HTTPException(status_code=404, detail="Abonnement introuvable. Appelez /api/auth/sync d'abord.")
 
-    limit = sub["monthly_messages"]
-    usage = sub["usage_messages"]
-    percent = round((usage / limit * 100) if limit > 0 else 0)
-
     return {
         "plan": sub["plan_id"],
         "plan_name": sub["plan_name"],
-        "gemini_model": sub["gemini_model"],
-        "usage_messages": usage,
-        "usage_images": sub["usage_images"],
-        "monthly_messages": limit,
-        "monthly_images": sub["monthly_images"],
-        "usage_percent": percent,
-        "reset_at": sub["reset_at"],
+        "daily_budget_usd": sub["daily_budget_usd"],
+        "daily_cost_usd": sub["daily_cost_usd"],
+        "usage_percent": sub["usage_percent"],
+        "daily_images": sub["daily_images"],
+        "max_images_per_day": sub["max_images_per_day"],
+        "daily_videos": sub["daily_videos"],
+        "max_videos_per_day": sub["max_videos_per_day"],
+        "allowed_models": sub["allowed_models"],
     }
diff --git a/backend/routers/chat.py b/backend/routers/chat.py
index 75cbc0b..47d2b97 100644
--- a/backend/routers/chat.py
+++ b/backend/routers/chat.py
@@ -385,35 +385,12 @@ async def chat_stream(
     session_id = request.session_id or str(uuid.uuid4())
     user_id, user_email = get_user_identity(authorization)
 
-    # ── Vérification des Quotas (mêmes limites que le endpoint classique) ──
-    dev_emails = [e.strip().lower() for e in settings.DEV_EMAILS.split(",")]
-    is_dev = user_email.lower() in dev_emails if user_email else False
-
-    if not is_dev and user_id != "anonymous":
-        db = SessionLocal()
-        try:
-            conv_count = db.query(Conversation).filter(Conversation.user_id == user_id, Conversation.status != "deleted").count()
-            fact_count = db.query(CoreMemoryFact).filter(CoreMemoryFact.user_id == user_id).count()
-            if conv_count >= 50:
-                raise HTTPException(status_code=403, detail="Vous avez atteint la limite de 50 conversations. Veuillez supprimer d'anciennes discussions pour continuer.")
-            if fact_count >= 150:
-                raise HTTPException(status_code=403, detail="Votre mémoire IA est pleine (limite atteinte). Veuillez supprimer d'anciennes mémoires.")
-        finally:
-            db.close()
-
+    # Quota vérifié dans supervisor.py (check_quota) — pas de double vérification ici
     orchestrator = _get_agent()
     background_tasks.add_task(_seed_user_knowledge_if_empty, user_id)
 
-    # ── Récupérer le modèle du plan de l'utilisateur ──
+    # model_override: le supervisor utilise le modèle configuré dans settings
     model_override = None
-    if user_id != "anonymous":
-        try:
-            from core.database import get_user_subscription
-            sub = get_user_subscription(user_id)
-            if sub:
-                model_override = sub.get("gemini_model")
-        except Exception as e:
-            logger.warning(f"[chat_stream] Erreur chargement abonnement user={user_id}: {e}")
 
     user_message = request.message.strip()
     file_content = request.file_content
@@ -550,48 +527,10 @@ async def chat(
     session_id = request.session_id or str(uuid.uuid4())
     user_id, user_email = get_user_identity(authorization)
 
-    # ── Vérification des Quotas (Limites) ──
-    # Vérifie si l'utilisateur est un développeur illimité
-    dev_emails = [e.strip().lower() for e in settings.DEV_EMAILS.split(",")]
-    is_dev = user_email.lower() in dev_emails if user_email else False
-    
-    if not is_dev and user_id != "anonymous":
-        db = SessionLocal()
-        try:
-            conv_count = db.query(Conversation).filter(Conversation.user_id == user_id, Conversation.status != "deleted").count()
-            fact_count = db.query(CoreMemoryFact).filter(CoreMemoryFact.user_id == user_id).count()
-            
-            # Limites généreuses pour les utilisateurs normaux
-            if conv_count >= 50:
-                raise HTTPException(status_code=403, detail="Vous avez atteint la limite de 50 conversations. Veuillez supprimer d'anciennes discussions pour continuer.")
-            if fact_count >= 150:
-                raise HTTPException(status_code=403, detail="Votre mémoire IA est pleine (limite atteinte). Veuillez supprimer d'anciennes mémoires.")
-            
-            # Note: Pour les documents KB, la limite peut aussi être vérifiée ici
-            if kb:
-                from core.database import count_vector_knowledge
-                doc_count = count_vector_knowledge(user_id)
-                if doc_count >= 50:
-                    raise HTTPException(status_code=403, detail="Vous avez atteint la limite de 50 documents dans la Base de connaissances. Veuillez en supprimer.")
-                
-        finally:
-            db.close()
-
+    # Quota vérifié dans supervisor.py (check_quota)
     orchestrator = _get_agent()
-
-    # Seed automatique du document de référence (via Knowledge Manager)
     background_tasks.add_task(_seed_user_knowledge_if_empty, user_id)
-
-    # ── Récupérer le modèle du plan de l'utilisateur ──
     model_override = None
-    if user_id != "anonymous":
-        try:
-            from core.database import get_user_subscription
-            sub = get_user_subscription(user_id)
-            if sub:
-                model_override = sub.get("gemini_model")
-        except Exception as e:
-            logger.warning(f"[chat] Erreur chargement abonnement user={user_id}: {e}")
 
     # ── Préparer message et pièce jointe ──
     user_message = request.message.strip()
diff --git a/backend/routers/prospecting.py b/backend/routers/prospecting.py
index f003314..decf166 100644
--- a/backend/routers/prospecting.py
+++ b/backend/routers/prospecting.py
@@ -1,3 +1,4 @@
+import logging
 import random
 import json
 from datetime import datetime, timedelta

```


**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: `node flare_review.js approve TKT-006`
3. S'il y a des erreurs, tape: `node flare_review.js reject TKT-006 "Tes explications..."`
