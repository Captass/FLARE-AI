# Handover — Lancement activation assistee v1 (4-5 avril 2026)

> Ce document couvre tout ce qui a ete construit, corrige et deploye lors des sessions du 4 et 5 avril 2026 pour le lancement de l'activation assistee FLARE v1.

---

## Contexte

FLARE AI passe d'un mode "self-serve" (l'utilisateur connecte Facebook lui-meme) a un mode "assiste" (FLARE connecte le chatbot pour le client). Ce changement simplifie le parcours de lancement et elimine la complexite des permissions Meta pour les clients.

Le produit est accessible sur : **https://flareai.ramsflare.com**

---

## Ce qui a ete construit

### Backend

**Fichier :** `backend/routers/activation.py` (~700 lignes)

22 routes FastAPI :

| Groupe | Routes |
|--------|--------|
| Activation client | `GET /activation/my` — demande en cours |
| | `POST /activation/start` — demarrer une demande |
| | `PUT /activation/my/config` — sauvegarder config (page Facebook, email) |
| | `POST /activation/my/notify-flare` — notifier technicien FLARE |
| | `GET /activation/my/status` — statut polling |
| Paiement manuel | `POST /activation/my/payment` — soumettre preuve de paiement |
| | `GET /activation/my/payment` — voir soumissions |
| Commandes | `GET /chatbot/orders` — liste commandes |
| | `POST /chatbot/orders` — creer commande manuelle |
| | `PUT /chatbot/orders/{id}` — mettre a jour statut |
| | `GET /chatbot/orders/{id}` — detail commande |
| Admin | `GET /admin/activations` — toutes les demandes |
| | `PUT /admin/activations/{id}/status` — changer statut |
| | `PUT /admin/activations/{id}/assign` — assigner operateur |
| | `POST /admin/activations/{id}/note` — ajouter note |
| | `GET /admin/payments` — toutes les soumissions paiement |
| | `PUT /admin/payments/{id}/verify` — valider paiement |
| | `PUT /admin/payments/{id}/reject` — rejeter paiement |
| | `GET /admin/orders` — toutes les commandes |
| | `PUT /admin/orders/{id}` — mettre a jour commande (admin) |

**Fichier :** `backend/core/database.py` — 4 nouveaux modeles SQLAlchemy

| Modele | Description |
|--------|-------------|
| `ActivationRequest` | Demande d'activation par organisation. Contient `status`, `plan_id`, `config_json`. |
| `ActivationRequestEvent` | Historique de chaque changement de statut avec auteur et note. |
| `ManualPaymentSubmission` | Preuve de paiement soumise (methode, reference, montant, statut). |
| `ChatbotOrder` | Commande detectee ou creee manuellement. Contient `source` (signal_ia / manuel), `status`, `items_json`. |

### Frontend — Nouvelles pages

**`frontend/src/components/pages/ChatbotActivationPage.tsx`** (1542 lignes)

Tunnel d'activation 5 etapes :

1. **Choix du plan** — 4 plans en grille `sm:grid-cols-2 lg:grid-cols-4`
   - Starter : 30 000 Ar/mois
   - Pro : 60 000 Ar/mois (recommande)
   - Business : 120 000 Ar/mois
   - Entreprise : Sur devis → `mailto:contact@ramsflare.com`
2. **Paiement** — instructions de paiement manuel, champ reference, bouton upload preuve
3. **Configuration** — nom de la page Facebook, URL, email admin Facebook
4. **Notification technicien** — recapitulatif, checkbox confirmation, bouton "Confirmer et notifier l'equipe"
5. **Attente** — polling toutes les 15s, affichage du statut en temps reel

Resume automatique : a l'ouverture, si une demande existe deja, l'utilisateur est renvoye a l'etape correspondante.

---

**`frontend/src/components/pages/ChatbotOrdersPage.tsx`** (725 lignes)

- Filtres par statut : all / new / confirmed / needs_followup / delivered / cancelled
- Cartes commandes avec badge source (Signal IA / Manuel), expand/collapse
- Formulaire creation commande manuelle (collapsible inline)
- Mise a jour de statut via `updateChatbotOrder`
- Etat vide et skeleton de chargement

### Frontend — Composants modifies

**`ChatbotHomePage.tsx`**
- Etat `activationRequest` et `currentPlanId` charges au montage
- `isActivationActive = activationRequest?.status === "active"` — gate tout le cockpit
- `showSetupWizard` conditionne par `isActivationActive` — le wizard self-serve ne bloque plus le parcours
- Banniere d'activation dynamique (`getActivationBanner()`) selon le statut de la demande
- `PageSelector`, KPIs, et cartes d'entree masques si pas encore actif
- Carte "Commandes" ajoutee aux entrees rapides

**`NavBreadcrumb.tsx`** / **`NavLevel`**
- Ajout des niveaux : `chatbot-orders`, `chatbot-activation`, `admin`
- Labels : "Commandes", "Activation", "Administration"

**`NewSidebar.tsx`**
- Prop `userEmail?: string | null`
- `ADMIN_EMAILS = ["cptskevin@gmail.com"]`
- Bouton "Administration" visible uniquement pour les emails admin
- Inclus dans `activeMainItem` : `chatbot-orders` et `chatbot-activation` → mappes sur `"automations"`

**`AdminPanel.tsx`**
- Onglet type etendu : `"activations" | "payments" | "orders"`
- 3 nouvelles cartes dans le menu admin
- 3 nouveaux onglets :
  - `AdminActivationsTab` — filtres, transitions de statut, assignation operateur, notes
  - `AdminPaymentsTab` — validation/rejet avec raison
  - `AdminOrdersTab` — gestion commandes

**`page.tsx`**
- Import et routing pour `ChatbotActivationPage` et `ChatbotOrdersPage`
- Passe `userEmail={user?.email ?? null}` a `NewSidebar`

---

## Bugs corriges

| Bug | Cause | Correction |
|-----|-------|------------|
| Wizard bloque l'acces chatbot | `showSetupWizard` independant de l'activation | Gate par `isActivationActive` |
| Admin pas dans la sidebar | `NewSidebar` sans logique admin | Ajout `ADMIN_ITEM`, `ADMIN_EMAILS`, prop `userEmail` |
| Prix incorrects | Agent avait genere 50k/120k/250k | Corriges a 30k/60k/120k + sur devis |
| Etape 4 demandait d'ajouter FLARE comme admin | Ancienne spec self-serve | Reecrit : technicien FLARE est notifie, client confirme seulement |
| Smart quotes UTF-8 dans JSX | Claude genere des guillemets U+201C/U+201D | Script Node.js de nettoyage |
| `resolveToken` utilise avant declaration | useEffect place avant le useCallback | Deplace apres la declaration |
| `ar.value` type error | `getMyActivationRequest` retourne `{ activation_request: ... }` | `ar.value.activation_request` |
| Duplicate `isActivationActive` | Declaration dupliquee apres refactor | Suppression du doublon |

---

## Etat de l'application apres ce lancement

### Ce qui fonctionne

- Tunnel d'activation complet (plan → paiement → config → notification → attente)
- Dashboard admin : gestion activations, paiements, commandes
- Page commandes client avec filtres et creation manuelle
- Acces admin via sidebar pour `cptskevin@gmail.com`
- Banniere de statut activation dans l'accueil chatbot
- Cockpit chatbot bloque jusqu'a activation active
- Wizard self-serve ne bloque plus le parcours

### Limitations connues / A faire plus tard

- Notifications email non implementees (variable `ACTIVATION_NOTIFICATION_EMAIL` prevue mais non connectee)
- L'acces admin est controle cote frontend uniquement (liste d'emails hardcodes) — convient pour v1
- Les KPI Messenger restent dependants du service `messenger-direct`
- 18 erreurs TypeScript legacy pre-existantes dans des fichiers non lies au chatbot (ChatbotWorkspace, AssistantPage, etc.) — non critiques pour le lancement

### Variables d'environnement a configurer sur Render

| Variable | Valeur exemple |
|----------|---------------|
| `MANUAL_PAYMENT_METHODS_JSON` | `[{"id":"mvola","label":"MVola","number":"034 00 000 00"}]` |
| `FLARE_FACEBOOK_OPERATOR_NAME` | `FLARE AI` |
| `FLARE_FACEBOOK_OPERATOR_URL` | `https://facebook.com/flareai` |
| `ACTIVATION_NOTIFICATION_EMAIL` | `ops@ramsflare.com` |

---

## Commits Git

```
feat: chatbot v1 activation launch -- tunnel, orders, admin ops tabs
fix: activation flow -- bypass setup wizard, add admin sidebar, fix prices (e890129)
```

Deploye automatiquement sur Render via push `origin/main`.

---

## Points d'attention pour la suite

1. **Tests manuels recommandes** :
   - Compte normal → "Activer mon chatbot" → parcourir les 5 etapes
   - Compte admin `cptskevin@gmail.com` → menu "Administration" → onglets Activations / Paiements / Commandes
   - Verifier que le cockpit (KPIs, clients, etc.) reste masque jusqu'a `status === "active"`
   - Verifier que le wizard Facebook ne s'affiche pas avant activation

2. **Prochaine iteration possible** :
   - Notifications email reelles lors d'une soumission de paiement ou d'une demande d'activation
   - Role admin gere cote backend (table `admin_users`) plutot que liste hardcodee frontend
   - Suivi temps reel via WebSocket ou Server-Sent Events au lieu du polling 15s
   - Page de commandes enrichie (details produits, historique)
