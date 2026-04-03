# START - Demarrage rapide FLARE AI

Derniere mise a jour : 29 mars 2026

## Objectif

Ce fichier sert a redemarrer vite le projet sans chercher partout.

## Regle immediate

Ne pas tester le nouveau wizard Messenger sur `https://flareai.ramsflare.com` tant qu'un staging dedie n'a pas ete prepare.

## URLs utiles

- Frontend principal : [https://flareai.ramsflare.com](https://flareai.ramsflare.com)
- Frontend Firebase : [https://rams-flare-ai.web.app](https://rams-flare-ai.web.app)
- Backend actuellement pointe par le frontend local : `https://flare-backend-ynhuvwocwq-ew.a.run.app`

## Dossiers a utiliser

- Backend : [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend)
- Frontend : [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend)
- Documentation : [docs](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs)

## Verifier les .env avant tout

Lire :

- [docs/setup/ENVIRONMENT.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/ENVIRONMENT.md)
- [docs/setup/STAGING_WIZARD_DEPLOYMENT.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/STAGING_WIZARD_DEPLOYMENT.md)

## Build rapide

### Frontend

Depuis [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend) :

```powershell
npm run build
```

### Backend

Depuis [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend) :

```powershell
python -m py_compile main.py
```

## Deploiement

**Production actuelle (2026-04) :** Render — `git push` sur `main` declenche les builds. Details, DNS et variables : [docs/instructions/DEVELOPER_GUIDE.md](../instructions/DEVELOPER_GUIDE.md).

**Git depuis un agent / terminal integre (chemin `FLARE AI`) :** si `cd` ou `git` echouent sans raison, utiliser **`git --git-dir` / `--work-tree`** depuis un repertoire neutre — procedure obligatoire documentee dans le meme **DEVELOPER_GUIDE** (section Deploiement, Windows). Script optionnel : `scripts/render-deploy.ps1`.

### Ancien flux (obsolete pour la prod courante — ne plus utiliser)

**Frontend (Firebase Hosting — obsolete)**

```powershell
# firebase deploy --only hosting --project rams-flare-ai
```

**Backend (Cloud Run — obsolete)**

```powershell
# gcloud run deploy flare-backend --source . --region europe-west1 --project ramsflare --allow-unauthenticated --quiet
```

## Verification minimale apres deploiement

1. ouvrir le site
2. se connecter
3. envoyer un message simple
4. generer une image
5. verifier `Fichiers`
6. verifier `Memoire`
7. verifier qu'une image s'ouvre bien en previsualisation

Pour le wizard Messenger, utiliser la checklist staging du guide dedie.

## Lecture recommandee ensuite

- [docs/handover/AI_DEV_HANDOVER.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/AI_DEV_HANDOVER.md)
- [docs/instructions/DEVELOPER_GUIDE.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/instructions/DEVELOPER_GUIDE.md)
- [docs/instructions/TASKS.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/instructions/TASKS.md)
