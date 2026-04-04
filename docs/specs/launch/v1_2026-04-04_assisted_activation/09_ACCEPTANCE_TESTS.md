# 09 - Cas de test d'acceptance

## 1. Paiement et plan

| # | Test | Resultat attendu |
|---|------|-------------------|
| 1.1 | Creer un nouvel espace | Plan = `free` |
| 1.2 | Verifier features chatbot sur plan free | Aucune feature business debloquee |
| 1.3 | Client choisit une offre (pro) | `selected_plan_id = pro`, plan reste `free` |
| 1.4 | Methode de paiement non configuree | Methode invisible (ex: Orange Money si pas de compte) |
| 1.5 | Client soumet preuve avec reference unique | Statut `submitted`, soumission creee |
| 1.6 | Admin valide le paiement | Statut `verified`, plan org passe a `pro` |
| 1.7 | Soumettre la meme reference 2 fois | Deuxieme soumission rejetee |
| 1.8 | Admin refuse le paiement | Statut `rejected`, plan reste `free` |

## 2. Activation assistee

| # | Test | Resultat attendu |
|---|------|-------------------|
| 2.1 | Client remplit formulaire activation | `activation_request` creee + `ChatbotPreferences` initialisees |
| 2.2 | Client confirme ajout FLARE admin page | `flare_page_admin_confirmed = true`, timestamp stocke |
| 2.3 | Admin voit la demande dans la queue | Demande visible avec tous les champs |
| 2.4 | Admin lance Facebook pour l'organisation | OAuth declenche avec le bon `organization_slug` |
| 2.5 | Page importee | `FacebookPageConnection` creee avec `status=pending` |
| 2.6 | Page activee | `is_active=true`, webhook souscrit, Direct Service synchronise |
| 2.7 | Test Messenger reel | Message envoye ET reponse recue |
| 2.8 | Statut client = actif | Client voit "Chatbot actif" dans le home |

## 3. Controle chatbot

| # | Test | Resultat attendu |
|---|------|-------------------|
| 3.1 | Global ON | Le bot repond aux messages Messenger |
| 3.2 | Global OFF | Aucune reponse automatique |
| 3.3 | Conversation en "Reprise manuelle" | Pas de reponse pour cette conversation |
| 3.4 | Conversation "Bot actif" + global ON | Reponse automatique |
| 3.5 | Conversation "Bot actif" + global OFF | Pas de reponse (global prioritaire) |

## 4. Commandes

| # | Test | Resultat attendu |
|---|------|-------------------|
| 4.1 | Signal commande detecte | Commande creee avec source `signal` |
| 4.2 | Creation manuelle depuis conversation | Commande creee avec source `manual` |
| 4.3 | Commande visible cote client | Liste commandes affiche la commande |
| 4.4 | Commande visible cote admin | Vue admin commandes affiche la commande |
| 4.5 | Changement de statut | Statut mis a jour, `updated_at` change |
| 4.6 | Pas de doublon sur reload/polling | Meme signal = meme commande (pas de doublon) |

## 5. Isolation multi-tenant

| # | Test | Resultat attendu |
|---|------|-------------------|
| 5.1 | Client A ne voit pas les paiements de B | Liste paiements filtree par org |
| 5.2 | Client A ne voit pas les commandes de B | Liste commandes filtree par org |
| 5.3 | Client A ne voit pas les conversations de B | Conversations filtrees par org |
| 5.4 | Client ne voit pas le panneau admin | Routes admin inaccessibles sans `ADMIN_EMAILS` |
| 5.5 | Operateur agit sans etre membre | Actions admin sans apparaitre dans la liste membres |

## 6. Edition apres livraison

| # | Test | Resultat attendu |
|---|------|-------------------|
| 6.1 | Client modifie preferences (ton, message accueil) | Preferences mises a jour, bot utilise les nouvelles valeurs |
| 6.2 | Page Facebook reste connectee | Pas de deconnexion apres modification preferences |
| 6.3 | Pas de reconnect Meta impose | Aucune popup Meta declenchee par la modification |
| 6.4 | Dashboard et commandes coherents | Widgets reflètent les donnees a jour |
| 6.5 | Catalogue modifie | Nouveaux produits visibles dans le chatbot |

## 7. Workflow operateur

| # | Test | Resultat attendu |
|---|------|-------------------|
| 7.1 | Demande arrive dans la queue | Visible dans Operations > Activations |
| 7.2 | Operateur s'assigne | `assigned_operator_email` mis a jour |
| 7.3 | Transitions de statut valides | Chaque transition respecte les prerequis |
| 7.4 | Transition invalide rejetee | Ex: `active` sans test = erreur |
| 7.5 | Blocage avec raison | Statut `blocked`, raison enregistree, client notifie |
| 7.6 | Note ajoutee | Note visible dans le detail, evenement audit cree |
| 7.7 | Email admin envoye | Email recu aux `ADMIN_EMAILS` a chaque `payment_submitted` |
