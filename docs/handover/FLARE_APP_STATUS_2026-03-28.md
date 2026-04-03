# FLARE App Status - 2026-03-28

## URLs live

- public frontend: `https://flareai.ramsflare.com`
- firebase alias: `https://rams-flare-ai.web.app`
- backend: `https://flare-backend-236458687422.europe-west1.run.app` (voir **[docs/instructions/DEVELOPER_GUIDE.md](../instructions/DEVELOPER_GUIDE.md)** pour l’URL Render actuelle et le déploiement)

**Agents / Git Windows :** si le clone est sous un chemin avec apostrophe (`FLARE AI`), utiliser systématiquement la technique **`git --git-dir` / `--work-tree`** décrite dans le même **DEVELOPER_GUIDE** (section Déploiement).

## Parcours actuel

Le produit est organise en deux temps :

1. visiteur non connecte -> landing FLARE AI
2. utilisateur connecte -> application FLARE AI

La landing publique reste la vitrine marketing.
L'application connectee reste l'espace de travail.

## Update 2026-03-30

Le cockpit `Chatbot Facebook` a ete remonte autour d'un espace unique `Mon chatbot`.

## Update 2026-04-03

Le comportement d'activation du chatbot a ete simplifie pour le lancement :

- apres OAuth Meta, les pages sont seulement importees dans FLARE
- aucune page ne passe ON automatiquement
- l'utilisateur doit cliquer `Activer` pour demarrer le bot
- `Bot ON` signifie maintenant : page active + webhook branche + synchro direct service OK
- `Bot OFF` signifie : aucune reponse automatique envoyee sur Messenger
- une seule page peut etre ON par organisation ; activer une page coupe les autres

Le setup premiere connexion suit maintenant 3 etapes :

1. connexion et activation d'une page Facebook
2. identite rapide du bot
3. entreprise rapide avec produit ou service optionnel

Une fois le setup minimal termine, l'utilisateur complete le reste dans les onglets du cockpit.

Le wizard bloque maintenant le CTA Facebook si le backend ne declare pas l'OAuth Meta configure.
L'utilisateur voit un message d'indisponibilite avant clic, au lieu d'une erreur serveur apres clic.
`Continuer plus tard` quitte le wizard sans le marquer localement comme termine.

## Update 2026-03-31

La connexion Facebook production a ete remise en etat cote runtime :

- `flare-backend` et `messenger-direct` tournent en `production`
- Meta OAuth est configure cote backend
- le webhook Messenger direct repond correctement a la verification Meta
- le dialog OAuth Meta ouvre bien sur la page Facebook au lieu d'une erreur immediate

Le flow chatbot a aussi ete durci :

- seuls `owner` et `admin` peuvent connecter, activer ou deconnecter une page Facebook pour une organisation partagee
- le wizard setup ne se marque plus `complete` apres la seule etape identite
- apres reload, le wizard reprend l'etape `Identite` ou `Mon entreprise` au bon endroit
- seules les pages Facebook avec les droits Messenger requis sont importees depuis Meta
- l'activation d'une nouvelle page desactive les autres pages actives de la meme organisation
- fermer la popup OAuth sans terminer la connexion remonte maintenant une erreur claire dans l'UI
- le wizard et le cockpit `Mon chatbot` redemandent maintenant un token Firebase frais avant les actions Facebook et les sauvegardes critiques
- en cas de session FLARE non recuperable, l'UI vide l'etat Facebook stale et affiche un message de reconnexion plus clair au lieu de laisser une page visible avec un faux `Connexion requise`
- l'onglet `Statut` marque maintenant les cartes Facebook comme dernier etat connu tant qu'une verification fraiche n'a pas reussi apres une recuperation de session
- les etats vides Facebook rappellent maintenant qu'une page selectionnee peut etre ignoree si Meta ne fournit pas les droits `MANAGE` et `MESSAGING`
- l'onglet `Statut` reprend maintenant le meme banner de verification Facebook que le wizard, avec `Derniere verification` et un refresh manuel quand la propagation Meta n'est pas encore complete

Verification confirmee le 31 mars 2026 :

- `https://flareai.ramsflare.com` -> `200`
- `https://rams-flare-ai.web.app` -> `200`
- `https://flare-backend-236458687422.europe-west1.run.app/health` -> `{"status":"ok","service":"flare-backend","environment":"production"}`
- verification webhook Messenger direct -> `200`
- dialog OAuth Meta avec callback prod -> page Facebook chargee, pas d'erreur immediate `URL Blocked` / `code 191`

Reste a faire en QA manuelle :

- un vrai login utilisateur FLARE
- un vrai login Facebook/Meta dans la popup
- la selection d'une page reelle
- l'activation complete jusqu'a `webhook_subscribed=true` et `direct_service_synced=true`

Le blocage restant n'est plus l'infrastructure FLARE visible.
La validation finale demande maintenant un vrai compte Meta operateur pour terminer le bout en bout.

## Update 2026-03-31 - OAuth session recovery

Le frontend chatbot Facebook a ete redurci apres QA reelle :

- le wizard setup et le cockpit `Mon chatbot` recuperent maintenant un token Firebase frais avant les actions Facebook sensibles
- le retour popup OAuth Meta ne doit plus casser l'activation sur un faux `Connexion requise.` provoque par un bearer frontend transitoirement perdu
- la page principale recharge aussi le setup chatbot, l'organisation active et l'identite workspace via une resolution de token plus robuste
- l'UI nettoie mieux l'etat Facebook stale quand la session n'est pas recuperable
- le setup explique plus clairement qu'une page Meta selectionnee peut etre ignoree si Meta ne lui donne pas encore les droits Messenger requis

Verification technique faite :

- lint cible frontend chatbot/page -> OK, avec seulement les 2 warnings `<img>` historiques dans `page.tsx`
- `next build` frontend -> OK
- redeploiement Firebase Hosting -> OK
- `https://flareai.ramsflare.com` -> `200`
- `https://rams-flare-ai.web.app` -> `200`

Reste a valider en QA manuelle connectee :

- selection de plusieurs pages Meta avec un vrai compte
- confirmation que l'activation ne retombe plus sur `Connexion requise`
- confirmation que le message sur les pages filtrees est assez clair pour l'utilisateur final

## Update 2026-03-31

Le backend live `flare-backend` a ete repare pour le flux OAuth Facebook :

- `APP_ENV=production`
- `BACKEND_URL` pointe de nouveau vers l'URL publique Cloud Run
- la configuration Meta OAuth est rechargee en production
- le callback OAuth utilise maintenant une URL publique coherente meme si `BACKEND_URL` manque

Verification technique faite :

- `/health` retourne maintenant `environment: production`
- le dialogue Meta accepte les redirect URI backend live et ouvre la page de connexion Facebook

La derniere verification restante est une QA connectee reelle avec un vrai compte Facebook admin de page jusqu'au choix de page et a l'activation finale.

## Structure actuelle de l'app

Apres connexion, l'utilisateur arrive sur un accueil simple qui sert a choisir un espace :

- `Chatbot Facebook`
- `Assistant IA`
- `Automatisations`

Le menu lateral a ete volontairement vide pour alleger le parcours.
La navigation detaillee est ensuite propre a l'espace choisi.

Si le compte a acces a une ou plusieurs organisations partagees, FLARE ouvre ensuite un choix d'espace clair :

- compte personnel
- organisation partagee

Ce choix d'espace n'est plus un detail technique.
Il decide quelle offre, quels modules et quelle identite visuelle sont actifs dans l'app.

## Modules actifs

### 1. Chatbot Facebook

C'est le module metier principal aujourd'hui.
Il ouvre maintenant un cockpit `Mon chatbot` avec des onglets internes :

- `Statut`
- `Identite`
- `Mon entreprise`
- `Catalogue`
- `Portfolio` (plan Pro)
- `Script de vente` (plan Pro)
- `Contenu IA` (plan Starter)

Les vues organisation separent ensuite :

- `Mon chatbot`
- `Conversations`
- `Prospects`
- `Budget`

Le cockpit lit les donnees Messenger live via le backend FLARE et pousse la configuration chatbot active lors des mises a jour de preferences, catalogue, portfolio et script de vente.
Il reste le seul agent metier pleinement operationnel a ce jour.

### 2. Assistant IA

L'assistant reste disponible comme espace de travail separe pour :

- discuter
- preparer du contenu
- travailler avec la memoire
- utiliser des prompts
- consulter des connaissances
- manipuler des fichiers

Cet espace n'est plus presente comme le centre du produit.
Il vient apres le chatbot metier dans la hierarchie de l'app.

### 3. Automatisations et agents non prets

Les modules non operationnels restent visibles mais verrouilles.
Ils n'ouvrent plus de faux parcours.
Ils affichent un message d'offre ou d'acces, au lieu de promettre une fonction inexistante.

## Organisation et espace de travail

Le produit supporte maintenant deux niveaux d'identite :

- profil personnel du compte
- branding de l'organisation active

Chaque utilisateur peut travailler :

- dans son espace personnel
- ou dans une organisation partagee

Exemple vise : plusieurs comptes peuvent partager l'organisation `FLARE AI`.

## Acces par organisation

Le flow actuel est le suivant :

1. l'utilisateur ouvre son compte FLARE
2. si plusieurs espaces sont disponibles, il choisit ensuite l'organisation ou l'espace personnel
3. FLARE applique le nom, le logo, l'offre et les modules de cet espace
4. la session d'organisation reste temporaire et doit etre renouvelee ensuite

Les roles actuellement exposes dans l'app sont :

- `Proprietaire`
- `Admin`
- `Membre`
- `Lecture`

Ce que ces roles changent :

- tous les membres peuvent entrer dans l'organisation et utiliser les modules ouverts pour cet espace
- seuls `Proprietaire` et `Admin` peuvent modifier l'identite visuelle de l'organisation
- les droits sensibles du chatbot restent separes et plus stricts que le simple role d'organisation

## Parametres et personnalisation

Dans `Parametres > Identite`, on peut maintenant modifier :

- nom utilisateur
- photo de profil
- nom de l'espace personnel
- nom de l'organisation active
- logo de l'organisation
- nom de l'espace d'organisation
- description courte de l'espace

Ces changements sont persists cote backend.
Quand un utilisateur est dans une organisation sans droit d'edition, l'ecran l'indique clairement au lieu de donner une fausse impression de modification possible.

## Design actuel

Les dernieres passes UI ont vise :

- moins de surcharge
- moins de faux menus
- un accueil tres simple
- une landing distincte avant connexion
- un logo FLARE centralise et theme-aware
- un chatbot plus lisible en usage desktop et mobile

## Point de vigilance

Le principal risque produit actuel n'est pas la navigation.
Les points a surveiller restent :

- une QA connectee complete du flow `connexion -> choix d'organisation -> setup chatbot -> conversations` avec un vrai compte partage
- les erreurs TypeScript historiques hors scope chatbot dans les modules `studio`, qui bloquent encore un `tsc --noEmit` global alors que le cockpit chatbot build correctement

## Docs a lire ensuite

- [docs/README.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/README.md)
- [MESSENGER_DIRECT_STATUS_2026-03-28.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_DIRECT_STATUS_2026-03-28.md)
- [MESSENGER_SECURITY_AUDIT_2026-03-28.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/docs/handover/MESSENGER_SECURITY_AUDIT_2026-03-28.md)
