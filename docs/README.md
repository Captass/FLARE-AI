# FLARE AI - Documentation centrale

Derniere mise a jour : 4 avril 2026

Ce dossier `docs` est le point d'entree documentaire du projet.

## Regle Git / agents (Windows — a appliquer systematiquement)

Si le clone vit sous un chemin contenant une apostrophe (ex. `FLARE AI`), le terminal integre peut ** planter avant d'executer `git`**. Pour tout `status` / `commit` / `push` en automation (agent IA, script CI local) lorsque le `cd` vers le repo echoue :

1. Utiliser **`git --git-dir` / `--work-tree`** depuis un repertoire neutre (ex. `C:\Windows\System32`), comme documente pas a pas dans [instructions/DEVELOPER_GUIDE.md](instructions/DEVELOPER_GUIDE.md) (section **Deploiement**, **Technique Git**).
2. En alternative : script [scripts/render-deploy.ps1](../scripts/render-deploy.ps1) a la racine du depot.

Le but est simple :

- retrouver vite les bonnes informations
- eviter de reflechir trop longtemps avant d'agir
- permettre a une autre IA de dev de reprendre le projet sans perdre le contexte

## Etat produit au 28 mars 2026

- la page publique affiche la landing FLARE AI avant connexion
- apres connexion, l'app ouvre un accueil simple qui sert a choisir un espace
- `Chatbot Facebook` est le module metier principal aujourd'hui
- `Assistant IA` reste disponible comme espace de travail separe
- `Automatisations` et les autres agents non prets restent visibles mais verrouilles honnetement
- chaque compte peut travailler dans son espace personnel ou dans une organisation partagee
- le choix d'organisation se fait apres connexion quand un compte partage plusieurs espaces
- un compte connecte peut maintenant creer son propre workspace FLARE depuis l'app, puis ouvrir directement `Chatbot Facebook`
- chaque organisation peut afficher son propre nom, logo, offre et modules actifs
- les droits suivent maintenant le role dans l'organisation : `Proprietaire`, `Admin`, `Membre`, `Lecture`
- l'identite visuelle de l'espace actif se regle dans `Parametres > Identite`
- pour le cockpit chatbot, seuls `Proprietaire` et `Admin` peuvent connecter Facebook, activer le bot, modifier la personnalisation et changer le mode bot/humain d'un contact
- les KPI, conversations et messages du dashboard chatbot proviennent du service `messenger-direct` et peuvent etre restreints selon le role du compte
- le dashboard chatbot embarque maintenant un graph temps reel anime, branche sur `periodStats` avec fallback sur l'activite recente quand les periodes sont encore peu remplies

## Lire dans cet ordre

1. [Guide de reprise IA](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/AI_DEV_HANDOVER.md)
2. [Guide de demarrage](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/START.md)
3. [Guide developpeur](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/instructions/DEVELOPER_GUIDE.md)
4. [Environnement et .env](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/ENVIRONMENT.md)
5. [Staging et separation des environnements](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/setup/STAGING_WIZARD_DEPLOYMENT.md)
6. [Taches](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/instructions/TASKS.md)
7. [Versions](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/instructions/VERSIONS.md)

## Statut applicatif actuel

Pour comprendre rapidement comment le produit est organise aujourd'hui :

1. [FLARE app status - 2026-03-28](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/FLARE_APP_STATUS_2026-03-28.md)
2. [Messenger direct live status - 2026-03-28](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_DIRECT_STATUS_2026-03-28.md)
3. [Messenger security audit - 2026-03-28](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md)

## Organisation du workspace

Pour retrouver vite les bons dossiers et savoir ou ranger les artefacts :

1. [Workspace structure](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/instructions/WORKSPACE_STRUCTURE.md)

## Structure du dossier docs

```text
docs/
|-- README.md
|-- architecture/      -> architecture, cartes projet, notes techniques
|-- handover/          -> reprise projet, synchronisation, notes de continuite
|-- instructions/      -> guides de travail, taches, versions, regles de dev
|-- prompts/           -> prompts systeme et documents lies aux prompts
|-- setup/             -> demarrage, deploiement, environnement, .env
|-- specs/             -> specifications produit et formats
`-- assets/            -> logos, captures, musiques, memoire visuelle
```

## Regles simples

- Les `.env` actifs restent dans [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend) et [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend).
- On ne deplace pas les fichiers utilises par le code sans verifier les chemins.
- Toute nouvelle note de travail doit etre rangee dans `docs`, pas a la racine du projet.
- Si l'etat du produit change, mettre a jour la doc tout de suite.

## Dossiers actifs du projet

- [backend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/backend)
- [frontend](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/frontend)
- [docs](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs)
- [scripts](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/scripts)
- [_archive](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/_archive)

## A retenir

Si une autre IA de dev ouvre le projet, elle doit commencer par :

1. lire ce `README`
2. lire le guide de reprise
3. lire le guide de demarrage
4. verifier les `.env` actifs
5. seulement ensuite coder ou deployer

## Messenger Direct

Pour le chatbot Facebook FLARE AI et son cockpit dans FLARE AI :

1. [Messenger direct sales flow](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/specs/MESSENGER_DIRECT_SALES_FLOW.md)
2. [Messenger direct system prompt](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/prompts/MESSENGER_DIRECT_SYSTEM_PROMPT.md)
3. [Messenger direct service README](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/README.md)
4. [Messenger security audit - 2026-03-28](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md)
5. [Messenger direct live status - 2026-03-28](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_DIRECT_STATUS_2026-03-28.md)
6. [Messenger direct live status - 2026-03-27](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_DIRECT_STATUS_2026-03-27.md)

## Ce qu'il faut retenir maintenant

- le compte ouvre FLARE, puis l'utilisateur choisit l'espace a utiliser
- le chatbot Facebook reste le premier espace metier a ouvrir pour piloter les ventes entrantes
- les actions sensibles du chatbot restent plus strictes que les simples roles d'organisation
- `Parametres > Identite` sert a verifier rapidement quel espace est charge, quel branding est actif et qui peut le modifier

## Lancement v1 - 4 avril 2026

Specification officielle de la version de lancement lundi :

- [Manuel interne d'exploitation beta assistee - 2026-04-12](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/FLARE%20AI/docs/handover/INTERNAL_ASSISTED_BETA_OPERATIONS_MANUAL_2026-04-12.md)
- [Checklist go-live beta demain - 2026-04-12](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/FLARE%20AI/docs/handover/BETA_TOMORROW_GO_LIVE_CHECKLIST_2026-04-12.md)

1. [README v1 launch](specs/launch/v1_2026-04-04_assisted_activation/README.md)
2. [Architecture finale](specs/launch/v1_2026-04-04_assisted_activation/01_FINAL_ARCHITECTURE.md)
3. [Tunnel client](specs/launch/v1_2026-04-04_assisted_activation/02_CLIENT_FLOW.md)
4. [Workflow operateur](specs/launch/v1_2026-04-04_assisted_activation/03_OPERATOR_FLOW.md)
5. [Paiement manuel](specs/launch/v1_2026-04-04_assisted_activation/04_MANUAL_PAYMENTS.md)
6. [Configuration chatbot et handoff](specs/launch/v1_2026-04-04_assisted_activation/05_CHATBOT_SETUP_AND_HANDOFF.md)
7. [Commandes et dashboard](specs/launch/v1_2026-04-04_assisted_activation/06_ORDERS_AND_DASHBOARD.md)
8. [API et modeles](specs/launch/v1_2026-04-04_assisted_activation/07_API_DATA_MODELS.md)
9. [Wording et etats](specs/launch/v1_2026-04-04_assisted_activation/08_UI_WORDING_AND_STATES.md)
10. [Tests d'acceptance](specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md)
11. [Roadmap v2 post-lundi](specs/launch/v1_2026-04-04_assisted_activation/10_POST_LAUNCH_V2_SELF_SERVE.md)

**Regle** : ce dossier fait foi pour la version vendue lundi.

## Produit et besoins utilisateurs

Pour la vision entrepreneur et la liste des ameliorations a construire :

1. [Entrepreneur MG needs - 2026-03-28](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/specs/ENTREPRENEUR_MG_NEEDS_2026-03-28.md)
