# FLARE AI - Manuel interne d'exploitation beta assistee

Derniere mise a jour : 12 avril 2026

## Objet

Ce document explique comment FLARE AI fonctionne reellement aujourd'hui pour le lancement `beta payante assistee`.

Le but n'est pas de refaire toute la spec. Le but est de permettre a un dev, un operateur FLARE, ou un interne produit de comprendre :

- la structure du produit
- le passage d'un utilisateur `free` a `paid`
- comment le paiement manuel est traite
- comment le chatbot Facebook est active manuellement par FLARE
- ce qui est automatise aujourd'hui
- ce qui reste manuel
- ce qui est vrai dans le code actuel, pas seulement dans les intentions produit

## Decision de lancement

La v1 n'est pas un self-serve complet Meta.

Le mode de lancement reel est :

- beta payante
- activation assistee
- paiement manuel local
- verification humaine FLARE
- activation Facebook operee par FLARE

En pratique :

1. le client choisit un plan
2. il paie hors de FLARE
3. il envoie la preuve
4. il configure son bot
5. il confirme l'acces page
6. FLARE traite la demande
7. FLARE active et teste
8. le bot passe actif

## Structure produit

### 1. Surfaces produit

- `Landing publique`
  - vitrine marketing
  - acquisition
  - orientation vers essai / creation de compte

- `App connectee`
  - shell apres connexion
  - gestion de l'espace actif
  - navigation principale

- `Chatbot Facebook`
  - module metier prioritaire
  - tunnel d'activation
  - personnalisation
  - parametres Facebook
  - dashboard chatbot
  - clients / commandes / conversations

- `Assistant IA`
  - espace de travail secondaire
  - non critique pour l'activation du chatbot Facebook

- `Administration`
  - hub operations FLARE
  - activations
  - paiements
  - commandes
  - signalements

### 2. Roles

Roles organisation cote client :

- `owner`
- `admin`
- `member`
- `viewer`

Roles operations :

- `operateur FLARE`
- `dev/operator` quand l'activation est encore faite manuellement par le dev

Regle pratique :

- seules les personnes FLARE traitent paiements, verification, activation, tests finaux
- seul `owner/admin` peut piloter les actions sensibles de l'espace cote client

## Sources de verite

### Source de verite historique / commerciale

`activation_request`

Cette entite porte la verite de la demande d'activation. Elle capture notamment :

- plan choisi
- statut de la demande
- statut de paiement
- snapshot des pages Facebook au moment de la soumission
- page FLARE selectionnee a la soumission
- page cible exacte demandee pour l'activation
- confirmation de l'acces admin FLARE
- notes operateur
- operateur assigne
- horodatages

Champs importants exposes par le backend :

- `selected_facebook_pages_snapshot`
- `flare_selected_page_id_at_submission`
- `flare_selected_page_name_at_submission`
- `activation_target_page_id`
- `activation_target_page_name`
- `flare_page_admin_confirmed`

### Source de verite paiement

`manual_payment_submission`

Cette entite represente :

- la methode de paiement choisie
- la reference de paiement
- la preuve
- le montant
- le plan cible
- le statut `submitted / verified / rejected`

### Source de verite live chatbot

Apres activation, le comportement du bot repose surtout sur :

- `ChatbotPreferences`
- `FacebookPageConnection`
- les donnees Messenger live

Regle interne :

- `activation_request` dit comment une activation a ete demandee et traitee
- `ChatbotPreferences` et `FacebookPageConnection` disent ce qui tourne reellement en production

## Cycle de vie utilisateur

### Parcours haut niveau

1. visiteur sur la landing
2. creation de compte / connexion
3. creation ou selection d'un espace
4. espace en plan `free`
5. choix d'une offre payante
6. paiement manuel hors FLARE
7. envoi de la preuve
8. configuration chatbot
9. confirmation acces page Facebook
10. traitement operateur FLARE
11. activation
12. testing
13. `active`

### Etats de la demande d'activation

Etats principaux observes dans le backend :

- `draft`
- `awaiting_payment`
- `payment_submitted`
- `payment_verified`
- `awaiting_flare_page_admin_access`
- `queued_for_activation`
- `activation_in_progress`
- `testing`
- `active`

Etats de sortie / ecart :

- `blocked`
- `rejected`
- `canceled`

### Ce qui fait passer d'un etat a l'autre

- `draft -> awaiting_payment`
  - demande creee
  - plan choisi

- `awaiting_payment -> payment_submitted`
  - preuve envoyee

- `payment_submitted -> payment_verified`
  - paiement valide par FLARE

- `payment_verified -> awaiting_flare_page_admin_access`
  - paiement valide mais acces admin FLARE non confirme

- `payment_verified -> queued_for_activation`
  - paiement valide et acces admin FLARE confirme

- `queued_for_activation -> activation_in_progress`
  - operateur prend le dossier

- `activation_in_progress -> testing`
  - configuration technique terminee

- `testing -> active`
  - test final Messenger passe

Regles backend notables :

- `active` exige un `tested_at`
- `blocked` exige une raison

## Passage de free a paid

### Realite produit

Un espace nouvellement cree demarre en `free`.

Le client n'est pas considere payant au simple clic sur une offre.
Le passage reel a un plan payant se produit apres validation humaine de la preuve.

### Realite backend

Le backend applique le plan payant au moment de la verification admin du paiement.

Quand l'admin appelle la verification du paiement :

- le `manual_payment_submission` passe a `verified`
- l'abonnement organisation est mis a jour avec `selected_plan_id`
- `UserSubscription.status` devient `active`
- la demande d'activation liee met `payment_status = verified`

Ensuite :

- si `flare_page_admin_confirmed == true` et que la demande etait `payment_submitted`, elle passe `queued_for_activation`
- sinon elle passe `awaiting_flare_page_admin_access`

### Conclusion interne

Le passage `non payant -> payant` ne doit pas etre raconte comme :

- "le client clique et devient payant"

Il doit etre raconte comme :

- "le client choisit un plan, paie, envoie sa preuve, puis FLARE valide et applique le plan"

## Paiement manuel

### Configuration

Les methodes sont alimentees par :

- `MANUAL_PAYMENT_METHODS_JSON`

En absence de configuration, le backend a des valeurs de secours.

### Flux exact

1. le client choisit une methode
2. il paie hors application
3. il soumet la preuve via `POST /api/billing/manual-payments`
4. le dossier arrive dans la queue admin
5. FLARE verifie
6. FLARE valide ou refuse

### Regles de controle

- une reference deja utilisee pour la meme methode avec statut `submitted` ou `verified` est rejetee
- une preuve invalide doit etre refusee, pas ignoree
- toute validation doit laisser une trace operateur

### Decisions admin

- verification :
  - applique le plan
  - debloque la suite du tunnel

- rejet :
  - paiement `rejected`
  - demande `payment_status = rejected`

## Activation Facebook assistee

### Regle produit v1

Le client ne fait pas un self-serve Meta complet.

La page Facebook cible est preparee cote client, mais l'activation finale est traitee par FLARE.

### Ce que le client fait

1. choisir la page cible dans FLARE quand c'est requis
2. remplir la configuration chatbot
3. donner l'acces necessaire a FLARE sur la page Facebook
4. confirmer que cet acces est donne

### Ce que FLARE fait

1. verifier le paiement
2. verifier que l'acces admin page existe
3. prendre la demande en charge
4. connecter / importer / verifier la page
5. activer le bot
6. tester Messenger
7. marquer `active`

### Verite de la page cible

Il faut distinguer trois choses :

1. les pages actuellement importees dans l'espace
2. la page selectionnee dans FLARE au moment de la soumission
3. la page exacte demandee pour l'activation

Cette distinction est importante pour eviter :

- les collisions de nom de page
- les confusions apres reimport
- les activations sur la mauvaise page

### Verite du code actuel

La spec launch parle d'un flow admin Facebook dedie.

Mais l'implementation visible aujourd'hui montre surtout :

- des routes admin pour gerer le dossier d'activation et ses statuts
- des routes organisation pour la connexion Facebook

En clair :

- l'admin peut assigner, changer les statuts, noter, verifier le paiement
- mais il n'existe pas, dans l'etat inspecte, un ensemble complet de routes admin dediees a chaque activation pour piloter Facebook de bout en bout depuis le hub admin

Donc la realite actuelle doit etre lue comme :

- le traitement business se fait dans `Administration`
- la connexion Facebook reelle s'appuie encore largement sur les outils Facebook existants scopes par organisation

## Ce que le dev / operateur fait manuellement aujourd'hui

### Queue paiements

Depuis l'admin :

1. ouvrir `Paiements`
2. verifier la preuve
3. verifier que le plan cible est correct
4. valider ou rejeter
5. ajouter une note si la situation est douteuse

### Queue activations

Depuis l'admin :

1. ouvrir `Activations`
2. filtrer les dossiers `queued_for_activation` ou `awaiting_flare_page_admin_access`
3. assigner le dossier
4. verifier la page cible, le snapshot et le contexte
5. si acces manquant, laisser ou remettre `awaiting_flare_page_admin_access`
6. si dossier pret, passer `activation_in_progress`
7. realiser les manipulations Facebook necessaires
8. passer `testing`
9. tester en vrai
10. passer `active`

### Quand le dev opere lui-meme

Tant que tout n'est pas totalement self-serve cote operations, le dev peut agir comme operateur FLARE.

Dans ce cas, la procedure reste la meme :

- verifier paiement
- verifier acces
- connecter / verifier Facebook
- tester Messenger
- marquer actif

Le dev ne doit pas sauter les etats.
Chaque dossier doit garder un historique lisible.

## Ce qui est automatise vs manuel

### Automatise

- creation d'un espace en `free`
- creation de la demande d'activation
- enregistrement de la preuve de paiement
- changement de plan apres verification
- stockage du contexte de page cible
- affichage du statut cote client et cote admin

### Encore manuel

- verification de la preuve de paiement
- validation ou rejet final
- confirmation effective de l'acces page Facebook
- manipulation Facebook selon le dossier
- test final Messenger
- decision finale `active`

## Ce que le client peut faire apres activation

Une fois actif, le client peut surtout :

- modifier la personnalisation
- modifier les informations entreprise
- gerer catalogue / portfolio / contenus de vente
- voir dashboard, clients, commandes
- utiliser le ON/OFF global selon ses droits
- gerer certaines preferences du bot

Le client ne doit pas pouvoir :

- contourner l'isolation multi-tenant
- voir ou manipuler les secrets/tokens
- se faire passer pour l'operateur FLARE

## Matrice de controle rapide

| Etat | Action client | Action admin / FLARE | Resultat attendu |
| --- | --- | --- | --- |
| `free` | choisir un plan | aucune | dossier de demande cree |
| `awaiting_payment` | payer | aucune | attente preuve |
| `payment_submitted` | attendre | verifier / rejeter | plan applique si valide |
| `payment_verified` | donner acces page si manque | verifier acces | attente queue ou acces |
| `awaiting_flare_page_admin_access` | ajouter FLARE comme admin page | controler reprise | dossier pret a reprendre |
| `queued_for_activation` | attendre | assigner et activer | activation en cours |
| `activation_in_progress` | attendre | connecter / verifier | passage en test |
| `testing` | attendre | tester Messenger | `active` si OK |
| `active` | utiliser le bot | support si besoin | exploitation normale |
| `blocked` | corriger le blocage | debloquer ou refuser | reprise ou sortie |

## Incidents courants

### 1. Paiement invalide

Diagnostic :

- reference douteuse
- montant incorrect
- preuve illegible

Resolution :

- rejet du paiement
- note admin
- retour client pour nouvelle preuve

### 2. Acces page Facebook manquant

Diagnostic :

- page cible connue
- paiement verifie
- acces FLARE non confirme ou non effectif

Resolution :

- statut `awaiting_flare_page_admin_access`
- note claire
- reprise apres confirmation

### 3. Mauvaise page cible

Diagnostic :

- nom de page ambigu
- changement de selection apres soumission

Resolution :

- se fier a `activation_target_page_id`
- verifier le snapshot
- ne pas activer sur simple nom de page

### 4. Test Messenger echoue

Diagnostic :

- webhook
- permissions
- page non correctement activee
- configuration bot incomplete

Resolution :

- garder `testing` ou passer `blocked`
- noter l'echec et la cause
- retester avant `active`

### 5. Doute multi-tenant

Diagnostic :

- page semble deja active ailleurs
- organisation incoherente

Resolution :

- verifier l'organisation cible
- verifier la possession de page
- ne pas forcer l'activation sans clarifier la source de verite

## Check-list operateur avant de dire "active"

1. paiement verifie
2. plan correct applique
3. page cible exacte confirmee par id
4. acces page FLARE confirme
5. dossier assigne
6. activation technique realisee
7. test Messenger reel effectue
8. note operateur laissee si necessaire
9. statut passe a `active`

## APIs importantes a connaitre

### Client / chatbot

- `GET /api/chatbot/activation-request`
- `POST /api/chatbot/activation-request`
- `PATCH /api/chatbot/activation-request`

### Paiement

- `POST /api/billing/manual-payments`

### Admin operations

- `GET /api/admin/activations`
- `GET /api/admin/activations/{id}`
- `POST /api/admin/activations/{id}/assign`
- `POST /api/admin/activations/{id}/set-status`
- `POST /api/admin/activations/{id}/add-note`
- `GET /api/admin/payments`
- `POST /api/admin/payments/{id}/verify`
- `POST /api/admin/payments/{id}/reject`

### Facebook

Implementation inspectee aujourd'hui :

- les routes Facebook visibles sont surtout scopees organisation (`/api/facebook/...`)
- pas de preuve suffisante, dans l'etat relu, d'un flow admin dedie par demande d'activation expose de bout en bout

Cette nuance doit etre connue avant de promettre un outil operations totalement ferme.

## Ce qui est pret vs pas encore ferme

### Pret pour beta assistee

- structure produit
- tunnel commercial assiste
- paiement manuel
- queue admin paiements / activations
- source de verite de la demande
- statutage principal

### Pas encore prouve comme beta publique sans reserve

- acceptance live complete de bout en bout
- workflow Facebook entierement prouve en conditions reelles
- workflow operateur 100% ferme sans intervention dev
- isolation multi-tenant entierement validee sur tous les cas

## Utilisation correcte de ce document

Ce document sert a :

- onboarder un dev ou un operateur interne
- traiter un client qui passe de `free` a `active`
- verifier ce qui est manuel aujourd'hui
- rappeler la verite de l'implementation

Ce document ne remplace pas :

- les specs launch detaillees
- les tests d'acceptance
- les handovers de deploiement

## References

- [Launch README](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\README.md)
- [Architecture finale](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\01_FINAL_ARCHITECTURE.md)
- [Tunnel client](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\02_CLIENT_FLOW.md)
- [Workflow operateur](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\03_OPERATOR_FLOW.md)
- [Paiement manuel](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\04_MANUAL_PAYMENTS.md)
- [Setup chatbot et handoff](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\05_CHATBOT_SETUP_AND_HANDOFF.md)
- [API et modeles](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\07_API_DATA_MODELS.md)
- [Acceptance tests](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\09_ACCEPTANCE_TESTS.md)
- [Launch gates status](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\LAUNCH_GATES_STATUS_2026-04-09.md)
- [Beta launch readiness](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\BETA_LAUNCH_READINESS_2026-04-12.md)
