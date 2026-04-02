# Security And Secrets

## Secrets en jeu

- Meta verify token
- Meta page access token
- Meta app secret
- Telegram bot token
- Telegram chat id
- Google API key
- Google service account JSON

## Fichier principal

- [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env)

## Bonnes pratiques

- ne pas versionner `.env`
- utiliser [`.env.example`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.example) comme modele
- regulierement faire tourner les tokens si besoin
- ne jamais partager l'`App Secret` Meta dans une conversation ou une capture
- ne pas reutiliser la meme cle Google API pour plusieurs agents si le suivi des couts compte

## Etat actuel

- `META_APP_SECRET` configure
- verification de signature Meta active dans le service
- l'`App Secret` a ete expose pendant le setup et doit donc etre remplace apres la review

## Action recommandee

Apres la decision Meta :

1. regenerer l'`App Secret` dans Meta
2. mettre a jour [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env)
3. mettre a jour [runtime_config.json](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/runtime_config.json)
4. redeployer le service
5. refaire un test Messenger complet
