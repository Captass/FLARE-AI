# Current Status

## Etat reel au 26 mars 2026

La solution active est :

- un webhook Messenger direct sur Cloud Run
- une reponse IA directe via Google Gemini `gemini-2.5-flash-lite`
- un agent commercial multilingue RAM'S FLARE
- un dashboard web avec messages, tokens et couts
- une journalisation locale en SQLite
- une archive 24h dans Google Cloud Storage
- des notifications Telegram seulement en cas utile

FLARE AI n'est plus dans le chemin live des reponses Messenger.

## URLs live

- Service public : `https://messenger-direct-236458687422.europe-west9.run.app`
- Webhook Meta : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- Dashboard : `https://messenger-direct-236458687422.europe-west9.run.app/dashboard`
- Health : `https://messenger-direct-236458687422.europe-west9.run.app/health`
- Privacy policy : `https://messenger-direct-236458687422.europe-west9.run.app/privacy-policy`

## Comportement actuel

- reponses courtes, commerciales et adaptees a la langue du client
- RAM'S FLARE est presente comme agence de communication et maison de production audiovisuelle
- en cas de devis, rendez-vous, commande ou blocage, l'agent indique qu'un responsable sera prevenu
- dans ces cas, l'agent demande les coordonnees du client ou le detail ici ou par mail
- Telegram n'alerte plus pour chaque message
- le dashboard suit aussi les tokens et le cout estime en dollars
- le dashboard permet de telecharger les donnees en CSV ou JSON

## Limites actuelles

- la persistence reste en SQLite locale au service
- le dashboard est quasi live, pas une base distante centrale
- Google Sheets n'est pas encore branche en ecriture automatique

## Points sensibles

- garder stables `Callback URL` et `Verify token` tant que le setup Meta compte encore
- faire tourner l'`META_APP_SECRET` si besoin de securisation plus forte
- prevoir une base distante avant de compter sur un historique long terme
