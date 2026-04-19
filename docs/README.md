# FLARE AI - Documentation centrale

Derniere mise a jour : 19 avril 2026

Ce dossier `docs` est le point d'entree documentaire du projet.

## Verite produit a date

FLARE AI n'est pas aujourd'hui une suite IA publique large.
La verite commercialisable actuelle est :

- `Chatbot Facebook` pour TPE et PME a Madagascar
- `paiement manuel local` (MVola / Orange Money)
- `activation assistee` par l'equipe FLARE
- `support humain local`

## Distribution supportee

La distribution produit suit maintenant cette matrice :

- Windows : application native via `Tauri`
- Android : application native via `APK` direct
- macOS : web / `PWA` seulement
- iPhone / iPad : web / `PWA` seulement
- aucun positionnement `App Store` ou `Play Store` dans la doc publique
- aucune promesse de store natif ne doit etre ajoutee dans les docs sans decision explicite

Tout le reste doit etre traite comme :

- soit `interne`
- soit `historique`
- soit `non vendu publiquement`

## Regle Git / agents (Windows - a appliquer systematiquement)

Si le clone vit sous un chemin contenant une apostrophe (ex. `FLARE AI`), le terminal integre peut planter avant d'executer `git`.
Pour tout `status` / `commit` / `push` en automation :

1. utiliser `git --git-dir / --work-tree` depuis un repertoire neutre
2. ou utiliser `scripts/render-deploy.ps1`

Reference : [instructions/DEVELOPER_GUIDE.md](instructions/DEVELOPER_GUIDE.md)

## Lire dans cet ordre

1. [Guide de reprise IA](handover/AI_DEV_HANDOVER.md)
2. [Statut produit et structure actuelle](handover/FLARE_APP_STATUS_2026-03-28.md)
3. [Readiness beta](handover/BETA_LAUNCH_READINESS_2026-04-12.md)
4. [Guide developpeur](instructions/DEVELOPER_GUIDE.md)
5. [Specification officielle v1 assistee](specs/launch/v1_2026-04-04_assisted_activation/README.md)

## Etat produit au 16 avril 2026

- la page publique vend explicitement une beta publique assistee centree sur le `Chatbot Facebook`
- apres connexion, l'app recentre le parcours principal sur `Accueil`, `Mon chatbot Facebook`, `Offre / Activation`, `Support / Parametres`
- `Chatbot Facebook` est le seul module metier vendu publiquement aujourd'hui
- les autres surfaces peuvent encore exister dans le code, mais elles ne doivent plus structurer la promesse publique
- le systeme d'espaces / organisations n'est plus le modele actif de l'app connectee vendue aujourd'hui
- la verification admin d'un paiement reste la seule source de verite pour appliquer le plan choisi au compte client

## Statut applicatif actuel

Pour comprendre rapidement comment le produit est organise aujourd'hui :

1. [FLARE app status - 2026-03-28](handover/FLARE_APP_STATUS_2026-03-28.md)
2. [Messenger direct live status - 2026-03-28](handover/MESSENGER_DIRECT_STATUS_2026-03-28.md)
3. [Messenger security audit - 2026-03-28](handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md)

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
`-- assets/            -> logos, captures, memoire visuelle
```

## Regles simples

- les `.env` actifs restent dans [backend](../backend) et [frontend](../frontend)
- on ne deplace pas les fichiers utilises par le code sans verifier les chemins
- toute nouvelle note de travail doit etre rangee dans `docs`, pas a la racine du projet
- si l'etat du produit change, mettre a jour la doc tout de suite

## Dossiers actifs du projet

- [backend](../backend)
- [frontend](../frontend)
- [docs](.)
- [scripts](../scripts)
- [_archive](../_archive)

## Messenger Direct

Pour le chatbot Facebook FLARE AI et son cockpit :

1. [Messenger direct sales flow](specs/MESSENGER_DIRECT_SALES_FLOW.md)
2. [Messenger direct system prompt](prompts/MESSENGER_DIRECT_SYSTEM_PROMPT.md)
3. [Messenger direct service README](../chatbot Facebook/direct_service/README.md)
4. [Messenger security audit - 2026-03-28](handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md)
5. [Messenger direct live status - 2026-03-28](handover/MESSENGER_DIRECT_STATUS_2026-03-28.md)

## Ce qu'il faut retenir maintenant

- le compte ouvre FLARE AI sans selection d'espace ni d'organisation
- le chatbot Facebook reste le premier et seul module metier vendu publiquement
- le plan actif et l'activation sont rattaches directement au compte utilisateur
- quand le paiement est valide, le plan choisi doit etre applique et visible cote client comme cote admin
- `Parametres > Identite` sert a gerer le profil, l'avatar et le nom de compte affiches dans l'app
- la distribution native est reservee a Windows via Tauri et Android via APK direct
- macOS et iPhone restent sur le web / PWA, sans cible de store natif

## Lancement v1 - beta assistee

Specification officielle de la version actuellement vendue :

- [Manuel interne d'exploitation beta assistee - 2026-04-12](handover/INTERNAL_ASSISTED_BETA_OPERATIONS_MANUAL_2026-04-12.md)
- [Checklist go-live beta demain - 2026-04-12](handover/BETA_TOMORROW_GO_LIVE_CHECKLIST_2026-04-12.md)
- [README v1 launch](specs/launch/v1_2026-04-04_assisted_activation/README.md)
- [Architecture finale](specs/launch/v1_2026-04-04_assisted_activation/01_FINAL_ARCHITECTURE.md)
- [Tunnel client](specs/launch/v1_2026-04-04_assisted_activation/02_CLIENT_FLOW.md)
- [Workflow operateur](specs/launch/v1_2026-04-04_assisted_activation/03_OPERATOR_FLOW.md)
- [Paiement manuel](specs/launch/v1_2026-04-04_assisted_activation/04_MANUAL_PAYMENTS.md)
- [Configuration chatbot et handoff](specs/launch/v1_2026-04-04_assisted_activation/05_CHATBOT_SETUP_AND_HANDOFF.md)
- [Commandes et dashboard](specs/launch/v1_2026-04-04_assisted_activation/06_ORDERS_AND_DASHBOARD.md)
- [API et modeles](specs/launch/v1_2026-04-04_assisted_activation/07_API_DATA_MODELS.md)
- [Wording et etats](specs/launch/v1_2026-04-04_assisted_activation/08_UI_WORDING_AND_STATES.md)
- [Tests d'acceptance](specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md)
- [Roadmap v2 post-lundi](specs/launch/v1_2026-04-04_assisted_activation/10_POST_LAUNCH_V2_SELF_SERVE.md)

Regle : ce dossier fait foi pour la version vendue aujourd'hui.

## Produit et besoins utilisateurs

Pour la vision entrepreneur et la liste des ameliorations a construire :

1. [Entrepreneur MG needs - 2026-03-28](specs/ENTREPRENEUR_MG_NEEDS_2026-03-28.md)
