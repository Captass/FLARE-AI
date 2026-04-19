# Handover pour une autre IA de dev

Derniere mise a jour : 19 avril 2026

Ce document sert de reprise rapide si FLARE AI est repris par une autre IA de developpement.

## Le projet en une phrase

FLARE AI est aujourd'hui une application SaaS orientee `chatbot Facebook assiste` pour les TPE et PME de Madagascar, avec paiement manuel local, activation operee par l'equipe FLARE, Windows native via `Tauri`, Android native via `APK` direct, et web / `PWA` pour macOS et iPhone.

## Ce qui compte le plus

- backend prioritaire
- stabilite avant tout
- l'app doit rester utilisable en production
- la verite produit publique doit rester etroite et exacte
- les traces ecrites doivent etre tenues a jour
- la distribution native vise Windows et Android uniquement
- macOS et iPhone restent sur le web / `PWA`, sans cible de store

## Ce qu'il ne faut plus supposer par defaut

Ne repars pas du principe que FLARE AI est actuellement une suite publique large avec :

- assistant IA vendu publiquement
- memoire / knowledge base comme coeur produit
- agents metier publics
- generation d'images / videos / Word / Excel vendue
- self-serve Meta complet
- positionnement `App Store` ou `Play Store`

Ces surfaces peuvent encore exister dans le code, mais elles ne definissent pas la beta publique actuelle.

## Ou commencer

1. lire [docs/README.md](../README.md)
2. lire [docs/handover/FLARE_APP_STATUS_2026-03-28.md](FLARE_APP_STATUS_2026-03-28.md)
3. lire [docs/handover/BETA_LAUNCH_READINESS_2026-04-12.md](BETA_LAUNCH_READINESS_2026-04-12.md)
4. lire [docs/instructions/DEVELOPER_GUIDE.md](../instructions/DEVELOPER_GUIDE.md)
5. lire la spec de lancement [docs/specs/launch/v1_2026-04-04_assisted_activation/README.md](../specs/launch/v1_2026-04-04_assisted_activation/README.md)

## Git depuis un agent / terminal integre (Windows)

Le depot peut echouer avant meme d'executer `git` si le chemin contient une apostrophe.
A chaque automation (`status`, `commit`, `push`) :

- utiliser la technique `git --git-dir / --work-tree`
- ou utiliser `scripts/render-deploy.ps1`

Reference : [docs/instructions/DEVELOPER_GUIDE.md](../instructions/DEVELOPER_GUIDE.md)

## Dossiers utiles

- [backend](../../backend)
- [frontend](../../frontend)
- [docs](..)
- [scripts](../../scripts)
- [_archive](../../_archive)

## Dossiers a ne pas casser

- [backend](../../backend)
- [frontend](../../frontend)
- fichiers `.env` actifs dans backend et frontend

## Bon reflexe de travail

Avant de dire qu'une fonction marche :

1. verifier le code
2. build ou compiler
3. deployer si besoin
4. tester en vrai
5. mettre a jour la documentation

## Ce qu'il faut laisser a chaque passage

- ce qui a ete change
- ce qui a ete deploye
- ce qui reste a faire
- ou regarder si quelque chose casse

## Si tu dois reprendre vite

Lis d'abord :

- [docs/README.md](../README.md)
- [docs/handover/INTERNAL_ASSISTED_BETA_OPERATIONS_MANUAL_2026-04-12.md](INTERNAL_ASSISTED_BETA_OPERATIONS_MANUAL_2026-04-12.md)
- [docs/handover/BETA_LAUNCH_READINESS_2026-04-12.md](BETA_LAUNCH_READINESS_2026-04-12.md)
- [docs/specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md](../specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md)
