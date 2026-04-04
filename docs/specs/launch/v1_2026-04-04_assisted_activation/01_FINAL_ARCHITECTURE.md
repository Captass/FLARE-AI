# 01 - Architecture finale de lancement v1

## Principe general

Le produit de lundi est :
- **compte client self-serve**
- **workspace client self-serve**
- **paiement manuel local**
- **activation Facebook assistee par FLARE**
- **gestion du chatbot autonome apres livraison**

Le client ne doit jamais :
- entrer dans Meta Developer
- toucher aux reglages techniques Facebook
- partager ses identifiants Facebook
- voir les espaces ou donnees des autres clients

---

## Repartition des responsabilites

### Cote client
- cree son compte
- cree son espace
- choisit son offre
- paie
- soumet la preuve de paiement
- remplit les infos chatbot (formulaire d'activation)
- ajoute le compte operateur FLARE comme admin/proprietaire de sa page Facebook
- suit le statut de sa demande
- modifie ensuite son bot dans FLARE (preferences, catalogue, ON/OFF, bot/humain)

### Cote FLARE (operateur)
- verifie le paiement
- verifie l'acces admin page
- connecte Facebook via le compte operateur
- importe la page
- active le chatbot (ON)
- teste Messenger
- marque la livraison
- traite les commandes et reprises humaines si necessaire

### Cote systeme
- stocke les demandes d'activation
- stocke les preuves de paiement
- notifie l'equipe (queue + email best-effort)
- journalise toutes les actions (audit trail)
- garde l'historique complet
- protege l'isolation par organisation (multi-tenant)
- expose les statuts cote client

---

## Controles chatbot

### Controle global (ON/OFF)

Source de verite : page Facebook active ou inactive (`is_active` sur `FacebookPageConnection`).

Regles :
- une seule page active par organisation
- `ON` = reponses automatiques autorisees
- `OFF` = aucune reponse automatique, quelle que soit la conversation

### Controle par conversation (bot/humain)

Source de verite : mode conversation existant (`agent`/`human` dans le service direct).

Wording expose au client :
- `Bot actif` (= mode agent)
- `Reprise manuelle` (= mode human)

Regles :
- conversation en `Reprise manuelle` = le bot ne repond pas a cette conversation
- conversation en `Bot actif` + global ON = le bot peut repondre
- global OFF a priorite sur tout, sans exception

---

## Source de verite du contenu chatbot

### Apres activation
La source de verite finale est : **les preferences et reglages chatbot existants** (`ChatbotPreferences`, catalogue, portfolio, sales config).

### Le formulaire d'activation
- initialise ces valeurs a la creation de la demande
- ne cree pas un deuxieme systeme parallele

### Regle de synchronisation
- a la creation de la demande, les donnees alimentent a la fois `activation_request` ET les preferences live du chatbot
- apres l'activation, **les preferences live deviennent la seule source de verite**
- `activation_request` reste une photo d'onboarding, jamais ecrasante apres coup sauf action explicite d'un operateur

---

## Acces operateur interne

Les operateurs FLARE ne sont **pas ajoutes comme membres visibles** des organisations clientes.

A la place :
- authentification admin via `ADMIN_EMAILS` (systeme existant)
- endpoints operateur internes capables d'agir sur un `organization_slug` donne
- toutes les actions operateur sont : authentifiees admin, journalisees, invisibles dans la liste des membres client

Resultat :
- confidentialite preservee
- pas de "FLARE apparait comme membre de tous les espaces"
- l'operateur peut tout de meme configurer et livrer

---

## Correction critique : plan par defaut

- tout nouvel espace organisationnel demarre en `free`
- le plan payant n'est applique qu'apres : preuve de paiement soumise + validation operateur
- aucun espace ne doit obtenir les features payantes automatiquement
- `auth_sync` personnel reste en `free`

---

## Confidentialite et isolation

- chaque organisation ne voit que ses propres donnees : paiements, commandes, conversations, pages
- un client ne voit jamais le panneau admin
- l'operateur agit sans apparaitre comme membre de l'espace client
- les tokens Facebook sont chiffres au repos
- les preuves de paiement sont stockees dans un chemin isole par organisation
