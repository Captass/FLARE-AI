# Guide développeur FLARE AI

Dernière mise à jour : 2 avril 2026

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

| Composant | Technologie | Hébergement |
|-----------|-------------|-------------|
| Frontend  | Next.js 14 (export statique) | Firebase Hosting — `flareai.ramsflare.com` |
| Backend   | FastAPI (Python) | Cloud Run — `flare-backend-236458687422.europe-west1.run.app` |
| Base de données | PostgreSQL (Cloud SQL) | Cloud SQL — `ramsflare:europe-west1:flare-db` |
| Messenger Direct | Service dédié | Cloud Run — `messenger-direct-236458687422.europe-west9.run.app` |

---

## Fichiers importants

### Backend

- `backend/main.py` — point d'entrée FastAPI
- `backend/routers/chatbot.py` — logique chatbot Facebook
- `backend/routers/chat.py` — chat IA principal
- `backend/core/config.py` — variables d'environnement (pydantic-settings)
- `backend/core/memory.py` — mémoire utilisateur
- `backend/agents/supervisor.py` — orchestration des agents

### Frontend

- `frontend/src/app/page.tsx` — racine SPA (NavStack, auth, routing)
- `frontend/src/components/pages/ChatbotParametresPage.tsx` — connexion Facebook, choix de page
- `frontend/src/components/pages/ChatbotDashboardPage.tsx` — tableau de bord chatbot
- `frontend/src/components/pages/ChatbotClientsPage.tsx` — liste des contacts
- `frontend/src/components/pages/ChatbotClientDetailPage.tsx` — détail d'un contact
- `frontend/src/lib/api.ts` — toutes les fonctions d'appel API
- `frontend/src/lib/messengerDirect.ts` — appels au service Messenger Direct
- `frontend/src/lib/facebookMessenger.ts` — OAuth Facebook, gestion pages

---

## Variables d'environnement

### Production (Cloud Run)

Les variables sensibles sont définies directement dans Cloud Run (pas dans `.env`) :

| Variable | Usage |
|----------|-------|
| `META_APP_ID` | App Facebook |
| `META_APP_SECRET` | App Facebook |
| `META_VERIFY_TOKEN` | Webhook Facebook |
| `MESSENGER_DIRECT_URL` | URL du service Messenger |
| `MESSENGER_DIRECT_DASHBOARD_KEY` | Clé du service Messenger |
| `GOOGLE_OAUTH_MASTER_KEY` | Chiffrement tokens Fernet |
| `GEMINI_API_KEY` | LLM Gemini |
| `DATABASE_URL` | PostgreSQL Cloud SQL |

Le fichier `backend/.env` contient uniquement les variables non-sensibles (APP_ENV, HOST, PORT, URLs publiques).

### Local

Copier `.env.local` dans `backend/` — contient toutes les variables pour le développement local.

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

---

## Commandes de déploiement

### Frontend

```powershell
cd frontend
npm run build
firebase deploy --only hosting --project rams-flare-ai
```

- Build : Next.js génère un export statique dans `out/`
- Deploy : Firebase Hosting met à jour `flareai.ramsflare.com`

### Backend

```powershell
cd backend
python -m py_compile main.py
gcloud run deploy flare-backend --source . --region europe-west1 --project ramsflare --allow-unauthenticated --quiet
```

- La commande build et déploie automatiquement sur Cloud Run
- Révision active : `flare-backend-00070-gdt` (2 avril 2026)

---

## Architecture Chatbot Facebook (important)

Chaque utilisateur suit ce flow :

1. **Connexion Facebook** — OAuth popup, token stocké en DB avec chiffrement Fernet
2. **Choix de page** — `selectedPageId` scopé dans `page.tsx` (`selectedFacebookPageId`)
3. **Interface chatbot** — 4 vues : Dashboard, Clients, Personnalisation, Paramètres
4. **Bot actif** — webhook Messenger → `messenger-direct` → réponses IA

Le `selectedPageId` est propagé à chaque composant chatbot. Chaque appel API inclut ce paramètre pour isoler les données par page.

### Callback pattern (nouveau, 2 avril 2026)

`ChatbotParametresPage` remonte la liste des pages via `onPagesChanged` :

```tsx
// page.tsx
const handlePagesChanged = (pages) => {
  setFacebookPages(pages);
  setSelectedFacebookPageId(prev => prev ?? pages[0]?.page_id ?? null);
};
```

Cela résolvait un bug critique : après OAuth, `selectedPageId` restait `null` dans les autres vues.

---

## Historique des déploiements

| Date | Composant | Révision / Version | Changements |
|------|-----------|--------------------|-------------|
| 2 avril 2026 | Backend | `flare-backend-00070-gdt` | `_serialize_page` : ajout `page_picture_url` + `page_category` |
| 2 avril 2026 | Frontend | Firebase release | Fix chatbot multi-page, light mode, resolveToken, dead code removal |
| 26 mars 2026 | Backend | — | Setup initial chatbot Facebook |

---

## Avant de quitter une session

Toujours laisser :

- ce qui a été changé
- ce qui a été déployé (avec la révision Cloud Run si applicable)
- ce qu'il reste à faire
- ce guide à jour
