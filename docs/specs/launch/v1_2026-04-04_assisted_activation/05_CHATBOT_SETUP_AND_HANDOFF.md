# 05 - Configuration chatbot et handoff

## Comment les donnees du formulaire deviennent les preferences live

### A la creation de la demande

Quand le client soumet le formulaire d'activation, les donnees alimentent **simultanement** :

1. `activation_request` : photo d'onboarding (reference historique)
2. `ChatbotPreferences` : preferences live du chatbot

Mapping :

| Champ formulaire | → ChatbotPreferences |
|-----------------|---------------------|
| bot_name | bot_name |
| primary_language | language |
| tone | tone |
| greeting_message | greeting_message |
| business_name | company_name |
| business_sector | company_sector |
| business_city | company_city |
| business_description | company_description |
| offer_summary | products_summary |
| opening_hours | business_hours |
| contact_phone | contact_phone |
| contact_email | contact_email |

### Apres activation

- les preferences live (`ChatbotPreferences`) deviennent la **seule source de verite** du contenu
- `activation_request` reste une photo d'onboarding
- `activation_request` ne doit jamais ecraser les preferences live apres coup, sauf action explicite d'un operateur

---

## Ce que FLARE configure lors de l'activation

1. Importer la page Facebook via le compte operateur
2. Configurer le webhook Messenger
3. Synchroniser les preferences vers le Direct Service
4. Activer la page (`is_active = true`)
5. Envoyer un message test via Messenger
6. Verifier la reception de la reponse
7. Marquer la demande comme `active`

---

## Ce que le client peut modifier apres activation

| Surface | Elements modifiables |
|---------|---------------------|
| Personnalisation | nom du bot, langue, ton, message d'accueil, instructions speciales |
| Entreprise | nom, secteur, ville, pays, description |
| Catalogue | produits/services (nom, description, prix, image) |
| Portfolio | projets/references |
| Ventes | script, qualification, objections, signaux hot lead |
| Controle global | ON/OFF chatbot |
| Par conversation | Bot actif / Reprise manuelle |

### Ce que le client ne peut PAS faire

- reconnecter Facebook (c'est FLARE qui gere la connexion)
- modifier les tokens d'acces
- voir les parametres techniques Meta
- acceder aux donnees d'autres organisations

---

## Passage en production valide

L'activation n'est complete que quand :

1. La page est importee et activee
2. Le webhook est souscrit
3. Le Direct Service est synchronise
4. Un message test a ete envoye ET une reponse recue
5. Le statut passe a `active`
6. Le client est notifie

Si le test echoue, la demande reste en `testing` et l'operateur investigue.

---

## Handoff bot/humain

### Wording client

- `Bot actif` : le chatbot repond automatiquement
- `Reprise manuelle` : un humain prend la conversation

### Regles

- le toggle est accessible aux roles `owner` et `admin`
- le global OFF coupe tout, y compris les conversations en `Bot actif`
- le basculement par conversation ne modifie pas le statut global
- la creation d'une commande **ne bascule pas automatiquement** en reprise manuelle (bascule explicite)
