# Cloud Run Deployment

## Service actif

- service : `messenger-direct`
- region : `europe-west9`
- projet : `ramsflare`
- revision live au 26 mars 2026 : `messenger-direct-00017-nc2`
- modele IA : `gemini-2.5-flash-lite`

## URL active

- `https://messenger-direct-236458687422.europe-west9.run.app`

## Commande de deploiement

```powershell
gcloud run deploy messenger-direct --source "D:\Travail\RAM'S FLARE\Flare Group\Flare AI\Antigravity\FLARE AI OS\V2\chatbot Facebook\direct_service" --region europe-west9 --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --platform managed --quiet
```

## Fichiers utiles

- [Dockerfile](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/Dockerfile)
- [app.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/app.py)
- [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env)

## Redeploiement

Redeployer apres tout changement sur :

- variables sensibles
- logique Messenger
- logique Telegram
- logique Gemini ou prompt
- verification Meta

## Verification rapide apres deploy

1. ouvrir `/health`
2. ouvrir `/dashboard`
3. envoyer un message test simple
4. envoyer un message test de devis ou rendez-vous
5. verifier que Telegram n'alerte que sur le cas utile
