# FLARE AI - Beta Launch Readiness - 2026-04-12

## Objet

Document unique de reference pour repondre a une question simple :

- est-ce que FLARE AI est totalement pret et conforme pour lancer la version beta ?

Ce document couvre :

- la structure actuelle du produit
- le mode de lancement reel prevu
- ce qui est effectivement pret
- ce qui reste non prouve
- la decision recommandee

## Reponse courte

Non, FLARE AI n'est pas encore `totalement pret et conforme` pour une beta publique sans reserve.

En revanche, le produit est assez structure pour une `beta payante assistee`, operee humainement par FLARE, a condition de fermer les derniers tests live critiques.

## Structure actuelle du produit

### 1. Surfaces produit

- `Landing publique`
  - vitrine marketing FLARE AI
  - acquisition et entree vers connexion / inscription
- `Application connectee`
  - espace utilisateur apres connexion
  - navigation recentree sur `Accueil`, `Mon chatbot Facebook`, `Offre / Activation`, `Support / Parametres`
- `Chatbot Facebook`
  - coeur metier actuel
  - activation, personnalisation, catalogue, clients, commandes, dashboard
- `Administration / Operations`
  - file activations
  - file paiements
  - file commandes
  - signalements
  - dossier client unifie en cours de consolidation

### 2. Mode de lancement reel

Le lancement v1 documente n'est pas un self-serve Meta complet.

Le mode officiel actuel est :

- paiement manuel local
- preuve de paiement
- configuration chatbot par le client
- acces page Facebook donne a FLARE
- activation Facebook assistee par un operateur FLARE
- test Messenger par FLARE
- passage en `active`

### 3. Sources de verite principales

- `activation_request`
  - photo d'onboarding et suivi de la demande
- `manual_payment_submission`
  - preuve de paiement et statut de verification
- `ChatbotPreferences`
  - preferences live du chatbot
- `FacebookPageConnection`
  - source de verite de la page active/inactive
- `chatbot_order`
  - commandes issues du chatbot

## Workflow beta actuel

### Cote client

1. creer un compte
2. choisir une offre
3. payer via methode locale manuelle
4. soumettre la preuve
5. remplir le formulaire chatbot
6. ajouter FLARE comme admin/proprietaire de la page Facebook
7. attendre la verification et l'activation
8. voir le chatbot actif
9. utiliser ensuite :
   - personnalisation
   - catalogue
   - ON/OFF global
   - mode bot/humain par conversation
   - commandes
   - dashboard

### Cote operateur FLARE

1. recevoir la preuve dans la queue paiements
2. verifier ou rejeter la preuve
3. verifier l'acces admin a la page Facebook
4. passer la demande en file d'activation
5. lancer l'activation Facebook
6. importer la page
7. activer la page
8. tester Messenger
9. marquer la demande `active`
10. laisser le client operer ensuite son chatbot actif

## Ce qui est pret aujourd'hui

### Technique

- frontend Render `live` sur le commit `88fab8c`
- backend Render `live` sur le commit `27ffb47`
- `npm run build` frontend : OK
- `npx tsc --noEmit` frontend : OK
- structure documentaire de lancement v1 en place
- landing publique, shell connecte, activation assistee, admin operations et signalements documentes

### Produit

- le mode de lancement assiste est clairement defini
- le parcours client et operateur est documente
- le coeur metier `Chatbot Facebook` est priorise
- l'app connectee et la separation produit / compte sont cadrees
- l'UI a ete largement nettoyee sur les surfaces critiques

### Conformite atteinte

Le produit est conforme pour :

- une beta assistee
- un lancement controle par FLARE
- des tests clients reels
- une operation manuelle forte par l'equipe FLARE

## Ce qui n'est pas encore totalement conforme

### 1. Acceptance reelle non cloturee

Les cas critiques restent majoritairement a verifier en run manuel live :

- paiement manuel complet
- validation / refus admin
- doublon reference transaction
- OAuth Facebook reel
- import page reel
- toggle ON / OFF reel
- refresh page sans relancer OAuth
- activation assistee bout en bout
- test Messenger reel
- workflow operateur complet
- isolation multi-tenant

### 2. Ops/admin non prouvees en conditions reelles

Il manque encore :

- un dry-run operateur complet chronometre
- la preuve qu'un operateur peut traiter une demande de bout en bout sans friction
- la preuve que les transitions invalides sont bien rejetees
- la preuve que les notifications et signalements sont exploitables sans angle mort

### 3. Go public non autorisable a ce stade

Le produit n'est pas encore conforme pour :

- une beta publique vendue sans reserve
- une promesse de self-serve complet
- un discours commercial du type `produit completement pret`

## Etat des gates

### Gate 1 - Produit coherent

- etat : `partiellement valide`

OK :

- navigation globale mieux cadre
- branding produit mieux separe
- retour et accueil plus coherents
- beta publique recentree sur le chatbot Facebook

reste a valider :

- QA visuelle complete desktop/mobile
- derniers overlays / contrastes / modals en verification live
- comportement des surfaces historiques avec vrai compte

### Gate 2 - Metier coherent

- etat : `partiellement valide`

OK :

- meilleure stabilite de la demande d'activation
- meilleure capture du contexte de page cible
- catalogue enrichi
- signalements branches vers admin

reste a prouver :

- flow complet client -> admin -> activation -> actif
- coherence parfaite client/admin sur la meme demande
- stabilite de la page cible dans toutes les reprises

### Gate 3 - Ops pretes

- etat : `non prouve`

il manque :

- dry-run operateur complet
- transitions de statut verifiees
- blocages / reprises verifies
- notifications admin verifiees
- traitement complet des signalements

### Gate 4 - Acceptance reelle

- etat : `non cloturee`

minimum avant go-live public :

1. connexion au compte client
2. hub chatbot sans wizard parasite
3. OAuth Facebook reel
4. import page
5. ON / OFF global
6. Messenger reel
7. personnalisation sauvegardee puis relue
8. paiement manuel + preuve
9. validation admin
10. activation page par operateur
11. bot actif visible cote client
12. signalement visible et traitable cote admin

### Gate 5 - Pre-lancement public

- etat : `non demarre`

condition recommandee :

- 3 a 5 parcours clients pilotes reussis sans assistance de developpement

## Decision recommandee

### Decision franche

Ne pas annoncer aujourd'hui :

- `FLARE AI est totalement pret`
- `FLARE AI est totalement conforme`
- `FLARE AI est pret pour une beta publique sans reserve`

### Decision correcte a date

Position recommandee :

- `beta payante assistee possible`

mais seulement avec ces reserves explicites :

- activation assistee par FLARE
- paiement manuel local
- validation operateur
- acceptance live encore a fermer sur les parcours critiques

## Conditions pour declarer la beta conforme

Les conditions minimales sont :

1. executer les blocs critiques du runbook d'acceptance
2. fermer les cas `OK / KO / BLOQUE` dans `09_ACCEPTANCE_TESTS.md`
3. faire un dry-run operateur complet
4. verifier Messenger reel
5. verifier l'isolation multi-tenant
6. reussir 3 a 5 pilotes reels

Une fois ces conditions fermees, le produit pourra etre documente comme :

- `beta assistee conforme`

mais pas avant.

## References

- [README lancement v1](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\README.md)
- [Architecture finale](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\01_FINAL_ARCHITECTURE.md)
- [Tunnel client](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\02_CLIENT_FLOW.md)
- [Workflow operateur](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\03_OPERATOR_FLOW.md)
- [Paiement manuel](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\04_MANUAL_PAYMENTS.md)
- [Setup chatbot et handoff](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\05_CHATBOT_SETUP_AND_HANDOFF.md)
- [Launch gates status](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\LAUNCH_GATES_STATUS_2026-04-09.md)
- [Acceptance preflight](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\ACCEPTANCE_PREFLIGHT_2026-04-09.md)
- [Acceptance session runbook](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\ACCEPTANCE_SESSION_RUNBOOK_2026-04-09.md)
