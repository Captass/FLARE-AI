# Environnement et fichiers .env

Derniere mise a jour : 29 mars 2026

## Regle importante

Les fichiers `.env` actifs ne doivent pas etre deplaces.
Ils sont utilises directement par le code.

## Fichiers actifs et exemples

- [backend/.env](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env)
- [backend/.env.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.example)
- [backend/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.staging.example)
- [backend/.env.production.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend/.env.production.example)
- [frontend/.env.local](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.local)
- [frontend/.env.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.example)
- [frontend/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.staging.example)
- [frontend/.env.production.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend/.env.production.example)
- [chatbot Facebook/direct_service/.env.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.example)
- [chatbot Facebook/direct_service/.env.staging.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.staging.example)
- [chatbot Facebook/direct_service/.env.production.example](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env.production.example)

## Role de chaque fichier

### Backend

- `.env`
  Fichier actif local pour le backend.
- `.env.local`
  Surcharge locale optionnelle chargee apres `.env` sans ecraser les vraies variables deja injectees dans l'environnement systeme.
- `.env.example`
  Modele local development.
- `.env.staging.example`
  Modele pour un backend de staging.
- `.env.production.example`
  Modele pour un backend de production.

### Frontend

- `.env.local`
  Fichier actif local pour le frontend.
- `.env.example`
  Modele local development.
- `.env.staging.example`
  Valeurs a injecter au build du frontend staging.
- `.env.production.example`
  Valeurs a injecter au build du frontend live.

### Messenger Direct

- `.env.example`
  Modele local du service direct.
- `.env.staging.example`
  Modele de staging du service direct.
- `.env.production.example`
  Modele de production du service direct.

## Variables importantes a connaitre

### Backend

- `APP_ENV`
- `FRONTEND_URL`
- `BACKEND_URL`
- `DATABASE_URL`
- `MESSENGER_DIRECT_URL`
- `MESSENGER_DIRECT_DASHBOARD_KEY`
- `META_VERIFY_TOKEN`

### Frontend

- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_API_URL`
- variables publiques Firebase

### Messenger Direct

- `APP_ENV`
- `SERVICE_PUBLIC_URL`
- `FLARE_CHAT_URL`
- `DASHBOARD_ACCESS_KEY`
- `META_VERIFY_TOKEN`

## Verification rapide avant de lancer le projet

### Backend

Depuis [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend) :

```powershell
python -m py_compile main.py
```

### Frontend

Depuis [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend) :

```powershell
npm run build
```

## Regle pour une autre IA de dev

Avant toute modification :

1. lire ce fichier
2. verifier quels `.env` sont actifs
3. ne pas deplacer les `.env`
4. ne jamais committer de secrets par erreur

## Regle staging / production

Le wizard Messenger ne doit pas etre teste directement sur `flareai.ramsflare.com`.

Avant tout test externe :

1. preparer un frontend staging
2. preparer un backend staging
3. preparer un service Messenger direct staging
4. utiliser une page Facebook de test dediee

Guide detaille :

- [docs/setup/STAGING_WIZARD_DEPLOYMENT.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/STAGING_WIZARD_DEPLOYMENT.md)
