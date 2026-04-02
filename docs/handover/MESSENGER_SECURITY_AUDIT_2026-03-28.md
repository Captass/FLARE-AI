# Messenger Security Audit - 2026-03-28

## Scope

Audit focused on the FLARE AI chatbot cockpit and the Messenger direct service.

Reviewed areas:

- public FLARE chatbot workspace
- backend proxy endpoints for Messenger cockpit data
- direct Messenger dashboard and exports
- operator actions for human takeover
- webhook signature validation

## Weaknesses found

### 1. Public exposure of raw Messenger dashboard data

Before this pass, the Messenger direct service exposed a public dashboard with:

- real customer names
- raw customer messages
- bot replies
- downloadable JSON and CSV exports

Impact:

- customer privacy leak
- commercial data leak
- easy bypass of FLARE AI protections

### 2. Public access to operator actions

Before this pass, mode switching endpoints could be reached without a strong operator boundary on the direct service side.

Impact:

- risk of unauthorized human takeover toggles
- risk of operational disruption

### 3. FLARE backend allowed full Messenger cockpit data for any authenticated user

Before this pass, the FLARE backend only checked that the caller was not anonymous.

Impact:

- any signed-in FLARE account could potentially see real Messenger customer data
- permissions were too broad for a sensitive sales/support cockpit

### 4. Frontend permission model was misleading

Before this pass, UI actions such as export and mode change depended mainly on the presence of a token, not on real operator authorization.

Impact:

- confusing UX
- false affordances for unauthorized users
- avoidable error states

### 5. FLARE backend relied on HTML scraping for Messenger cockpit state

Before this pass, the backend rebuilt part of the cockpit by parsing the direct service HTML dashboard.

Impact:

- fragile integration
- easy regression if dashboard markup changes

### 6. Webhook signature validation could fail open if `META_APP_SECRET` was absent

Before this pass, the direct service accepted webhook calls without signature verification when the secret was missing.

Impact:

- fake webhook injection risk
- untrusted traffic could imitate Messenger events

## Corrections applied

### Access control

- direct service dashboard routes now require a private shared key via `X-FLARE-Dashboard-Key`
- protected routes:
  - `/dashboard`
  - `/dashboard/internal`
  - `/dashboard/export.json`
  - `/dashboard/export.csv`
  - `/dashboard/contact-mode`
- FLARE backend now sends the shared key to the direct service

### Operator authorization

- FLARE backend now distinguishes:
  - `public`
  - `authenticated`
  - `operator`
- full Messenger data and actions are now limited to authorized operator emails from:
  - `ADMIN_EMAILS`
  - `DEV_EMAILS`

### Safe guest preview

- public and non-operator users now receive an anonymized cockpit
- real names, PSIDs, raw messages, raw replies, exports and mode switching are hidden
- export URLs are blanked in preview mode

### UI alignment

- frontend now reads backend access capabilities instead of assuming a token is enough
- export buttons and mode-switch actions only appear for operator access
- guest and non-operator states now explain the restriction clearly

### Integration hardening

- FLARE backend now uses `/dashboard/internal` JSON instead of parsing direct dashboard HTML
- this removes the fragile HTML scraping dependency for the cockpit state

### Webhook security

- Messenger webhook signature validation now fails closed if `META_APP_SECRET` is missing
- unsigned webhook calls are rejected

## Files changed in this audit

- `backend/core/config.py`
- `backend/.env.example`
- `backend/routers/dashboard.py`
- `chatbot Facebook/direct_service/app.py`
- `chatbot Facebook/direct_service/.env.example`
- `chatbot Facebook/direct_service/README.md`
- `chatbot Facebook/direct_service/DEVELOPER_GUIDE.md`
- `frontend/src/lib/messengerDirect.ts`
- `frontend/src/components/MessengerWorkspace.tsx`
- `docs/README.md`
- `docs/handover/MESSENGER_DIRECT_STATUS_2026-03-28.md`
- `docs/handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md`

## Live deployment state after fix

- frontend: `https://flareai.ramsflare.com`
- backend revision: `flare-backend-00054-sjx`
- direct service revision: `messenger-direct-00050-lfb`

## Production checks completed

- public frontend returns `200`
- public direct dashboard returns `403`
- public direct internal route returns `403`
- public FLARE `/dashboard/messenger` returns `200` with anonymized data
- public FLARE export returns `401`
- public FLARE contact-mode action returns `401`
- direct internal route returns `200` with the shared key
- direct JSON export returns `200` with the shared key
- desktop and mobile public workspace navigation still works on:
  - `Vue d'ensemble`
  - `Clients chauds`
  - `Discussions`
  - `Budget`

## Remaining recommended follow-up

- run one real operator QA pass with a valid Firebase admin/operator session
- rotate the shared dashboard key if it was ever exposed outside deployment tooling
- keep the direct dashboard as an internal troubleshooting surface only
