# Handover pour une autre IA de dev

Dernière mise à jour : 2 avril 2026

Ce document sert de reprise rapide si FLARE AI est repris par une autre IA de développement.

## Le projet en une phrase

FLARE AI est une application IA web avec un chat central, de la mémoire, une base de connaissances, des agents, la génération d'images, de vidéos, de documents Word et de fichiers Excel.

## Ce qui compte le plus

- backend prioritaire
- stabilité avant tout
- l'app doit rester utilisable en production
- les traces écrites doivent être tenues à jour

## Où commencer

1. lire [docs/README.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/README.md)
2. lire [docs/setup/START.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/setup/START.md)
3. lire [docs/setup/ENVIRONMENT.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/setup/ENVIRONMENT.md)
4. lire [docs/instructions/DEVELOPER_GUIDE.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/instructions/DEVELOPER_GUIDE.md)
5. vérifier [docs/instructions/TASKS.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/instructions/TASKS.md)

## Git depuis un agent / terminal intégré (Windows)

Le dépôt est souvent sous un chemin du type `...\FLARE AI\...`. Le shell intégré (Cursor, etc.) peut alors **échouer avant d’exécuter `git`**. **À chaque automation** (`status`, `commit`, `push`) : appliquer la technique **`git --git-dir` / `--work-tree`** depuis un répertoire neutre, décrite dans [docs/instructions/DEVELOPER_GUIDE.md](../instructions/DEVELOPER_GUIDE.md) (section Déploiement). Alternative : `scripts/render-deploy.ps1` à la racine du repo.

## Dossiers utiles

- [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/backend)
- [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/frontend)
- [docs](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs)
- [scripts](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/scripts)
- [_archive](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/_archive)

## Dossiers à ne pas casser

- [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/backend)
- [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/frontend)
- fichiers `.env` actifs dans backend et frontend

## Bon réflexe de travail

Avant de dire qu'une fonction marche :

1. vérifier le code
2. build ou compiler
3. déployer si besoin
4. tester en vrai
5. mettre à jour la documentation

## Bon réflexe de rangement

- nouvelle note produit -> `docs/specs/`
- nouvelle note architecture -> `docs/architecture/`
- nouvelle note de reprise -> `docs/handover/`
- nouvelle instruction de travail -> `docs/instructions/`
- nouvelle note environnement / déploiement -> `docs/setup/`

## Ce qu'il faut laisser à chaque passage

- ce qui a été changé
- ce qui a été déployé
- ce qui reste à faire
- où regarder si quelque chose casse

## Si tu dois reprendre vite

Lis d'abord :

- [docs/README.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/README.md)
- [docs/setup/START.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/setup/START.md)
- [docs/handover/DEV_SYNC.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/handover/DEV_SYNC.md)
- [docs/instructions/TASKS.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare AI/Antigravity/FLARE AI OS/V2/docs/instructions/TASKS.md)
