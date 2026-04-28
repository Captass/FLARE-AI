# FLARE AI - Platform Accounts and Infrastructure Reference

Derniere mise a jour : 27 avril 2026

## Objet

Ce document centralise les informations d'identite projet, comptes visibles dans la configuration, services relies a FLARE AI, et URLs techniques utiles pour le developpement et l'exploitation.

Important :

- ce document ne doit pas contenir de secrets actifs
- ne pas y stocker de `client_secret`, `api_key`, `render_api_key`, ou mot de passe
- il sert uniquement de reference d'infrastructure et d'ownership

## Vue d'ensemble

FLARE AI repose actuellement sur :

- `Firebase Auth` pour l'authentification
- `Render` pour l'hebergement frontend, backend et base de donnees
- `Google Cloud OAuth` pour l'integration Gmail en cours

## Firebase

### Projet Firebase

- Projet : `rams-flare-ai`
- Auth domain : `rams-flare-ai.firebaseapp.com`
- Storage bucket : `rams-flare-ai.firebasestorage.app`
- Messaging sender ID : `461942823604`
- App ID : `1:461942823604:web:46b2d179d027b7849195e1`

### Compte associe documente

Le commentaire de configuration locale frontend indique :

- compte/projet local reference : `rijarandriamamonjisoa@gmail.com`

Statut :

- `probable`, car visible dans la config locale
- non confirme ici comme owner unique du projet Firebase

### Ou verifier dans la console

Dans Firebase Console :

1. ouvrir le projet `rams-flare-ai`
2. aller dans `Project settings`
3. verifier :
   - `Project ID`
   - `Web App`
   - `Authorized domains`
   - comptes ayant acces via IAM cote Google Cloud si besoin

## Google Cloud

### Projet Google Cloud visible dans le flux Gmail

- Projet visible dans la console OAuth : `FLARE AI OS`

Statut :

- `confirme` visuellement pendant la configuration OAuth Gmail

### Integration Gmail

L'integration Gmail V1 repose sur :

- OAuth client type : `Web application`
- Redirect URI local : `http://localhost:8000/api/gmail/callback`
- Scope : `https://www.googleapis.com/auth/gmail.readonly`

Important :

- une application Gmail non verifiee peut fonctionner pour un usage limite
- pour une diffusion publique plus large, la verification Google sera probablement necessaire

### Ou verifier dans la console

Dans Google Cloud Console :

1. `Google Auth Platform`
2. `Branding`
3. `Audience`
4. `Clients`
5. `Data Access`

Verifier particulierement :

- le nom du projet actif
- les emails de support
- les `test users` si l'app est en mode test
- le `client ID` OAuth
- les redirect URIs autorises

## Render

### Services Render documentes

- Frontend static site : `flare-frontend`
- Backend web service : `flare-backend`
- Database PostgreSQL : `flare-db`

### URLs Render / production

- Frontend public : `https://flareai.ramsflare.com`
- Alias Firebase historique : `https://rams-flare-ai.web.app`
- Backend Render actuel : `https://flare-backend-ab5h.onrender.com`

### Statut d'hebergement

L'hebergement actif documente est :

- `Render` pour frontend, backend, base de donnees

Ancienne infrastructure documentee mais obsolete :

- Firebase Hosting
- Cloud Run
- Cloud SQL

### Ou verifier dans Render

Dans le dashboard Render :

1. service `flare-frontend`
2. service `flare-backend`
3. base `flare-db`
4. `Environment`
5. `Settings`
6. `Deploys`

### Email owner Render

Statut :

- `non documente explicitement` dans les fichiers verifies

Ne pas supposer qu'il s'agit du meme email que Firebase sans verification directe dans le dashboard Render.

## Emails visibles dans le projet

### Emails explicitement visibles

- `rijarandriamamonjisoa@gmail.com`
- `cptskevin@gmail.com`

### Interpretation actuelle

- `rijarandriamamonjisoa@gmail.com`
  - visible dans la configuration locale frontend
  - probablement lie au projet/config Firebase

- `cptskevin@gmail.com`
  - visible dans la documentation comme compte admin FLARE
  - utilise comme email admin applicatif documente

### Ce que cela ne prouve pas

Ces emails ne confirment pas automatiquement :

- l'owner unique Firebase
- l'owner unique Google Cloud
- l'owner unique Render

Ces ownerships doivent etre verifies dans les consoles concernes.

## Administration applicative

La documentation du projet mentionne explicitement :

- compte admin applicatif : `cptskevin@gmail.com`

Usage documente :

- acces au panneau `Administration` dans l'application FLARE AI

## Fichiers sources de reference

Les informations de ce document proviennent principalement de :

- [render.yaml](</D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/render.yaml>)
- [frontend/.env.local](</D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/frontend/.env.local>)
- [backend/.env](</D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/backend/.env>)
- [docs/handover/FLARE_APP_STATUS_2026-03-28.md](</D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/docs/handover/FLARE_APP_STATUS_2026-03-28.md>)
- [docs/instructions/DEVELOPER_GUIDE.md](</D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/docs/instructions/DEVELOPER_GUIDE.md>)

## Recommandations

1. Maintenir ce document a jour des qu'un compte owner ou un projet change.
2. Ajouter ici uniquement des references d'infrastructure, jamais des secrets.
3. Verifier manuellement les owners dans :
   - Firebase Console
   - Google Cloud Console
   - Render Dashboard
4. Si un secret a ete expose dans un fichier local ou partage, le rotater immediatement.
