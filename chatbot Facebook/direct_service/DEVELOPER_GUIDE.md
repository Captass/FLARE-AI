# Developer Guide

## Vue d'ensemble

Cette V1 n'utilise plus n8n ni FLARE AI pour les reponses live.
Le flux est maintenant :

1. Meta envoie les messages a notre webhook Cloud Run
2. Le service recupere le message Messenger
3. Le service classe rapidement le message
4. Le service demande une reponse a Google Gemini `gemini-2.5-flash-lite`
5. Le service compacte et securise la reponse si besoin
6. Le service repond sur Messenger
7. Le service journalise localement en SQLite
8. Le service archive les events recents dans Google Cloud Storage
9. Le service notifie Telegram seulement en cas important
10. Telegram permet aussi de passer un contact en mode humain ou de rendre la main a l'agent

## URLs live

- Service public : `https://messenger-direct-236458687422.europe-west9.run.app`
- Health : `https://messenger-direct-236458687422.europe-west9.run.app/health`
- Webhook Meta : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`

Le dashboard direct n'est plus un point d'entree public.
Le cockpit operateur passe par FLARE AI.

## Variables

Le fichier principal est [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env).

Variables importantes :

- `META_VERIFY_TOKEN` : Token de vérification du webhook Messenger
- `META_PAGE_ACCESS_TOKEN` : Token d'accès de la page Facebook
- `META_APP_SECRET` : Clé secrète de l'application Facebook
- `DASHBOARD_ACCESS_KEY` : Clé d'accès au dashboard
- `META_GRAPH_VERSION` : Version de l'API Graph Meta
- `TELEGRAM_BOT_TOKEN` : Token du bot Telegram
- `TELEGRAM_CHAT_ID` : ID du chat Telegram
- `GOOGLE_API_KEY` (obsolète/remplacé) / `GEMINI_API_KEY_CHATBOT` : Clé dédiée à l'interaction du Chatbot
- `GOOGLE_GENAI_MODEL` : Modèle utilisé pour la génération
- `GOOGLE_SHEET_ID` : ID du Google Sheet
- `GOOGLE_SERVICE_ACCOUNT_JSON` : Clé de compte de service Google

## Fichiers cles

- [app.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/app.py)
- [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env)
- [`.env.example`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.example)
- [runtime_config.json](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/runtime_config.json)
- [bootstrap_google_sheet.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/bootstrap_google_sheet.py)
- [sheet_template.xlsx](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/sheet_template.xlsx)

## Meta

Utiliser dans Meta :

- Callback URL : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- Verify token : `Ramsflare2026`

## IA et comportement

- prompt principal dans [app.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/app.py)
- agent commercial RAM'S FLARE
- reponses tres courtes
- adaptation a la langue du client
- escalade vers un responsable pour devis, rendez-vous, commande ou blocage
- Telegram conditionnel, pas systematique
- format Telegram tres court et lisible
- bouton Telegram pour prise de relais
- si le mode humain est actif, l'agent ne repond plus a ce contact

## Google Sheets

Etat actuel :

- le service peut maintenant remplir automatiquement le vrai Google Sheet
- les ecritures sont faites par le backend, jamais par le prompt
- si `GOOGLE_SERVICE_ACCOUNT_JSON` est rempli, le service utilise ce service account
- sinon il essaye d'utiliser l'identite Cloud Run

Feuilles remplies :

- `contacts`
- `conversations`
- `messages`
- `leads`
- `devis`
- `rendez_vous`
- `kpi_journalier`

Le bootstrap reste disponible si besoin :

1. un workbook pret a importer : [sheet_template.xlsx](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/sheet_template.xlsx)
2. un script de bootstrap pour ton vrai Google Sheet : [bootstrap_google_sheet.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/bootstrap_google_sheet.py)

Commande :

```powershell
cd "D:\Travail\RAM'S FLARE\Flare Group\Flare AI\Antigravity\FLARE AI OS\V2\chatbot Facebook\direct_service"
python -m pip install -r admin_requirements.txt
python bootstrap_google_sheet.py
```

## Comment fonctionne la sync Sheets

Pour chaque nouveau message Messenger :

1. le backend classe le message
2. il repond au client si le mode humain n'est pas actif
3. il enregistre localement le contact, l'evenement et les KPI
4. il pousse ensuite dans Google Sheets :
   - le contact courant
   - la conversation courante
   - le message
   - le lead
   - un devis si besoin
   - un rendez_vous si besoin
   - le KPI du jour

## Deploiement

Commande utilisee :

```powershell
gcloud run deploy messenger-direct --source "D:\Travail\RAM'S FLARE\Flare Group\Flare AI\Antigravity\FLARE AI OS\V2\chatbot Facebook\direct_service" --region europe-west9 --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --platform managed --quiet
```

## Securite

- `META_APP_SECRET` doit etre rempli pour accepter les webhooks Messenger
- si `META_APP_SECRET` manque, le webhook est maintenant refuse
- `DASHBOARD_ACCESS_KEY` protege:
  - `/dashboard`
  - `/dashboard/internal`
  - `/dashboard/export.csv`
  - `/dashboard/export.json`
  - `/dashboard/contact-mode`
- le cockpit public passe par FLARE AI avec vue anonymisee pour les non-operateurs

## Suivi

- FLARE AI : cockpit chatbot operateur
- dashboard direct : troubleshooting interne seulement
- Telegram : escalades utiles + prise de relais manuelle
- SQLite : historique brut local

## Mode humain

Le service garde maintenant un etat `human_takeover` par contact.

Effet :

- `human_takeover = 0` -> l'agent continue de repondre
- `human_takeover = 1` -> l'agent ne repond plus a ce contact

Le changement se fait depuis Telegram avec :

- `Prendre le relais`
- `Laisser l'agent gérer`

Le dashboard affiche aussi le mode courant pour suivre les contacts repris a la main.

## Rotation recommandee

Comme plusieurs secrets ont ete manipules pendant l'installation :

- regenerer ensuite le token Messenger de page
- regenerer le token du bot Telegram si necessaire

## Evolutions deja capturees pour l'apres-review

Voir :

- [31-meta-review-kit.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/31-meta-review-kit.md)
- [32-meta-review-video-script.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/32-meta-review-video-script.md)
- [90-post-review-roadmap.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/90-post-review-roadmap.md)
