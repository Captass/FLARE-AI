# Guide développeur FLARE AI

Dernière mise à jour : 2 avril 2026 (session 4 — Git `--git-dir` / agents)

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

### Windows — chemin avec apostrophe (`RAM'S FLARE`)

Si le terminal de l’IDE **plante avant d’exécuter** `git` (souvent à cause de l’apostrophe dans `RAM'S FLARE` dans le chemin du workspace), utiliser **d’abord** la technique **`--git-dir` / `--work-tree`** ci-dessous. Les agents IA doivent **s’y tenir systématiquement** pour `status` / `add` / `commit` / `push` lorsque le shell intégré échoue.

#### Technique Git : `--git-dir` et `--work-tree` (référence agents / automation)

**Principe :** ne pas faire `cd` dans le dépôt. Exécuter `git` depuis un répertoire **neutre** (sans `'` dans le chemin), en pointant explicitement le dépôt.

1. Définir la racine du clone (adapter au poste) — les **slashes avant** fonctionnent avec Git pour Windows :

   ```text
   D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI
   ```

2. **Exemples** (PowerShell, `cwd` = par ex. `C:\Windows\System32`) :

   ```powershell
   $G = "D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI"
   git --git-dir="$G/.git" --work-tree="$G" status -sb
   git --git-dir="$G/.git" --work-tree="$G" add -A
   git --git-dir="$G/.git" --work-tree="$G" commit -m "message"
   git --git-dir="$G/.git" --work-tree="$G" push origin main
   ```

   Variante **variables d’environnement** (même effet) :

   ```powershell
   $G = "D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI"
   $env:GIT_DIR = "$G/.git"
   $env:GIT_WORK_TREE = $G
   git status -sb
   ```

3. **PowerShell 5.1 :** enchaîner les commandes avec **`;`** et non **`&&`** (sinon erreur de parse).

4. **Fichiers à ne pas committer par erreur :** si besoin, après `git add -A`, exclure le cache TypeScript par exemple :

   ```powershell
   git --git-dir="$G/.git" --work-tree="$G" reset HEAD -- frontend/tsconfig.tsbuildinfo
   git --git-dir="$G/.git" --work-tree="$G" checkout -- frontend/tsconfig.tsbuildinfo
   ```

#### Autres options (humains ou shell sain)

1. **Script** : `scripts\render-deploy.cmd` ou :

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "…\FLARE AI\scripts\render-deploy.ps1" -Commit -Message "votre message"
   ```

   Sans `-Commit` : `git push origin main` seulement. Avec `-Build` : `npm run build` dans `frontend` avant le push.

2. **PowerShell manuel** : `Set-Location -LiteralPath` vers le dépôt, puis les commandes `git` habituelles — **uniquement si** le terminal accepte ce `cd`.

**Render après le push** : [dashboard Render](https://dashboard.render.com) — builds **flare-frontend** et **flare-backend** ; secours : *Manual Deploy → Deploy latest commit*.

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
3. **Activation automatique (callback)** — après enregistrement des pages, la **première page** de la réponse Meta est activée comme `POST /api/facebook/pages/{page_id}/activate` (subscribe `subscribed_apps` + sync service Messenger). Si Meta renvoie plusieurs pages, les autres restent disponibles dans Paramètres. En cas d’échec (conflit org, sync), le message de succès OAuth l’indique et l’activation manuelle reste possible.
4. **Activation manuelle** — `POST /api/facebook/pages/{page_id}/activate` pour changer de page active ou après échec auto
5. **Bot actif** — webhook Messenger → `POST /webhook/facebook` (service direct ou backend selon configuration Meta) → traitement IA
6. **Déconnexion stricte** — `DELETE /api/facebook/pages/{page_id}` : désabonne l'app Meta, **supprime le record en base** (déconnexion définitive)

Le `selectedPageId` est propagé à chaque composant chatbot. Chaque appel API inclut ce paramètre pour isoler les données par page.

### Refonte UI — spec « Redesign FLARE AI » (mars 2026)

Référence produit : navigation en pile (`NavStack`), breadcrumb, glass cards, drill-down 2–6 cartes par niveau, typographie **minimum `text-sm` (14px)** sur l’UI.

Implémentation dans ce dépôt :

| Zone | Fichiers / comportement |
|------|-------------------------|
| Accueil post-login | `HomePage.tsx` — KPI statut / messages / contacts, cartes accès rapide, hover scale |
| Hub Chatbot | `ChatbotHomePage.tsx` — 4 entrées, KPI issus du dashboard + `getChatbotOverview`, badge rouge sur « Clients » si `pending_human_count` |
| Tableau de bord | `ChatbotDashboardPage.tsx` — KPI alignés libellés spec, `FacebookVerificationBanner`, activité récente, `loadAll` dépend de `selectedPageId` |
| Clients | `ChatbotClientsPage.tsx` — filtres, bannière + « Voir les alertes » |
| Facebook (Meta) | `FacebookVerificationBanner.tsx` — libellés et tailles de texte conformes au plan |

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

### Dépannage « URL blocked » / « domain isn't included in the app's domains »

Ces messages viennent **uniquement** de la configuration Meta, pas d’un bug FLARE tant que `BACKEND_URL` est correct.

1. **Valid OAuth Redirect URIs** doit contenir **exactement** la même URL que renvoie l’API `GET /api/facebook/status` → champ `oauth_callback_url` (souvent `https://<service-backend-render>/api/facebook/callback`). Pas de slash final en trop, pas d’autre sous-domaine que celui du backend.
2. **App Domains** : ajouter les hôtes du **frontend** et du **backend** sans `https://` (ex. `flareai.ramsflare.com`, `flare-backend-ab5h.onrender.com`). Si l’URL Render du backend change, mettre à jour Meta **et** la variable `BACKEND_URL` sur Render.
3. **Facebook Login** : activer *Client OAuth Login* et *Web OAuth Login* selon la doc Meta.
4. Ne pas confondre **`oauth_callback_url`** (login OAuth) et **`callback_url`** du statut (webhook Messenger vers le service direct) — deux champs différents dans l’app Paramètres → panneau **Diagnostic Meta**.
5. Version Graph : le backend utilise `META_GRAPH_VERSION` (défaut `v25.0`). Une URL `v17.0` dans le navigateur indique souvent une **ancienne config** ou un autre environnement ; aligner Meta et les variables Render.

---

## Historique des déploiements

| Date | Composant | Plateforme | Changements |
|------|-----------|------------|-------------|
| 2 avril 2026 | Backend | — | **OAuth Facebook** : activation auto de la 1re page après callback (`_activate_facebook_page_core`), refactor partagé avec `POST .../activate` |
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
