# 06 - Commandes et tableaux de bord

## Modele de commande simple

### Entite `chatbot_order`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| organization_slug | string | Organisation |
| organization_scope_id | string | `org:{slug}` |
| facebook_page_id | string | Page source |
| page_name | string | Nom de la page |
| contact_psid | string | ID du contact Messenger |
| contact_name | string | Nom du contact |
| contact_phone | string | Telephone (si fourni) |
| contact_email | string | Email (si fourni) |
| source_conversation_id | string | ID conversation source |
| source_message_id | string | ID message declencheur |
| product_summary | text | Resume du produit/service demande |
| quantity_text | string | Quantite (texte libre) |
| amount_text | string | Montant (texte libre) |
| delivery_address | text | Adresse de livraison |
| customer_request_text | text | Demande brute du client |
| confidence | float | Score de confiance (0-1) |
| source | enum | `signal` / `manual` |
| status | enum | `detected` / `contacted` / `confirmed` / `fulfilled` / `canceled` |
| needs_human_followup | boolean | Necessite un suivi humain |
| assigned_to | string | Email operateur assigne |
| created_at | datetime | Date creation |
| updated_at | datetime | Derniere MAJ |

### Sources

- `signal` : creation automatique depuis les signaux Messenger (order_signal, ready_to_buy)
- `manual` : creation manuelle depuis la conversation par l'operateur ou le client

### Statuts

```
detected → contacted → confirmed → fulfilled
                                  → canceled
detected → canceled
```

---

## Detection et creation

### Creation automatique

Creer une commande quand :
- les signaux Messenger existants remontent un `order_signal`
- ou un etat equivalent fort `ready_to_buy`
- ou une combinaison simple et fiable d'indicateurs deja fournis par le runtime

Pas de classifieur LLM complexe pour lundi.

### Creation manuelle

Depuis une conversation, bouton `Creer une commande` disponible pour owner/admin.

### Anti-doublon

Cle logique basee sur : organisation + page + contact + message source ou fenetre temporelle (5 min).

---

## Notification commande

Quand une commande est creee :
- la commande apparait dans FLARE (vue Commandes)
- une notification interne operateur est creee
- un email admin best-effort est envoye
- le dashboard client incremente le compteur commandes

---

## Relation conversation / commande

Depuis le detail conversation :
- voir s'il y a une commande liee
- ouvrir la commande
- creer une commande si besoin
- passer en `Reprise manuelle`

Regle : la creation d'une commande **ne bascule pas automatiquement** la conversation en humain.

---

## Dashboard client

### Chatbot Home (cockpit de lancement)

Affiche en priorite :
- statut de l'espace
- statut du plan
- statut du paiement
- statut de la demande d'activation
- statut acces page
- statut chatbot global
- CTA adaptes a l'etat courant

### Dashboard chatbot (widgets)

| Widget | Donnee |
|--------|--------|
| Statut activation | etat de la demande |
| Statut paiement | etat du paiement |
| Chatbot global | ON / OFF |
| Messages du jour | compteur 24h |
| Conversations actives | nombre |
| Conversations en reprise manuelle | nombre |
| Commandes nouvelles | compteur `detected` |
| Commandes a traiter | compteur `contacted` |

### Page Commandes (nouvelle surface client)

- liste des commandes de l'espace
- filtre par statut
- ouverture detail commande
- changement de statut si owner/admin

---

## Dashboard operateur (admin)

### Vue Commandes dans Operations

- toutes les commandes de toutes les organisations
- filtres : nouvelles, a traiter, confirmees, terminees, annulees
- ouverture detail commande
- changement de statut
- lien vers la conversation source
