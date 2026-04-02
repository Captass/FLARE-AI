# Staging Wizard Messenger - Separation et deploiement

Derniere mise a jour : 29 mars 2026

## But

Tester le wizard Messenger sans toucher `flareai.ramsflare.com` ni les utilisateurs live.

## Etat actuel

Aujourd'hui, le repo sait faire :

- un frontend local
- un backend local
- une production live

Il n'y a pas encore de staging dedie deja branche dans les fichiers actifs.

## Regle de securite

Pour ce chantier, ne pas tester sur :

- `https://flareai.ramsflare.com`
- `https://www.flareai.ramsflare.com`
- `https://ramsflare.web.app`
- `https://rams-flare-ai.web.app`

Tant que le staging n'est pas pret, ces domaines restent assimiles a la production.

## Ce qu'il faut separer

Chaque environnement doit avoir ses propres valeurs pour :

- frontend host
- backend URL
- messenger direct URL
- `APP_ENV`
- `NEXT_PUBLIC_APP_ENV`
- `META_VERIFY_TOKEN`
- `MESSENGER_DIRECT_DASHBOARD_KEY`
- `DASHBOARD_ACCESS_KEY`
- page Facebook de test ou page Facebook live

## Matrice minimale

### Development

- frontend : `http://localhost:3000`
- backend : `http://localhost:8000`
- direct service : `http://localhost:8081`
- page Facebook : page de test uniquement

### Staging

- frontend : `https://flareai-staging.<votre-domaine>`
- backend : `https://flare-backend-staging-<project>.run.app`
- direct service : `https://messenger-direct-staging-<project>.run.app`
- page Facebook : page de test dediee

### Production

- frontend : `https://flareai.ramsflare.com`
- backend : URL Cloud Run live
- direct service : URL Cloud Run live
- page Facebook : pages clients live

## Etape 1 - Preparer les fichiers d'environnement

Utiliser les exemples fournis :

- backend : [backend/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.staging.example)
- frontend : [frontend/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.staging.example)
- direct service : [chatbot Facebook/direct_service/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.staging.example)

Verifier surtout ces valeurs :

- `APP_ENV=staging`
- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_API_URL=https://flare-backend-staging-<project>.run.app`
- `BACKEND_URL=https://flare-backend-staging-<project>.run.app`
- `FRONTEND_URL=https://flareai-staging.<votre-domaine>`
- `MESSENGER_DIRECT_URL=https://messenger-direct-staging-<project>.run.app`
- `SERVICE_PUBLIC_URL=https://messenger-direct-staging-<project>.run.app`
- tokens et keys propres au staging

## Etape 2 - Deployer le backend staging

Exemple Cloud Run :

```powershell
gcloud run deploy flare-backend-staging `
  --source . `
  --region europe-west9 `
  --project <votre-projet> `
  --allow-unauthenticated `
  --set-env-vars APP_ENV=staging,FRONTEND_URL=https://flareai-staging.<votre-domaine>,BACKEND_URL=https://flare-backend-staging-<project>.run.app,MESSENGER_DIRECT_URL=https://messenger-direct-staging-<project>.run.app,META_VERIFY_TOKEN=flare-staging-verify-token `
  --quiet
```

Ensuite verifier :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check_service_health.ps1 -Url https://flare-backend-staging-<project>.run.app/health
```

La reponse doit contenir :

- `status: ok`
- `service: flare-backend`
- `environment: staging`

## Etape 3 - Deployer le service Messenger direct staging

Deployer un service dedie, pas une revision du live.

Verifier obligatoirement :

- `APP_ENV=staging`
- `SERVICE_PUBLIC_URL`
- `FLARE_CHAT_URL=https://flare-backend-staging-<project>.run.app/chat`
- `DASHBOARD_ACCESS_KEY`
- `META_VERIFY_TOKEN`
- page Facebook de test

Puis verifier :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check_service_health.ps1 -Url https://messenger-direct-staging-<project>.run.app/health
```

La reponse doit contenir :

- `status: ok`
- `service: messenger-direct`
- `environment: staging`

## Etape 4 - Construire le frontend staging

Le frontend est un export statique. Il doit etre build avec l'URL de backend staging.

Commande recommandee :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_frontend_env.ps1 -Environment staging -ApiUrl https://flare-backend-staging-<project>.run.app
```

Important :

- si `NEXT_PUBLIC_API_URL` n'est pas defini, un host preview inconnu retombera sur `:8000`
- il faut donc toujours builder le preview avec `NEXT_PUBLIC_API_URL`

## Etape 5 - Deployer le frontend staging

Deux options sures :

1. un site Firebase Hosting dedie staging
2. un sous-domaine preview distinct de la prod

Exemple Firebase Hosting cible dediee :

```powershell
firebase target:apply hosting flareai-staging <votre-site-staging>
firebase deploy --only hosting:flareai-staging --project <votre-projet-staging>
```

Ne pas reutiliser le target de production pour ce test.

## Etape 6 - Verifier le chainage avant Meta

Avant tout test Facebook :

1. ouvrir le frontend staging
2. se connecter
3. verifier que le dashboard charge
4. verifier que le wizard apparait si le setup n'est pas complete
5. verifier que les appels API partent bien vers le backend staging

## Etape 7 - Test manuel Messenger en staging

Utiliser uniquement :

- une organisation de test
- une page Facebook de test
- un compte Facebook testeur

Checklist :

1. ouvrir l'organisation de test
2. voir le wizard
3. lancer OAuth Facebook
4. recuperer la ou les pages
5. activer une page de test
6. enregistrer les preferences chatbot
7. verifier que le setup passe a `complete`
8. envoyer un vrai message Messenger a la page de test
9. verifier que la reponse suit le nom, le ton et les offres configurees
10. verifier que la prod n'a pas ete touchee

## Etape 8 - Promotion vers la production

La promotion n'est autorisee qu'apres :

- smoke checks backend et direct service OK
- wizard frontend OK
- test Messenger reel OK
- verification que les pages live n'ont pas ete reutilisees

Ensuite seulement :

1. copier les variables de production depuis les exemples production
2. builder le frontend avec `NEXT_PUBLIC_APP_ENV=production`
3. deployer backend prod
4. deployer direct service prod
5. deployer frontend prod

## Fichiers relies a cette separation

- [backend/core/config.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/core/config.py)
- [backend/main.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/main.py)
- [backend/.env.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.example)
- [backend/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.staging.example)
- [backend/.env.production.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.production.example)
- [frontend/.env.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.example)
- [frontend/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.staging.example)
- [frontend/.env.production.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.production.example)
- [chatbot Facebook/direct_service/.env.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.example)
- [chatbot Facebook/direct_service/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.staging.example)
- [chatbot Facebook/direct_service/.env.production.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.production.example)
- [scripts/build_frontend_env.ps1](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/scripts/build_frontend_env.ps1)
- [scripts/check_service_health.ps1](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/scripts/check_service_health.ps1)
