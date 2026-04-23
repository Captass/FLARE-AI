# Messenger Direct Service

Solution directe sans n8n pour Facebook Messenger.

## URL publique

- Service: `https://messenger-direct-236458687422.europe-west9.run.app`
- Webhook de compatibilite / relay: `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- Health: `https://messenger-direct-236458687422.europe-west9.run.app/health`

Le dashboard direct n'est plus un point d'entree public.
Le cockpit operateur passe maintenant par FLARE AI.
Le webhook Meta principal doit pointer vers le backend FLARE AI quand c'est possible.

## Regle de test

Ne pas reutiliser le service live pour le wizard Messenger tant qu'un staging dedie n'a pas ete prepare.
Le guide a suivre est :

- [docs/setup/STAGING_WIZARD_DEPLOYMENT.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/STAGING_WIZARD_DEPLOYMENT.md)

## Comment il s'utilise aujourd'hui

Le parcours normal est maintenant le suivant :

1. ouvrir `https://flareai.ramsflare.com`
2. passer par la landing publique si l'utilisateur n'est pas connecte
3. ouvrir l'application FLARE AI apres connexion
4. choisir l'espace actif si le compte a acces a une organisation partagee
5. choisir `Chatbot Facebook` depuis l'accueil
6. piloter le bot depuis `Vue d'ensemble`, `Clients chauds`, `Discussions` et `Budget`

Le service direct reste derriere, mais il ne sert plus de surface produit principale.

## Ce que fait le service

1. verifie le webhook Meta ou relaie proprement vers le backend FLARE AI
2. recoit les messages Messenger
3. privilegie le backend FLARE AI pour les reponses et preferences page-specifiques
4. garde un traitement local de secours seulement si le contexte page est complet
5. enregistre les contacts, events, tokens, couts et latences en SQLite
6. synchronise automatiquement Google Sheets pour les contacts, conversations, messages, leads, devis, rendez-vous et KPI journaliers
7. archive aussi les events sur 24h dans Google Cloud Storage
8. notifie Telegram seulement en cas utile
9. permet de basculer un contact en mode humain ou de rendre la main a l'agent depuis Telegram ou le dashboard

## Suivi

- ouvre FLARE AI pour le cockpit chatbot
- surveille Telegram pour les escalades
- utilise le bouton Telegram pour `Prendre le relais` ou `Laisser l'agent gerer`
- garde le dashboard direct comme surface interne de troubleshooting seulement

## Donnees

- base locale Cloud Run / SQLite integree au service
- Google Cloud Storage pour l'archive recente et les cumuls
- Google Sheets comme base metier stable

## Configuration

- `.env` : configuration principale a garder hors git
- `runtime_config.json` : fallback legacy
- `DEVELOPER_GUIDE.md` : documentation technique complete
- `bootstrap_google_sheet.py` : prepare les onglets Google Sheets si besoin
- `sheet_template.xlsx` : classeur pret a importer dans Google Sheets
