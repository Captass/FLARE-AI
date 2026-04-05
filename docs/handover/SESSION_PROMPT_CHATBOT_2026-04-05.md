# Prompt — Session suivante : Chatbot Facebook Messenger

> Copie-colle ce texte au debut de la prochaine session Claude.

---

Tu es en train de travailler sur **FLARE AI**, une application web SPA Next.js 14 + FastAPI déployée sur Render.

- Frontend : `https://flareai.ramsflare.com` (Render Static Site)
- Backend : `https://flare-backend-ab5h.onrender.com` (Render Web Service)
- Git : `git --git-dir="D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/.git" --work-tree="D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI"` (chemin avec apostrophe, toujours utiliser --git-dir)
- Déploiement : chaque `git push origin main` déclenche Render automatiquement

## Ce qui a déjà été fait (ne pas refaire)

### Activation assistée v1 (100% complet)
- Tunnel 5 étapes : choix plan → paiement manuel → config → notification technicien → attente
- Plans : Starter 30 000 Ar / Pro 60 000 Ar / Business 120 000 Ar / Entreprise sur devis
- Paiement : MVola + Orange Money (034 02 107 31), validation manuelle par l'admin
- Backend : 22 routes dans `backend/routers/activation.py`, 4 modèles SQLAlchemy
- Admin : onglets Activations / Paiements / Commandes dans `AdminPanel.tsx`
- Sidebar admin visible uniquement pour `cptskevin@gmail.com`
- Page Abonnements avec grille des 4 offres et CTA tunnel

### Bugs corrigés (ne pas revenir dessus)
- Bannière "Voir les offres" ne clignote plus
- Erreurs API FastAPI affichées proprement (plus de JSON brut)
- Reprise automatique si AR existante au lieu d'erreur
- Enterprise mailto ne fait plus de page noire
- Setup wizard ne bloque plus avant activation

## Architecture NavStack (important)

Routage SPA dans `frontend/src/app/page.tsx` via `navStack: NavLevel[]`.
`activeView = navStack[navStack.length - 1]`.

NavLevels disponibles :
```
home | automations | facebook | google
chatbot | chatbot-personnalisation | chatbot-parametres
chatbot-dashboard | chatbot-clients | chatbot-client-detail
chatbot-orders | chatbot-activation
admin | assistant | guide | billing | contact | settings
```

Navigation : `onPush(level)` pour descendre, `onPop()` pour remonter.

## Ce qui doit être fait maintenant — Amélioration Chatbot Facebook

L'utilisateur veut améliorer l'expérience chatbot IA sur Facebook Messenger.
Voici les axes à explorer et prioriser avec lui :

### 1. Personnalisation du chatbot (ChatbotPersonnalisationPage)
- Identité du bot (nom, avatar, ton, langue)
- Message d'accueil personnalisé
- Comportement : réponse automatique, délai, fallback humain
- Vérifier que les données sauvegardées dans `chatbot_preferences` sont bien utilisées par le webhook Messenger

### 2. Qualité des réponses IA
- Le bot répond en français/malgache selon la config ?
- Le bot utilise bien le catalogue produits configuré ?
- Les réponses sont-elles cohérentes avec le ton choisi ?
- Tester le webhook réel avec une page Facebook active

### 3. Dashboard chatbot (ChatbotDashboardPage)
- Les KPIs s'affichent-ils correctement ?
- `pending_human_count` remonte bien les conversations en attente ?
- Le flux de messages récents fonctionne ?

### 4. Clients & Conversations (ChatbotClientsPage)
- La liste des clients Messenger se charge ?
- Le switch bot/humain fonctionne ?
- La fiche client (ChatbotClientDetailPage) est complète ?

### 5. Commandes (ChatbotOrdersPage)
- Les commandes détectées par le bot remontent bien ?
- La création manuelle fonctionne ?
- Les statuts se mettent à jour ?

### 6. Possibles améliorations UX
- Notification temps réel quand un client écrit (webhook → SSE ou polling)
- Template de réponses rapides dans le dashboard
- Historique des conversations archivées

## Fichiers clés pour le chatbot

```
backend/
  routers/chatbot.py          — logique chatbot, webhook Messenger, réponses IA
  routers/dashboard.py        — KPIs chatbot
  routers/facebook_pages.py   — gestion pages Facebook OAuth
  core/config.py              — GEMINI_API_KEY_CHATBOT, META_APP_ID, META_VERIFY_TOKEN

frontend/src/components/pages/
  ChatbotHomePage.tsx          — hub, bannière activation, entrées rapides
  ChatbotPersonnalisationPage.tsx — config bot (nom, ton, catalogue)
  ChatbotParametresPage.tsx    — connexion Facebook OAuth
  ChatbotDashboardPage.tsx     — KPIs, activité récente
  ChatbotClientsPage.tsx       — liste contacts Messenger
  ChatbotClientDetailPage.tsx  — détail conversation
  ChatbotOrdersPage.tsx        — commandes
  ChatbotActivationPage.tsx    — tunnel activation (complet, ne pas toucher)

frontend/src/lib/
  api.ts                       — toutes les fonctions API
  facebookMessenger.ts         — OAuth Facebook, activation page
  messengerDirect.ts           — appels dashboard stats
```

## Variables d'environnement backend (Render)

| Variable | Valeur |
|----------|--------|
| `GEMINI_API_KEY_CHATBOT` | Clé Gemini dédiée au chatbot |
| `META_APP_ID` | ID de l'app Facebook |
| `META_APP_SECRET` | Secret de l'app Facebook |
| `META_VERIFY_TOKEN` | Token de vérification webhook |
| `BACKEND_URL` | `https://flare-backend-ab5h.onrender.com` |
| `MANUAL_PAYMENT_METHODS_JSON` | Méthodes de paiement (optionnel, defaults MVola/Orange Money) |
| `FLARE_FACEBOOK_OPERATOR_NAME` | Nom du technicien FLARE |

## État de l'activation pour les tests

- Compte admin : `cptskevin@gmail.com`
- L'activation n'est complète que quand `activationRequest.status === "active"`
- Tant qu'elle n'est pas active, le cockpit chatbot (KPIs, clients, etc.) est masqué
- Pour tester le chatbot sans activer, passer le status manuellement en base ou via l'admin panel

## Règles importantes

1. Toujours utiliser `getFreshToken()` au lieu du prop `token` dans les hooks async
2. `git` toujours via `--git-dir` / `--work-tree` (chemin avec apostrophe)
3. Compiler le backend avant de pusher : `python -m py_compile backend/routers/xxx.py`
4. Tester sur `flareai.ramsflare.com` après chaque push Render (2-3 min de build)
5. Les erreurs TypeScript pre-existantes dans ChatbotWorkspace.tsx, AssistantPage.tsx, etc. sont connues et non critiques
6. Docs à mettre à jour dans `docs/instructions/VERSIONS.md` et `docs/handover/FLARE_APP_STATUS_2026-03-28.md`

## Question à poser à l'utilisateur en premier

"Sur quelle partie du chatbot veux-tu qu'on travaille en premier ?
1. Améliorer les réponses IA (qualité, ton, langue, catalogue)
2. Tester et corriger le dashboard (KPIs, stats)
3. Améliorer la gestion des clients/conversations
4. Améliorer les commandes
5. Autre chose spécifique ?"
