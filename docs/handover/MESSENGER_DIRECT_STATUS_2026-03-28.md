# Messenger Direct Status - 2026-03-28

## Live URLs

- Public frontend: `https://flareai.ramsflare.com`
- Firebase hosting alias: `https://rams-flare-ai.web.app`
- FLARE backend: `https://flare-backend-236458687422.europe-west1.run.app`
- Messenger direct service: `https://messenger-direct-236458687422.europe-west9.run.app`

## Current product state

The chatbot dashboard now lives natively inside FLARE AI.
The external Messenger dashboard is no longer the main entry point for operators.
The direct Messenger dashboard is now treated as an internal troubleshooting surface only.

Current public shell behavior:

- the public homepage shows the FLARE AI landing page before login
- after login, users enter FLARE AI and choose an internal space from a simplified home screen
- when a user belongs to a shared organization, FLARE can require an explicit workspace choice before opening the business modules
- the chatbot workspace remains the primary business surface once inside the app
- the chatbot workspace is split into 4 tabs:
  - `Vue d'ensemble`
  - `Clients chauds`
  - `Discussions`
  - `Budget`
- `Automatisations` stays visible as an honest locked surface
- `Assistant IA` remains available as a separate workspace after login
- shared organizations and workspace branding are now part of the authenticated app model

Current access behavior:

- account access and organization access are now treated as two separate steps inside FLARE
- the active organization can change workspace branding, offer label and enabled modules
- organization roles are now visible in the workspace chooser and identity settings
- only organization `owner/admin` roles can edit organization branding
- the public FLARE cockpit shows an anonymized Messenger preview
- raw customer identities, raw messages, exports and mode switching are restricted to authorized operator accounts
- the direct service dashboard and direct exports are no longer public
- FLARE now reads Messenger cockpit state from a protected internal JSON route instead of scraping HTML

Important boundary:

- organization role and operator role are not the same thing
- joining a shared organization does not automatically unlock Messenger exports or mode switching
- sensitive chatbot actions still require operator authorization from the backend

Current UX state:

- the public landing and the authenticated app are separated again
- the authenticated home is intentionally light and acts as a chooser
- the chatbot UI has been simplified to reduce overload and keep one clear action path per view
- the FLARE mark is now centralized and reused across landing, app shell, chatbot and settings
- the in-app help now explains the difference between account, active workspace, organization role and chatbot permissions

## Production QA completed on 2026-03-28

Verified on the live public domain in desktop and mobile conditions:

- frontend public domain returns `200`
- backend `/health` returns `{"status":"ok"}`
- backend `/dashboard/messenger` returns live anonymized preview data for guests
- backend guest export returns `401`
- backend guest contact-mode returns `401`
- direct public `/dashboard` returns `403`
- direct public `/dashboard/internal` returns `403`
- direct protected `/dashboard/internal` returns `200`
- direct protected `export.json?range=24h` returns `200`

Desktop QA covered:

- open FLARE AI public shell
- open the chatbot workspace
- review `Vue d'ensemble`
- review `Clients chauds`
- search empty state in `Clients chauds`
- review `Discussions`
- open a live conversation
- verify `Signal du client`, `Prochaine action`, `Pourquoi maintenant`, `Cap du prochain echange`, `Message conseille`
- open `Coaching detaille` when needed
- verify `Questions utiles`
- search empty state in `Discussions`
- review `Budget`
- search empty state in `Budget`
- open `Automatisations`
- open `Contenu`
- open `Assistant IA` guest lock and verify auth modal

Mobile QA covered:

- open sidebar menu
- navigate to `Discussions`
- open a live conversation
- verify sticky mobile actions `Liste` and `Reprendre`
- verify `Questions utiles`
- navigate to `Budget`
- navigate to `Automatisations`
- navigate to `Contenu`
- return to `Chatbot Facebook`

No runtime page errors were left in this QA pass after the service worker registration guard was added.

## Security hardening completed on 2026-03-28

- backend revision: `flare-backend-00054-sjx`
- direct service revision: `messenger-direct-00050-lfb`

Hardening added:

- shared internal key between FLARE backend and Messenger direct service
- direct dashboard, exports and contact-mode now protected by `X-FLARE-Dashboard-Key`
- operator access inside FLARE is now limited to emails listed in `ADMIN_EMAILS` and `DEV_EMAILS`
- guest and non-operator users now receive anonymized Messenger data
- frontend hides export and mode-switch actions when operator permission is missing
- Messenger webhook signature validation now fails closed if `META_APP_SECRET` is missing
- direct root page no longer advertises the dashboard as a public operator entry point

## Live metrics observed during QA

Observed during the production sweep on 2026-03-28:

- `40` messages on 24h
- `9` ready-to-buy signals
- `2` conversations needing human attention
- `1` active tracked contact
- `Archive 24h active`

## Runtime hardening added on 2026-03-28

`frontend/src/app/layout.tsx` now guards service worker registration and update with a safe null-check and `catch`.

Reason:

- avoid noisy browser-side failures when service worker registration or update is temporarily unavailable
- keep the public shell stable even if PWA registration does not complete immediately

## Intentionally excluded from QA

The production QA remained read-only on live data:

- no live message was sent
- no contact mode was switched from bot to human or the reverse
- no Messenger contact state was mutated

## Files updated for this pass

- `backend/core/config.py`
- `backend/.env.example`
- `backend/routers/dashboard.py`
- `chatbot Facebook/direct_service/app.py`
- `chatbot Facebook/direct_service/.env.example`
- `chatbot Facebook/direct_service/README.md`
- `chatbot Facebook/direct_service/DEVELOPER_GUIDE.md`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/MessengerWorkspace.tsx`
- `frontend/src/lib/messengerDirect.ts`
- `docs/README.md`
- `docs/handover/MESSENGER_DIRECT_STATUS_2026-03-28.md`
- `docs/handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md`

## Recommended next checks

- run one authenticated shared-organization QA pass from login to workspace chooser to chatbot
- run one authenticated operator QA pass with a real FLARE account
- validate a full real Messenger journey from Facebook inbox to FLARE AI workspace
- keep using FLARE `/dashboard/messenger` as the main read path for demos and QA
- keep the direct dashboard reserved for internal troubleshooting only
