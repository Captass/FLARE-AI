# FLARE AI - Acceptance Session Runbook - 2026-04-09

## Objet

Checklist executable pour la vraie session d'acceptance.

But :

- jouer les cas critiques dans le bon ordre
- noter un resultat net par cas
- capturer une preuve minimale
- eviter de melanger debug produit, debug ops et debug integration

Ce runbook ne remplace pas :

- [09_ACCEPTANCE_TESTS.md](../specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md)
- [LAUNCH_GATES_STATUS_2026-04-09.md](./LAUNCH_GATES_STATUS_2026-04-09.md)
- [ACCEPTANCE_PREFLIGHT_2026-04-09.md](./ACCEPTANCE_PREFLIGHT_2026-04-09.md)

## Regle de statut

Pour chaque cas joue :

- `OK` = comportement observe conforme
- `KO` = comportement observe non conforme
- `BLOQUE` = impossible a jouer a cause d'un prerequis manquant

Ne jamais noter `OK` uniquement parce que le code semble bon.

## Pre-requis session

Avant de commencer :

1. verifier que l'espace actif est bien `RAM'S FLARE`
2. verifier que le frontend public charge correctement
3. verifier que le backend health repond
4. verifier que l'operateur admin utilise bien `cptskevin@gmail.com`
5. preparer :
   - une vraie page Facebook de test
   - une vraie reference de paiement de test
   - un moyen d'envoyer un message Messenger reel
   - une deuxieme organisation ou un deuxieme scope pour les tests multi-tenant

## Bloc A - Paiement et plan

### Cas a jouer

1. `1.1` creation nouvel espace -> plan `free`
2. `1.2` features chatbot bloquees sur `free`
3. `1.3` choix offre standard sans upgrade premature
4. `1.5` soumission preuve paiement
5. `1.6` validation admin
6. `1.7` doublon reference transaction
7. `1.8` refus admin

### Preuve minimale

- capture de l'offre selectionnee
- capture du statut paiement cote client
- capture du statut cote admin
- capture du plan org avant / apres verification

### Resultat attendu

- le plan ne change pas avant verification
- une reference dupliquee est rejetee
- verification upgrade bien l'abonnement
- refus laisse le plan precedent intact

## Bloc B - Connexion Facebook et page

### Cas a jouer

1. `2.2` ouvrir Meta
2. `2.3` autoriser compte Facebook
3. `2.4` page importee en OFF
4. `2.5` toggle ON
5. `2.6` toggle OFF
6. `2.7` refresh liste
7. `2.8` suppression page inactive

### Preuve minimale

- capture popup OAuth
- capture liste pages importees
- capture etat OFF / ON / OFF

### Resultat attendu

- la page apparait dans FLARE
- les toggles changent d'etat correctement
- le refresh ne relance pas une OAuth inutile

## Bloc C - Activation assistee

### Cas a jouer

1. `3.1` creation demande activation
2. `3.2` confirmation ajout admin FLARE
3. `3.3` demande visible cote admin
4. `3.4` lancement Facebook pour la bonne organisation
5. `3.5` creation `FacebookPageConnection`
6. `3.6` activation page par admin
7. `3.8` statut client actif

### Preuve minimale

- identifiant de la demande activation
- page cible demandee
- capture resume client
- capture detail admin de la meme demande

### Resultat attendu

- client et admin voient la meme demande
- la page cible est explicite et stable
- la demande suit la bonne progression operateur

## Bloc D - Messenger reel

### Cas a jouer

1. `3.7` message Messenger reel + reponse bot
2. `4.1` global ON
3. `4.2` global OFF
4. `4.5` conversation OFF
5. `4.6` conversation ON
6. `4.7` priorite du global OFF
7. `4.8` restriction owner/admin

### Preuve minimale

- capture du message entrant
- capture de la reponse du bot
- capture des toggles
- capture du refus permissionnel pour compte non autorise

### Resultat attendu

- le bot repond quand il doit repondre
- il se tait quand il doit se taire
- les permissions sensibles sont respectees

## Bloc E - Workflow operateur

### Cas a jouer

1. `11.1` demande dans la queue
2. `11.2` assignation operateur
3. `11.3` transitions valides
4. `11.4` transition invalide rejetee
5. `11.5` blocage avec raison
6. `11.6` note admin
7. `11.7` notification admin si configuree

### Preuve minimale

- capture de la queue
- capture d'une assignation
- capture d'un blocage avec raison
- capture timeline / note / statut final

### Resultat attendu

- l'operateur peut traiter la demande sans friction
- les transitions invalides sont effectivement refusees
- le dossier garde un historique compréhensible

## Bloc F - Isolation multi-tenant

### Cas a jouer

1. `9.1` paiements A vs B
2. `9.2` commandes A vs B
3. `9.3` conversations A vs B
4. `9.4` admin invisible sans email admin
5. `9.5` actions operateur hors membership
6. `9.6` preferences chatbot isolees

### Preuve minimale

- captures cote org A
- captures cote org B
- capture compte non admin

### Resultat attendu

- aucune fuite de donnees
- aucune fuite de privilege
- aucune mutation croisee entre organisations

## Tableau de suivi rapide

| Bloc | Statut | Notes |
|------|--------|-------|
| A - Paiement et plan | A remplir | |
| B - Connexion Facebook | A remplir | |
| C - Activation assistee | A remplir | |
| D - Messenger reel | A remplir | |
| E - Workflow operateur | A remplir | |
| F - Isolation multi-tenant | A remplir | |

## Decision finale a la fin de la session

Choisir une seule decision :

1. `Beta payante assistee possible`
2. `Beta bloquee par defects critiques`
3. `Pas de go-live public`

## Regle de cloture

Quand la session est finie :

1. reporter les vrais resultats dans `09_ACCEPTANCE_TESTS.md`
2. lister les `KO`
3. corriger uniquement les `KO` reels
4. re-jouer les cas impactes
