# Guide développeur FLARE AI

Dernière mise à jour : 2 avril 2026 (session 2)

## But du guide

Ce document explique comment travailler sur FLARE AI sans casser l'app.

---

## Le projet en clair

FLARE AI est une application web avec :

- chat IA principal
- mémoire utilisateur
- base de connaissances
- génération d'images et vidéos
- génération et édition Word / Excel
- agents spécialisés
- panneau admin
- **chatbot Facebook Messenger** (multi-page, multi-utilisateur)

---

## Architecture

### Hébergement : Render.com (migré le 2 avril 2026)

| Composant | Technologie | Hébergement |
|-----------|-------------|-------------|
| Frontend  | Next.js 14 (export statique) | Render Static Site — `flareai.ramsflare.com` |
| Backend   | FastAPI (Python) | Render Web Service — `flare-backend` |
| Base de données | PostgreSQL | Render PostgreSQL — `flare-db` |
| Authentification | Firebase Auth (gratuit) | Google Firebase (service externe) |

> **Note :** Firebase Auth est le seul service Google encore utilisé. Il gère uniquement
> la connexion / inscription des utilisateurs. Tout le reste (hébergement, serveur, BDD)
> est sur Render.

### Ancienne infrastructure (obsolète — ne plus utiliser)

| Composant | Ancien hébergement |
|-----------|-------------------|
| Frontend  | Firebase Hosting |
| Backend   | Cloud Run — `flare-backend-236458687422.europe-west1.run.app` |
| Base de données | Cloud SQL — `ramsflare:europe-west1:flare-db` |
| Messenger Direct | Cloud Run — `messenger-direct-236458687422.europe-west9.run.app` |

---

## Fichiers importants

### Infrastructure

- `render.yaml` — Blueprint Render (définit les 3 services + leurs variables d'environnement)
- `frontend/next.config.js` — config Next.js (export statique, images non optimisées)
- `backend/requirements.txt` — dépendances Python

### Backend

- `backend/main.py` — point d'entrée FastAPI
- `backend/routers/chatbot.py` — logique chatbot Facebook
- `backend/routers/chat.py` — chat IA principal
- `backend/routers/dashboard.py` — API tableau de bord + KPIs
- `backend/core/config.py` — variables d'environnement (pydantic-settings)
- `backend/core/memory.py` — mémoire utilisateur
- `backend/agents/supervisor.py` — orchestration des agents

### Frontend

- `frontend/src/app/page.tsx` — racine SPA (NavStack, auth, routing)
- `frontend/src/lib/firebase.ts` — initialisation Firebase Auth (clés publiques via env vars)
- `frontend/src/components/pages/ChatbotHomePage.tsx` — accueil chatbot avec KPIs
- `frontend/src/components/pages/ChatbotParametresPage.tsx` — connexion Facebook, choix de page
- `frontend/src/components/pages/ChatbotDashboardPage.tsx` — tableau de bord chatbot
- `frontend/src/components/pages/ChatbotClientsPage.tsx` — liste des contacts
- `frontend/src/components/pages/ChatbotClientDetailPage.tsx` — détail d'un contact
- `frontend/src/components/SkeletonLoader.tsx` — composant skeleton loading premium
- `frontend/src/components/PlatformCard.tsx` — cartes plateforme avec glassmorphism
- `frontend/src/lib/api.ts` — toutes les fonctions d'appel API
- `frontend/src/lib/messengerDirect.ts` — appels au service Messenger Direct
- `frontend/src/lib/facebookMessenger.ts` — OAuth Facebook, gestion pages

---

## Variables d'environnement

### Production (Render Dashboard)

Les variables sont définies dans le dashboard Render → service → Environment :

**Backend (`flare-backend`) :**

| Variable | Usage |
|----------|-------|
| `DATABASE_URL` | PostgreSQL Render (auto-injecté via Blueprint) |
| `GEMINI_API_KEY_GLOBAL` | Clé Gemini principale / fallback (toutes les requêtes sans clé spécifique) |
| `GEMINI_API_KEY_CHATBOT` | Clé Gemini dédiée au Chatbot Facebook Messenger |
| `GEMINI_API_KEY_ASSISTANT_REASONING` | Clé Gemini dédiée à l'Assistant IA (tâches complexes) |
| `GEMINI_API_KEY_ASSISTANT_FAST` | Clé Gemini dédiée à l'Assistant IA (tâches rapides / background) |
| `META_APP_ID` | App Facebook (depuis developers.facebook.com) |
| `META_APP_SECRET` | App Facebook (secret) |
| `META_VERIFY_TOKEN` | Token de vérification du webhook Messenger |
| `BACKEND_URL` | `https://flare-backend-ab5h.onrender.com` — **critique pour OAuth Facebook** |
| `FRONTEND_URL` | `https://flareai.ramsflare.com` |
| `FIREBASE_PROJECT_ID` | `rams-flare-ai` |
| `APP_ENV` | `production` |
| `FLIGHT_MODE` | `True` (mode dégradé sans toutes les clés) |
| `SUPABASE_URL` | Supabase (optionnel) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (optionnel) |

**Frontend (`flare-frontend` — défini dans `render.yaml`) :**

| Variable | Usage |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Auto-résolu depuis `flare-backend` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clé publique Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `rams-flare-ai.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `rams-flare-ai` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `rams-flare-ai.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `461942823604` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ID de l'app Firebase |

### Où trouver les clés secrètes (Third-Party)

| Service | Clés | Chemin |
|---------|------|--------|
| **Meta/Facebook** | `META_APP_ID`, `META_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com) → Mon App → Paramètres de l'application → Général |
| **Meta/Facebook** | `META_VERIFY_TOKEN` | Chaîne de caractères libre que tu as définie lors de la configuration du Webhook Messenger |
| **OpenAI** | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API Keys |
| **Google Gemini** | `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API Key |
| **Firebase** | `FIREBASE_PROJECT_ID`, etc. | Console Firebase → Paramètres du projet → Général → "Vos applications" |

### Local

- Backend : `backend/.env` — copier depuis `.env.example` et adapter
- Frontend : `frontend/.env.local` — copier depuis `.env.example` et adapter
- Le `DATABASE_URL` local doit pointer vers la base Render PostgreSQL (voir render dashboard)

---

## Déploiement

### Automatique (recommandé)

Chaque `git push` sur la branche `main` déclenche automatiquement :
1. Render détecte le push via le Blueprint
2. Build du backend (`pip install -r requirements.txt` → `uvicorn`)
3. Build du frontend (`npm ci --include=dev && npm run build` → dossier `out/`)
4. Mise en ligne automatique

### Manuel (si besoin)

**Frontend :**
```powershell
cd frontend
npm run build
# Le dossier out/ est prêt, Render le sert automatiquement
# Ou : aller sur Render → flare-frontend → Manual Deploy → Deploy latest commit
```

**Backend :**
```powershell
cd backend
python -m py_compile main.py
# Puis : git push (déploiement auto) ou Manual Deploy sur Render
```

### Ancien déploiement (NE PLUS UTILISER)

```powershell
# ❌ Firebase Hosting — obsolète
# firebase deploy --only hosting --project rams-flare-ai

# ❌ Cloud Run — obsolète
# gcloud run deploy flare-backend --source . --region europe-west1 --project ramsflare
```

---

## DNS

| Domaine | Type | Cible |
|---------|------|-------|
| `flareai.ramsflare.com` | CNAME | `flare-frontend-t8i4.onrender.com` |

Registrar : **Squarespace** (ramsflare.com)

Certificat SSL : géré automatiquement par Render (Let's Encrypt)

---

## Règles de travail

1. backend prioritaire quand une fonction casse
2. vérifier les `.env` avant de conclure à un bug
3. utiliser `getFreshToken()` dans les resolvers async (jamais le prop `token` directement)
4. build ou compile avant tout déploiement
5. tester en vrai après déploiement
6. mettre à jour ce guide après un changement important

## Ce qu'il ne faut pas faire

- déplacer les `.env` actifs
- committer les fichiers `.env.local` (contiennent des secrets)
- laisser des notes importantes à la racine du projet
- dire qu'une fonction marche sans test réel
- faire des changements sans laisser de trace écrite
- utiliser les anciennes commandes Firebase Hosting ou Cloud Run pour déployer

---

## Architecture Chatbot Facebook (important)

Chaque utilisateur suit ce flow :

1. **Connexion Facebook** — OAuth popup `GET /api/facebook/auth` → popup navigateur → `GET /api/facebook/callback`
2. **Token stocké** — `page_access_token` chiffré (Fernet) dans `facebook_page_connections`
3. **Activation** — `POST /api/facebook/pages/{page_id}/activate` : subscribe webhook Meta + sync direct service
4. **Bot actif** — webhook Messenger → `POST /webhook/facebook` → `facebook_cm/agent.py` → Gemini Chatbot
5. **Déconnexion stricte** — `DELETE /api/facebook/pages/{page_id}` : désabonne l'app Meta, **supprime le record en base** (déconnexion définitive)

Le `selectedPageId` est propagé à chaque composant chatbot. Chaque appel API inclut ce paramètre pour isoler les données par page.

### Routage multi-clés Gemini (2 avril 2026)

Chaque composant IA utilise une clé dédiée pour le suivi des coûts :

```python
# core/llm_factory.py — get_llm(purpose=...)
# purpose='chatbot'              → GEMINI_API_KEY_CHATBOT
# purpose='assistant_reasoning'  → GEMINI_API_KEY_ASSISTANT_REASONING
# purpose='assistant_fast'       → GEMINI_API_KEY_ASSISTANT_FAST
# fallback                       → GEMINI_API_KEY_GLOBAL
```

### Callback pattern (2 avril 2026)

`ChatbotParametresPage` remonte la liste des pages via `onPagesChanged` :

```tsx
// page.tsx
const handlePagesChanged = (pages) => {
  setFacebookPages(pages);
  setSelectedFacebookPageId(prev => prev ?? pages[0]?.page_id ?? null);
};
```

Cela résolvait un bug critique : après OAuth, `selectedPageId` restait `null` dans les autres vues.

### Pages légales (Meta Platform Policy)

Créées le 2 avril 2026 dans `frontend/src/app/` :

| Page | URL | Usage Meta |
|------|-----|------------|
| `privacy-policy/page.tsx` | `https://flareai.ramsflare.com/privacy-policy` | Privacy Policy URL (obligatoire) |
| `terms/page.tsx` | `https://flareai.ramsflare.com/terms` | Terms of Service URL |
| `data-deletion/page.tsx` | `https://flareai.ramsflare.com/data-deletion` | User Data Deletion URL |

### Configuration Meta Developer Console

Ce qu'il faut avoir configuré dans [developers.facebook.com](https://developers.facebook.com) pour que OAuth fonctionne :

1. **App Settings → Basic → App Domains** :
   - `flareai.ramsflare.com`
   - `flare-backend-ab5h.onrender.com`
2. **Facebook Login → Settings → Valid OAuth Redirect URIs** :
   - `https://flare-backend-ab5h.onrender.com/api/facebook/callback`
3. **Privacy Policy URL** : `https://flareai.ramsflare.com/privacy-policy`
4. **Terms of Service URL** : `https://flareai.ramsflare.com/terms`
5. **User Data Deletion URL** : `https://flareai.ramsflare.com/data-deletion`

---

## Historique des déploiements

| Date | Composant | Plateforme | Changements |
|------|-----------|------------|-------------|
| 2 avril 2026 (session 2) | Backend | Render | **Déconnexion stricte Facebook** : `DELETE /api/facebook/pages/{id}` supprime le record en DB |
| 2 avril 2026 (session 2) | Backend | Render | **Routage multi-clés Gemini** : `get_llm(purpose=...)` avec fallback sur `GEMINI_API_KEY_GLOBAL` |
| 2 avril 2026 (session 2) | Backend | Render | Nommage `GEMINI_API_KEY` → `GEMINI_API_KEY_GLOBAL` dans `config.py` + `llm_factory.py` |
| 2 avril 2026 (session 2) | Frontend | Render | Ajout pages légales : `privacy-policy`, `terms`, `data-deletion` |
| 2 avril 2026 (session 2) | Config | Meta Developers | App Domains + OAuth Redirect URI configurés pour Render |
| 2 avril 2026 (session 2) | Config | Render | `BACKEND_URL` ajouté dans les env vars (critique pour OAuth callback) |
| 2 avril 2026 (session 2) | Infrastructure | Git/Render | Résolution conflits merge dans `render.yaml`, push via token HTTPS |
| 2 avril 2026 | Infrastructure | Render.com | Migration complète : frontend (static), backend (web), PostgreSQL |
| 2 avril 2026 | Frontend | Render | KPIs dashboard, skeleton loading, PlatformCard premium, bannière reconnexion |
| 2 avril 2026 | Backend | Render | Endpoint dashboard avec filtre `page_id` |
| 2 avril 2026 | DNS | Squarespace | CNAME `flareai` → `flare-frontend-t8i4.onrender.com` |
| 26 mars 2026 | Backend | Cloud Run (ancien) | Setup initial chatbot Facebook |

---

## Avant de quitter une session

Toujours laisser :

- ce qui a été changé
- ce qui a été déployé (avec l'URL Render si applicable)
- ce qu'il reste à faire
- ce guide à jour
