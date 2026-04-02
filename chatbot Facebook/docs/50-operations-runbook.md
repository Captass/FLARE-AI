# Operations Runbook

## Verifications rapides

1. ouvrir `/health`
2. ouvrir `/dashboard`
3. envoyer un message test sur Messenger
4. verifier Telegram seulement si le test est un devis, un rendez-vous, une commande ou un blocage
5. verifier la trace dans le dashboard

## URLs d'exploitation

- Health : `https://messenger-direct-236458687422.europe-west9.run.app/health`
- Dashboard : `https://messenger-direct-236458687422.europe-west9.run.app/dashboard`
- Privacy policy : `https://messenger-direct-236458687422.europe-west9.run.app/privacy-policy`

## Reference Meta

- Callback URL : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- Verify token : `ramsflare_webhook_2026`

## Si Meta ne valide plus

Verifier :

- Callback URL correcte
- Verify token correct
- service live accessible
- endpoint `/webhook/facebook` repondant au challenge

## Si Messenger ne repond plus

Verifier :

- token de page Facebook encore valide
- `GOOGLE_API_KEY` encore valide
- modele Gemini encore disponible
- Telegram encore fonctionnel
- revision Cloud Run encore active

## Si l'IA repond mal

Verifier :

- le prompt dans [app.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/app.py)
- le modele configure dans [runtime_config.json](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/runtime_config.json)
- les tokens, couts et latences dans le dashboard
- si l'agent escalade bien vers un responsable pour devis, rendez-vous ou blocage

## Si Telegram ne notifie plus

Verifier :

- bot token
- chat id
- droits du bot dans le chat ou groupe
- se rappeler que Telegram est volontairement conditionnel
- tester avec un message de devis ou de rendez-vous

## Pendant la review Meta

Ne pas changer :

- l'URL du webhook
- le verify token
- la logique visible dans la video
- la permission soumise
- la Page reviewer

## Juste apres approbation Meta

Faire dans cet ordre :

1. verifier que `pages_messaging` est bien approuvee
2. refaire un test Messenger reel
3. verifier le dashboard
4. verifier Telegram
5. faire tourner l'`App Secret` Meta
6. mettre a jour [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env)
7. mettre a jour [runtime_config.json](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/runtime_config.json)
8. redeployer le service
9. refaire un test Messenger complet apres rotation
