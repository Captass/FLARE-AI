# 07 - API, modeles de donnees et permissions

## 1. Endpoints backend

### Configuration de lancement
```
GET /api/chatbot/assisted-launch-config
  → methodes de paiement visibles
  → compte operateur Facebook a ajouter
  → SLA cible
  → textes d'assistance
```

### Paiement manuel
```
GET  /api/billing/manual-methods              → liste methodes actives
POST /api/billing/manual-payments             → soumettre une preuve
GET  /api/billing/manual-payments/me          → mes soumissions
GET  /api/admin/payments                      → toutes les soumissions (admin)
GET  /api/admin/payments/{id}                 → detail soumission (admin)
POST /api/admin/payments/{id}/verify          → valider paiement (admin)
POST /api/admin/payments/{id}/reject          → refuser paiement (admin)
```

### Activation assistee
```
GET   /api/chatbot/activation-request         → ma demande en cours
POST  /api/chatbot/activation-request         → creer/soumettre une demande
PATCH /api/chatbot/activation-request         → mettre a jour ma demande
GET   /api/admin/activations                  → toutes les demandes (admin)
GET   /api/admin/activations/{id}             → detail demande (admin)
POST  /api/admin/activations/{id}/assign      → assigner un operateur (admin)
POST  /api/admin/activations/{id}/set-status  → changer le statut (admin)
POST  /api/admin/activations/{id}/add-note    → ajouter une note (admin)
```

### Facebook operateur
```
POST /api/admin/activations/{id}/facebook/start-auth  → lancer OAuth pour l'org (admin)
GET  /api/admin/activations/{id}/facebook/pages       → pages importees (admin)
POST /api/admin/activations/{id}/facebook/activate    → activer une page (admin)
POST /api/admin/activations/{id}/facebook/deactivate  → desactiver une page (admin)
POST /api/admin/activations/{id}/facebook/resync      → re-synchroniser (admin)
```

### Commandes
```
GET   /api/chatbot/orders                     → mes commandes
POST  /api/chatbot/orders                     → creer une commande manuelle
PATCH /api/chatbot/orders/{id}                → mettre a jour statut
GET   /api/admin/orders                       → toutes les commandes (admin)
GET   /api/admin/orders/{id}                  → detail commande (admin)
PATCH /api/admin/orders/{id}                  → MAJ commande (admin)
```

### Dashboard / overview (extensions)
```
GET /api/chatbot/setup-status     → ajouter activationStatus, paymentStatus
GET /api/chatbot/overview         → ajouter globalBotStatus, ordersSummary, conversationModeSummary
GET /api/dashboard/messenger      → ajouter activationStatus, paymentStatus
```

---

## 2. Modeles de donnees

### Tables a creer

#### `activation_requests`
Voir 02_CLIENT_FLOW.md et le plan principal pour la liste complete des champs.

Champs cles :
- `id` (UUID PK)
- `organization_slug`, `organization_scope_id`
- `requester_user_id`
- `selected_plan_id`
- `status` (enum)
- `payment_status`
- contact, business, facebook, chatbot, vente (sections du formulaire)
- `flare_page_admin_confirmed`, `flare_page_admin_confirmed_at`
- `assigned_operator_email`
- `internal_notes`
- timestamps : `requested_at`, `payment_verified_at`, `activation_started_at`, `tested_at`, `completed_at`
- `blocked_reason`

#### `manual_payment_submissions`
Voir 04_MANUAL_PAYMENTS.md pour la liste complete.

#### `activation_request_events`
Audit trail.

| Champ | Type |
|-------|------|
| id | UUID PK |
| activation_request_id | UUID FK |
| actor_type | enum (`client` / `admin` / `system`) |
| actor_id | string (email ou system) |
| event_type | string |
| payload_json | JSON |
| created_at | datetime |

Evenements :
`request_created`, `payment_submitted`, `payment_verified`, `payment_rejected`,
`fb_access_confirmed`, `activation_assigned`, `activation_started`,
`page_imported`, `page_activated`, `test_passed`, `marked_active`,
`blocked`, `note_added`

#### `chatbot_orders`
Voir 06_ORDERS_AND_DASHBOARD.md pour la liste complete.

---

## 3. Permissions

### Client

**owner / admin** :
- payer, envoyer preuve
- creer/modifier sa demande d'activation
- modifier les preferences chatbot
- ON/OFF global
- bot/humain par conversation
- creer/gerer commandes

**member / viewer** :
- lecture seule selon les ecrans
- pas d'action sensible (pas de paiement, pas de toggle, pas de modification)

### Admin FLARE

- voit toutes les demandes de toutes les organisations
- agit via endpoints `/api/admin/*`
- ne devient jamais membre de l'organisation cliente
- authentifie via `ADMIN_EMAILS`
- chaque action est journalisee dans `activation_request_events`

---

## 4. Variables de configuration

### Existantes (a conserver)
- `ADMIN_EMAILS` : liste d'emails admin
- `META_APP_ID`, `META_APP_SECRET` : OAuth Facebook
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` : Stripe (garde mais pas mis en avant)

### Nouvelles
- `MANUAL_PAYMENT_METHODS_JSON` : methodes de paiement manuelles (JSON)
- `FLARE_FACEBOOK_OPERATOR_NAME` : nom du compte Facebook operateur
- `FLARE_FACEBOOK_OPERATOR_CONTACT` : contact de reference operateur
- `ACTIVATION_SLA_MINUTES` : SLA cible (defaut: 15)
