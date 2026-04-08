# FLARE AI - Acceptance Preflight - 2026-04-09

## Objet

Classer les cas d'acceptance prioritaires entre :

- `couverts techniquement / deployes`
- `impossible a declarer verifies sans run manuel live`

Ce document cible surtout les sections :

- 1. Paiement et plan
- 2. Connexion Facebook & page
- 3. Activation assistee
- 4. Controle bot global / conversation
- 9. Isolation multi-tenant
- 11. Workflow operateur

Source principale :
[09_ACCEPTANCE_TESTS.md](../specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md)

## Verification preflight deja faite

### Live endpoints

- `https://flareai.ramsflare.com` -> `200`
- `https://rams-flare-ai.web.app` -> `200`
- `https://flare-backend-236458687422.europe-west1.run.app/health` -> `200`

### Deploys Render

- frontend `live` sur `d85cd9b` `Fix frontend type safety regressions`
- backend `live` sur `27ffb47` `Harden launch activation flow and catalogue`

### Frontend local

- `npx tsc --noEmit` -> OK

## Classement par section

## 1. Paiement et plan

### Couverts techniquement / deployes

- `1.4` fallback moyens de paiement par defaut
- `1.9` affichage propre du banner offres
- `1.10` grille offres et CTA visibles
- `1.11` CTA entreprise vers `mailto`
- `1.12` message lisible quand une demande existe deja

### Exigent imperativement un run manuel live

- `1.1` creation nouvel espace -> verification plan `free`
- `1.2` verif features chatbot bloquees sur `free`
- `1.3` selection plan `pro` sans upgrade effectif premature
- `1.5` soumission preuve
- `1.6` validation admin
- `1.7` rejet doublon reference
- `1.8` refus admin

### Pourquoi

Les cas UI/fallback sont plausiblement couverts par code et deploy.
Les cas qui changent un etat metier, une transaction ou une relation client/admin restent non declarables sans test reel.

## 2. Connexion Facebook & page

### Couverts techniquement / deployes

- `2.1` acces hub chatbot sans blocage payant parasite
- `2.9` plus de wizard intermediaire parasite

### Exigent imperativement un run manuel live

- `2.2` popup OAuth Meta
- `2.3` import pages reel
- `2.4` etat initial OFF reel
- `2.5` toggle ON reel
- `2.6` toggle OFF reel
- `2.7` refresh liste sans relancer OAuth
- `2.8` suppression page inactive

### Pourquoi

Toutes les integrations Meta et tous les changements d'etat page/webhook doivent etre verifies en conditions reelles.

## 3. Activation assistee (flow operateur)

### Couverts techniquement / deployes

- stabilisation de la verite de demande d'activation
- meilleure capture de page cible / contexte de demande
- affichage plus coherent cote client et admin

### Exigent imperativement un run manuel live

- `3.1` creation demande client
- `3.2` confirmation ajout FLARE admin
- `3.3` visibilite dans la queue admin
- `3.4` OAuth Facebook operateur sur la bonne organisation
- `3.5` creation `FacebookPageConnection`
- `3.6` activation page par admin
- `3.7` message Messenger reel + reponse bot
- `3.8` statut client actif avec KPIs/hub

### Pourquoi

Le coeur metier a ete durci, mais aucune de ces etapes ne doit etre declaree verifiee sans run operateur complet.

## 4. Controle bot global et par conversation

### Couverts techniquement / deployes

- `4.3` global OFF ignore les messages cote webhook
- `4.4` filtre anti-boucle echo

### Exigent imperativement un run manuel live

- `4.1` global ON repond vraiment
- `4.2` global OFF silence total
- `4.5` OFF par conversation
- `4.6` ON par conversation
- `4.7` priorite du global OFF
- `4.8` restriction owner/admin sur switch mode

### Pourquoi

Le code peut etre correct et quand meme rater un cas runtime Messenger ou permissionnel.

## 9. Isolation multi-tenant

### Couverts techniquement / deployes

- rien a declarer "verifie" sans scenario multi-org reel

### Exigent imperativement un run manuel live

- `9.1` isolation paiements
- `9.2` isolation commandes
- `9.3` isolation conversations
- `9.4` invisibilite panneau admin sans email admin
- `9.5` actions operateur hors membership
- `9.6` preferences chatbot isolees par org

### Pourquoi

Ce sont des garanties de securite et d'isolation.
Elles ne doivent pas etre deduites du code seulement.

## 11. Workflow operateur

### Couverts techniquement / deployes

- presence du hub admin et des files principales
- structure generale paiements / activations / signalements

### Exigent imperativement un run manuel live

- `11.1` demande visible en queue
- `11.2` assignation operateur
- `11.3` transitions valides
- `11.4` transitions invalides rejetees
- `11.5` blocage avec raison + retour client
- `11.6` note + audit
- `11.7` email admin a `payment_submitted`

### Pourquoi

Ces cas sont directement lies au SLA operateur et au vrai lancement payant.

## Findings prioritaires

### P1 - Rien dans les sections 1/2/3/4/9/11 ne permet encore de declarer le produit "go public"

Le code et le deploy sont mieux cadres, mais les cas qui comptent pour la vente reelle restent majoritairement des cas runtime.

### P1 - Les integrations externes critiques restent dependantes d'un run manuel live

Meta OAuth, import page, webhook, reponse Messenger, verification paiement et emails admin doivent etre joues reellement.

### P1 - L'isolation multi-tenant reste une gate de securite, pas une supposition

Sans scenario A/B reel, il faut laisser toute la section 9 en attente.

### P2 - Le frontend est maintenant assez propre pour que la prochaine session de test soit rentable

Le bruit frontend de base a baisse :

- Assistant IA structurellement meilleur
- dette TypeScript nettoyee
- deploy frontend stable

La prochaine valeur vient donc des tests live, pas d'un nouveau lot cosmetique.

## Shortlist de tests a executer d'abord

Ordre recommande, le plus rentable pour fermer le risque lancement :

1. `1.5 -> 1.8`
   paiement manuel, preuve, validation, refus, doublon reference
2. `3.1 -> 3.8`
   flow activation assistee complet cote client + admin
3. `2.2 -> 2.7`
   OAuth Facebook, import page, toggle ON/OFF, refresh
4. `4.1 -> 4.8`
   global/per-conversation ON/OFF + controle par role
5. `11.1 -> 11.7`
   queue operateur, assignation, transitions, blocage, note, email admin
6. `9.1 -> 9.6`
   isolation multi-tenant, idealement avec deux orgs et un compte non-admin

## Decision actuelle

### Oui pour

- poursuivre les tests reels
- preparer une beta payante assistee

### Non pour

- declarer "vendable publiquement" maintenant
- marquer massivement `09_ACCEPTANCE_TESTS.md` en `verifie`

## Regle de mise a jour

Ne passer un cas en `verifie` dans `09_ACCEPTANCE_TESTS.md` qu'apres execution reelle du cas et constat explicite du resultat.
