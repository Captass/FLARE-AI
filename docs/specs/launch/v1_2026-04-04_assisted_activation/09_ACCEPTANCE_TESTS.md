# 09 - Cas de test d'acceptance

> Dernière mise à jour : 2026-04-05
> Légende : ✅ Vérifié | ⏳ À tester | ❌ Échec connu | 🔧 Corrigé récemment

---

## 1. Paiement et plan

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 1.1 | Créer un nouvel espace | Plan = `free` | ⏳ |
| 1.2 | Vérifier features chatbot sur plan free | Aucune feature business débloquée | ⏳ |
| 1.3 | Client choisit une offre (pro) | `selected_plan_id = pro`, plan reste `free` | ⏳ |
| 1.4 | Méthode de paiement non configurée | MVola + Orange Money affichés par défaut (fallback `DEFAULT_PAYMENT_METHODS`) | 🔧 |
| 1.5 | Client soumet preuve avec référence unique | Statut `submitted`, soumission créée | ⏳ |
| 1.6 | Admin valide le paiement | Statut `verified`, plan org passe à `pro` | ⏳ |
| 1.7 | Soumettre la même référence 2 fois | Deuxième soumission rejetée | ⏳ |
| 1.8 | Admin refuse le paiement | Statut `rejected`, plan reste `free` | ⏳ |
| 1.9 | Cliquer "Voir les offres" (banner) | Banner s'affiche APRÈS le chargement (pas de flash) | 🔧 |
| 1.10 | Offres affichées dans Abonnements | Grille 4 plans visible avec CTA activation | 🔧 |
| 1.11 | Plan Entreprise → CTA | `window.location.href = mailto:` (pas de blank tab vide) | 🔧 |
| 1.12 | Erreur "demande déjà en cours" | Message lisible (pas JSON brut), reprise auto de la demande | 🔧 |

---

## 2. Connexion Facebook & page

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 2.1 | Accès hub Chatbot sans activation payante | Hub accessible directement (PageSelector + cartes visibles) | 🔧 |
| 2.2 | Cliquer "Ouvrir Meta" | Popup OAuth Facebook s'ouvre | ⏳ |
| 2.3 | Autoriser compte Facebook | Pages importées, liste visible | ⏳ |
| 2.4 | Page affichée avec toggle OFF (rouge) | Statut initial = OFF avant activation | ⏳ |
| 2.5 | Cliquer toggle ON | Page activée, webhook souscrit, toggle passe au vert | ⏳ |
| 2.6 | Cliquer toggle OFF | Page désactivée, webhook désouscrit, toggle passe au rouge | ⏳ |
| 2.7 | Actualiser la liste | Pages refreshées sans nouvelle OAuth | ⏳ |
| 2.8 | Supprimer une page inactive | Page supprimée de la BDD | ⏳ |
| 2.9 | Setup wizard ne bloque plus | Arrivée directe sur le hub (pas de wizard intermédiaire) | 🔧 |

---

## 3. Activation assistée (flow opérateur)

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 3.1 | Client remplit formulaire activation | `activation_request` créée + `ChatbotPreferences` initialisées | ⏳ |
| 3.2 | Client confirme ajout FLARE admin page | `flare_page_admin_confirmed = true`, timestamp stocké | ⏳ |
| 3.3 | Admin voit la demande dans la queue | Demande visible avec tous les champs | ⏳ |
| 3.4 | Admin lance Facebook pour l'organisation | OAuth déclenché avec le bon `organization_slug` | ⏳ |
| 3.5 | Page importée | `FacebookPageConnection` créée avec `status=pending` | ⏳ |
| 3.6 | Page activée par admin | `is_active=true`, webhook souscrit, Direct Service synchronisé | ⏳ |
| 3.7 | Test Messenger réel | Message envoyé ET réponse reçue du bot | ⏳ |
| 3.8 | Statut client = actif | Client voit KPIs + cartes cliquables dans le hub | ⏳ |

---

## 4. Contrôle bot global et par conversation

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 4.1 | Toggle global ON (vert) | Le bot répond aux messages Messenger | ⏳ |
| 4.2 | Toggle global OFF (rouge) | Aucune réponse automatique sur toute la page | ⏳ |
| 4.3 | Toggle global OFF → message reçu | Webhook reçu mais ignoré (`is_active=false` vérifié dans webhook.py) | 🔧 |
| 4.4 | Echo message du bot | Pas de boucle infinie (filtre `is_echo` et `sender==page`) | 🔧 |
| 4.5 | Toggle per-conversation OFF (rouge) | Bot ne répond plus à ce client spécifique | ⏳ |
| 4.6 | Toggle per-conversation ON (vert) | Bot reprend les réponses pour ce client | ⏳ |
| 4.7 | Toggle per-conversation + global OFF | Pas de réponse (global prioritaire) | ⏳ |
| 4.8 | Seul owner/admin peut switcher mode | Membre normal → message d'accès refusé | ⏳ |

---

## 5. Personnalisation & préférences chatbot

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 5.1 | Enregistrer identité bot (nom, ton, langue) | Préférences sauvegardées en BDD | ⏳ |
| 5.2 | Langue = Auto | Bot détecte la langue du client et répond dans la même | 🔧 |
| 5.3 | Langue = Malagasy | Bot répond en malgache | ⏳ |
| 5.4 | Message d'accueil configuré | Bot l'utilise au premier message | ⏳ |
| 5.5 | Instructions spéciales (system prompt) | Bot modifie son comportement en conséquence | ⏳ |
| 5.6 | Infos entreprise complètes (nom, secteur, description) | Injectées dans le prompt | ⏳ |
| 5.7 | Coordonnées (tel, email, site, adresse) | Bot les communique si demandé | ⏳ |
| 5.8 | Horaires d'ouverture sauvegardés | Bot communique les horaires si demandé | ⏳ |
| 5.9 | Sujets interdits configurés | Bot évite strictement ces sujets | 🔧 |
| 5.10 | Produits/services (texte libre) | Bot les utilise pour répondre aux questions tarifaires | ⏳ |
| 5.11 | Catalogue (article avec image_url) | Bot peut envoyer l'URL image dans sa réponse | ⏳ |

---

## 6. Handoff & disponibilité

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 6.1 | Mode handoff = Désactivé | Aucun transfert même si mot-clé détecté | 🔧 |
| 6.2 | Mode handoff = Manuel + mot-clé | Bot envoie message de transfert immédiatement | ⏳ |
| 6.3 | Mode handoff = Auto | Bot propose un humain sur situations complexes | ⏳ |
| 6.4 | Message de transfert configuré | Affiché tel quel à la place d'une réponse IA | ⏳ |
| 6.5 | Message hors horaires configuré | Affiché quand hors horaires (si configuré) | ⏳ |
| 6.6 | Mots-clés enregistrés (chips) | Persistés en BDD, utilisés par l'agent | ⏳ |

---

## 7. Gestion des messages entrants

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 7.1 | Message texte normal | Bot répond via IA | ⏳ |
| 7.2 | Message audio (vocal) | Bot répond "merci d'utiliser les messages texte" | 🔧 |
| 7.3 | Image/photo envoyée | Bot accuse réception et demande comment aider | 🔧 |
| 7.4 | Fichier/vidéo envoyé | Bot accuse réception et demande comment aider | 🔧 |
| 7.5 | Sticker envoyé | Bot répond "Merci pour ton message !" | 🔧 |
| 7.6 | Postback (bouton cliqué) | Bot traite le payload comme un message | ⏳ |
| 7.7 | Réponse > 1800 chars | Tronquée à 1800 chars + "…" (limite Messenger 2000) | 🔧 |
| 7.8 | Historique > 20 messages | Limité aux 20 derniers (pas d'overflow token) | 🔧 |

---

## 8. Commandes

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 8.1 | Signal commande détecté | Commande créée avec source `signal` | ⏳ |
| 8.2 | Création manuelle depuis conversation | Commande créée avec source `manual` | ⏳ |
| 8.3 | Commande visible côté client | Liste commandes affiche la commande | ⏳ |
| 8.4 | Commande visible côté admin | Vue admin commandes affiche la commande | ⏳ |
| 8.5 | Changement de statut | Statut mis à jour, `updated_at` change | ⏳ |
| 8.6 | Pas de doublon sur reload/polling | Même signal = même commande (pas de doublon) | ⏳ |

---

## 9. Isolation multi-tenant

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 9.1 | Client A ne voit pas les paiements de B | Liste paiements filtrée par org | ⏳ |
| 9.2 | Client A ne voit pas les commandes de B | Liste commandes filtrée par org | ⏳ |
| 9.3 | Client A ne voit pas les conversations de B | Conversations filtrées par org | ⏳ |
| 9.4 | Client ne voit pas le panneau admin | Routes admin inaccessibles sans `ADMIN_EMAILS` | ⏳ |
| 9.5 | Opérateur agit sans être membre | Actions admin sans apparaître dans la liste membres | ⏳ |
| 9.6 | Préférences chatbot isolées par org | Org A ne modifie pas les prefs d'Org B | ⏳ |

---

## 10. Édition après livraison

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 10.1 | Client modifie préférences (ton, message accueil) | Préférences mises à jour, bot utilise les nouvelles valeurs | ⏳ |
| 10.2 | Page Facebook reste connectée | Pas de déconnexion après modification préférences | ⏳ |
| 10.3 | Pas de reconnect Meta imposé | Aucune popup Meta déclenchée par la modification | ⏳ |
| 10.4 | Dashboard et commandes cohérents | Widgets reflètent les données à jour | ⏳ |
| 10.5 | Catalogue modifié | Nouveaux produits visibles dans le chatbot | ⏳ |
| 10.6 | Handoff mode changé | Nouveau mode pris en compte immédiatement par l'agent | ⏳ |

---

## 11. Workflow opérateur

| # | Test | Résultat attendu | Statut |
|---|------|-------------------|--------|
| 11.1 | Demande arrive dans la queue | Visible dans Opérations > Activations | ⏳ |
| 11.2 | Opérateur s'assigne | `assigned_operator_email` mis à jour | ⏳ |
| 11.3 | Transitions de statut valides | Chaque transition respecte les prérequis | ⏳ |
| 11.4 | Transition invalide rejetée | Ex: `active` sans test = erreur | ⏳ |
| 11.5 | Blocage avec raison | Statut `blocked`, raison enregistrée, client notifié | ⏳ |
| 11.6 | Note ajoutée | Note visible dans le détail, événement audit créé | ⏳ |
| 11.7 | Email admin envoyé | Email reçu aux `ADMIN_EMAILS` à chaque `payment_submitted` | ⏳ |

---

## 12. Variables d'environnement critiques à vérifier (Render)

| Variable | Valeur attendue | Statut |
|----------|----------------|--------|
| `META_APP_ID` | App ID Facebook/Meta | ⏳ |
| `META_APP_SECRET` | Secret de l'app Meta | ⏳ |
| `META_VERIFY_TOKEN` | Token webhook Meta | ⏳ |
| `META_GRAPH_VERSION` | `v25.0` (ou plus récent) | ⏳ |
| `BACKEND_URL` | URL publique du backend Render | ⏳ |
| `FRONTEND_URL` | `https://flareai.ramsflare.com` | ⏳ |
| `GEMINI_API_KEY` | Clé API Google Gemini | ⏳ |
| `GEMINI_API_KEY_CHATBOT` | Clé API Gemini dédiée chatbot | ⏳ |
| `MESSENGER_DIRECT_URL` | URL service Direct interne | ⏳ |
| `MESSENGER_DIRECT_DASHBOARD_KEY` | Clé auth service Direct | ⏳ |
| `MANUAL_PAYMENT_METHODS_JSON` | Vide → fallback MVola/Orange Money | ✅ |
| `ADMIN_EMAILS` | `cptskevin@gmail.com` | ⏳ |

---

## Ordre de test recommandé (session de test manuelle)

1. **Connexion** : se connecter avec `cptskevin@gmail.com`, vérifier org RAM'S FLARE active
2. **Hub chatbot** : vérifier accès direct (pas de wizard, PageSelector visible)
3. **OAuth Facebook** : "Ouvrir Meta", autoriser, importer la page
4. **Toggle ON** : activer la page → témoin vert
5. **Personnalisation** : remplir toutes les sections, enregistrer
6. **Test Messenger** : envoyer un message sur la page Facebook
7. **Vérifier réponse** : le bot répond selon la config (langue, ton, catalogue)
8. **Toggle per-conversation** : passer en mode humain, vérifier silence du bot
9. **Réactiver bot** : repasser en mode bot, vérifier réponse
10. **Toggle global OFF** : désactiver la page → vérifier silence total
