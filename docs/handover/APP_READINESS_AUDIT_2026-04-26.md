# FLARE AI - App readiness audit - 2026-04-26

## Verdict

**Verdict global: pret pour beta assistee conditionnelle, pas pret pour self-serve public complet.**

La base web, le backend Render, Messenger Direct, l'auth, les APIs admin et les builds natifs locaux sont operationnels. Le blocage principal reste la preuve bout-en-bout Messenger en production: la page Facebook FLARE AI est connectee et active, mais le dashboard live ne contient encore aucune conversation recente et aucun test Messenger reel controle n'a ete observe pendant cet audit. Le profil business du chatbot est aussi incomplet, ce qui limite la qualite des reponses.

## Synthese par surface

| Surface | Verdict | Details |
| --- | --- | --- |
| Landing web | OK | `https://flareai.ramsflare.com/` repond 200. Smoke visuel desktop/mobile OK: titre visible, CTA telechargement visible, canvas 3D present, pas d'overflow horizontal, pas d'erreur console Playwright. |
| Auth | OK conditionnel | Login compte principal OK, mauvais mot de passe refuse, creation compte QA live OK, sync backend Free OK, reset password OK, compte non-admin refuse sur APIs admin en 403. Logout visuel complet non re-teste dans cette passe. |
| App user | OK conditionnel | `/app` repond 200 et login UI OK. Preferences chatbot sauvegardees puis relues. Catalogue cree puis supprime sur compte QA. Portfolio et script de vente accessibles sur compte Pro, bloques en 403 sur Free. |
| Chatbot Facebook | BLOQUE pour promesse complete | Page FLARE AI connectee, active, webhook et Direct service synchronises. Mais `has_business_profile=false`, description/offres vides, dashboard Messenger a 0 conversation recente. Reponse Messenger reelle non prouvee pendant cet audit. |
| Messenger Direct | OK technique, preuve fonctionnelle incomplete | `https://messenger-direct-236458687422.europe-west9.run.app/health` repond 200. Status backend confirme `direct_service_configured=true`. Il manque un test utilisateur Messenger reel avec trace dashboard. |
| Admin | OK conditionnel | APIs paiements, activations, commandes, reports, connected-users, new-accounts repondent. Actions sur donnees test: note operateur OK, transition invalide rejetee en 400, paiement test rejete OK. Warning: `new-accounts` melange encore des comptes reels et des pseudo-lignes organisationnelles. |
| Billing manuel | OK conditionnel | Methodes manuelles disponibles, soumission paiement test OK, rejet admin OK, relecture client OK. Warning: la prod expose MVola uniquement pendant cet audit. |
| Downloads web | OK apres deploy Render | `render.yaml` configure les URLs GitHub Release pour Windows/Android. Les pages `/download`, `/downloads/windows`, `/downloads/android` existent et repondent 200. Redirection finale depend du redeploiement Render avec les nouvelles variables. |
| Windows natif | OK local | `scripts/build-windows-desktop.ps1` a regenere `artifacts/native/windows/flare-ai-windows-setup.exe` apres compilation Tauri/NSIS. |
| Android natif | OK local | Keystore release locale generee dans `infra/credentials/android/` (ignoree Git). `scripts/build-android-apk.ps1 -BuildType Release` a produit `artifacts/native/android/flare-ai-android.apk`. Signature APK verifiee avec `apksigner`. |
| GitHub Release | A verifier apres push tag | Workflow `.github/workflows/native-release.yml` existe et publiera les deux assets sur tag `v0.1.0-beta.20260426`. Le blocage de validation GitHub sur `runner.temp` dans `jobs.env` a ete corrige. Localement, `gh`, `GITHUB_TOKEN` et `GH_TOKEN` sont absents; la presence des GitHub Secrets de signing ne peut donc pas etre confirmee depuis cette machine. |
| Render deploy | A verifier apres push main | `render.yaml` est pret. Pas de `RENDER_API_KEY` local pour declencher/verifier le deploy via API. Le push sur `main` doit declencher le deploy selon la configuration existante. |

## Tests executes

### Build et compilation

- `npm run lint` - OK, aucun avertissement ESLint.
- `npm run build` - OK, Next.js 14 compile et prerender 14 pages.
- `python -m py_compile backend/main.py backend/routers/activation.py backend/routers/admin.py backend/routers/chatbot.py backend/routers/facebook_pages.py backend/routers/dashboard.py backend/agents/facebook_cm/agent.py backend/agents/facebook_cm/webhook.py` - OK.

### Endpoints live publics

- `https://flareai.ramsflare.com/` - 200.
- `https://flareai.ramsflare.com/app` - 200.
- `https://flareai.ramsflare.com/download` - 200.
- `https://flareai.ramsflare.com/downloads/windows` - 200.
- `https://flareai.ramsflare.com/downloads/android` - 200.
- `https://flare-backend-ab5h.onrender.com/health` - 200.
- `https://messenger-direct-236458687422.europe-west9.run.app/health` - 200.

### Auth et droits

- Mauvais mot de passe Firebase: refuse en 400.
- Compte QA cree: `cptskevin+flareqa20260426155918@gmail.com`.
- `/api/auth/sync` sur compte QA: `created:free`.
- `/api/auth/plan` sur compte QA: `free:Free`.
- `/api/chatbot/overview` sur compte QA: step `connect_page`, aucune page connectee.
- `/api/admin/payments` sur compte non-admin: 403 attendu.
- Reset password Firebase sur compte QA: OK.

### App user et chatbot settings

- Compte QA CRUD cree: `cptskevin+flarecrudqa20260426160529@gmail.com`.
- `PUT /api/chatbot-preferences` puis `GET /api/chatbot-preferences`: OK.
- `POST /api/chatbot/catalogue`: item cree.
- `DELETE /api/chatbot/catalogue/{id}`: item supprime, compteur revenu a 0.
- Free plan sur `/api/chatbot/portfolio` et `/api/chatbot/sales-config`: 403 attendu.
- Pro plan sur `/api/chatbot/portfolio?page_id=1059457960580072` et `/api/chatbot/sales-config?page_id=1059457960580072`: OK.

### Facebook / Messenger

- `/api/facebook/status`: page `1059457960580072` FLARE AI, active, webhook active, direct service active.
- `/api/chatbot/overview`: `has_connected_page=true`, `has_preferences=true`, `has_identity=true`, `has_business_profile=false`.
- `/api/chatbot-preferences?page_id=1059457960580072`: preferences presentes, mais `company_description` et `products_summary` vides.
- `/dashboard/messenger?page_id=1059457960580072`: 200, conversations recentes = 0.

### Billing et admin test data

- Compte QA admin-flow cree: `cptskevin+flareadminqa20260426160405@gmail.com`.
- Activation test creee: `5389ad75-645b-4036-b6dc-63ba7bc95e84`, status `awaiting_payment`.
- Paiement test soumis: `f028cdcd-69aa-47b0-bb83-5642541a3f33`, status `submitted`.
- Note admin ajoutee: OK.
- Transition directe vers `active`: rejetee en 400 attendu.
- Paiement test rejete par admin: OK, status `rejected`.

### UI smoke

- Browser plugin in-app: bootstrap OK, puis runtime indisponible pendant l'inspection; fallback Playwright local utilise.
- Landing desktop: titre et CTA visibles, canvas present, aucun overflow horizontal, aucune erreur console.
- Landing mobile: titre et CTA visibles, canvas present, aucun overflow horizontal, aucune erreur console.
- App login desktop: login UI OK, app connectee affiche les surfaces utilisateur/chatbot, aucune erreur console.

## Artifacts natifs locaux

| Asset | Taille | SHA-256 |
| --- | ---: | --- |
| `artifacts/native/android/flare-ai-android.apk` | 21,008,227 bytes | `BACCB71EF7512EF7A9231D95E8C3ED2690E1FA1390B6EA8F175D3EEA92DED5C1` |
| `artifacts/native/windows/flare-ai-windows-setup.exe` | 18,836,095 bytes | `74228165A0A0C02FE3ED1AA4BE1BE41C6D7038FE91C00F4BCB08CE707AB47387` |

APK signing:

- Signer DN: `CN=FLARE AI, OU=FLARE AI, O=RAMS FLARE, L=Antananarivo, ST=Antananarivo, C=MG`.
- Signer SHA-256 digest: `e23b51a09d594f7f8926afd6d1c7b3897b5dbab9b4a294c08372c7a6576030a0`.
- `apksigner verify --print-certs` passe. Les warnings `META-INF/*.version` sont des warnings de metadata de dependances, pas un echec de signature.

## Configuration release ajoutee

`render.yaml` configure maintenant:

- `NEXT_PUBLIC_WINDOWS_RELEASE_ASSET_URL=https://github.com/Captass/FLARE-AI/releases/download/v0.1.0-beta.20260426/flare-ai-windows-setup.exe`
- `NEXT_PUBLIC_ANDROID_RELEASE_ASSET_URL=https://github.com/Captass/FLARE-AI/releases/download/v0.1.0-beta.20260426/flare-ai-android.apk`
- `NEXT_PUBLIC_WINDOWS_RELEASE_VERSION=0.1.0-beta.20260426`
- `NEXT_PUBLIC_ANDROID_RELEASE_VERSION=0.1.0-beta.20260426`
- `NEXT_PUBLIC_WINDOWS_RELEASE_DATE=2026-04-26`
- `NEXT_PUBLIC_ANDROID_RELEASE_DATE=2026-04-26`

## Blocages et risques

1. **Messenger reel non prouve pendant cet audit.** Le statut technique est bon, mais la beta assistee doit inclure un test conversationnel reel: envoyer un message a la page FLARE AI, verifier la reponse bot, puis verifier la trace dans `/dashboard/messenger`.
2. **Profil business incomplet.** `has_business_profile=false`; il faut remplir description entreprise, offres/produits, consignes et limites avant de promettre une reponse client fiable.
3. **Self-serve Facebook OAuth non pret.** L'incident documente de recuperation des pages OAuth reste incompatible avec une promesse self-serve publique complete.
4. **GitHub Secrets signing non verifies localement.** Une keystore release locale existe, mais sans `gh`/token local je ne peux pas confirmer ni configurer les secrets du repo depuis cette machine. Le workflow tag dira si `FLARE_ANDROID_KEYSTORE_BASE64`, `FLARE_ANDROID_KEYSTORE_PASSWORD`, `FLARE_ANDROID_KEY_ALIAS`, `FLARE_ANDROID_KEY_PASSWORD` sont deja presents.
5. **Render deploy non verifiable via API locale.** Les variables sont dans `render.yaml`; le deploiement live dependra du push `main` et du redeploiement Render.
6. **Admin metrics a nettoyer.** `new-accounts` inclut des pseudo-entrees organisationnelles, ce qui peut fausser la lecture business des nouveaux comptes.

## Decision release

Release recommandee: **beta assistee uniquement**.

Conditions minimales avant d'envoyer le lien a un vrai client:

- GitHub Release `v0.1.0-beta.20260426` publiee avec `flare-ai-windows-setup.exe` et `flare-ai-android.apk`.
- Render redeploy termine et pages de telechargement pointent vers les assets GitHub.
- Profil business du chatbot FLARE AI complete.
- Test Messenger reel controle passe avec trace dashboard.
