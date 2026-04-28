# Gmail Assistant V1

## Fonctionnel

- Connexion OAuth Google depuis Executive Desk > Assistant Mail.
- Scope Gmail en lecture seule.
- Stockage backend du refresh token via `UserIntegration`.
- Lecture des 20 derniers emails maximum.
- Filtrage simple des promotions et réseaux sociaux via la recherche Gmail.
- Classification rule-based temporaire : catégorie, priorité, résumé, action recommandée.
- Proposition de réponse sans envoi, sans brouillon, sans modification Gmail.
- Copie de la réponse proposée côté frontend.
- Fallback vers les données démo si Gmail n'est pas connecté ou si l'API échoue.

## Gmail Triage V1.1

L'Assistant Mail classe maintenant les emails dans 3 sections :

- `Prioritaires` : mails à traiter rapidement.
- `À vérifier` : mails utiles mais pas forcément urgents.
- `Non prioritaires` : newsletters, notifications et messages automatiques, masqués par défaut.

### Logique de scoring

Chaque mail reçoit un score rule-based via `scoreGmailMessage(message)`.

Points positifs :

- mots d'action : urgent, important, réponse, demande, rendez-vous, confirmation, devis, facture, paiement, partenariat, client, validation, planning ;
- expéditeur non automatique ;
- conversation directe probable ;
- catégorie utile : Client, Partenaire, Finance ou Pro ;
- question ou demande d'action détectée ;
- mail récent.

Points négatifs :

- expéditeur automatique : no-reply, noreply, newsletter, marketing, promo ;
- sujet de type newsletter, promotion, live, webinar, notification ou alerte automatique ;
- catégorie Newsletter ou Notification ;
- réseaux sociaux ou plateformes automatiques.

Buckets :

- score `>= 70` : Prioritaires ;
- score `>= 35` et `< 70` : À vérifier ;
- score `< 35` : Non prioritaires.

L'API `/api/gmail/messages` retourne maintenant `priority`, `review`, `low`, `counts` et conserve aussi `messages` pour compatibilité.

## Gmail Reply V1.2

Le composeur de reponse permet maintenant :

- choisir un mail depuis l'interface ;
- demander une generation IA legere avec une instruction libre ;
- modifier le texte avant envoi ;
- envoyer la reponse directement depuis Gmail via FLARE AI, apres confirmation explicite.

### Modele IA

- generation via un modele Gemini leger cote serveur ;
- fallback rule-based si le modele ne repond pas ;
- aucun token Gmail n'est expose au frontend.

### Contraintes actuelles

- le premier envoi peut necessiter une reconnexion Gmail si la connexion initiale a ete faite avant l'ajout du scope `gmail.send` ;
- l'envoi est confirme manuellement dans l'interface ;
- le brouillon n'est pas encore sauvegarde dans Gmail ;
- l'envoi est rattache au `message_id` cote serveur pour eviter qu'un client web forge un destinataire arbitraire.

## Gmail Reader V1.3

Le panneau d'ouverture d'un mail charge maintenant le detail reel a la demande :

- objet complet ;
- expediteur ;
- date ;
- contenu texte complet du mail ;
- pieces jointes detectees ;
- telechargement des pieces jointes depuis FLARE AI.

### Choix d'architecture

- la liste `/api/gmail/messages` reste legere pour conserver un triage rapide ;
- le detail complet est charge seulement quand l'utilisateur ouvre un mail ;
- les pieces jointes sont telechargees a la demande via un endpoint dedie.

## Gmail Stability V1.4

Correctifs ajoutés pour rendre l'assistant réellement utilisable :

- ouverture directe de `/app?view=executive-mail` sans repasser par l'accueil ;
- timeout sur la récupération du token Firebase pour éviter l'écran d'initialisation bloqué ;
- décodage des sujets et expéditeurs MIME ;
- nettoyage du contenu Gmail : liens de tracking, blocs encodés, textes de désabonnement et HTML lourd ;
- tri renforcé contre les faux positifs : codes de vérification, alertes sécurité, login, PayPal, accusés automatiques ;
- modale de lecture élargie et protégée contre les longues lignes.

## Variables d'environnement

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://votre-backend/api/gmail/callback
GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send
GOOGLE_OAUTH_MASTER_KEY=
```

`GOOGLE_OAUTH_MASTER_KEY` doit être une clé Fernet en production. Sans clé, le stockage fonctionne en développement mais les tokens ne sont pas chiffrés.

Pour les tests locaux :

- backend : `GOOGLE_REDIRECT_URI=http://localhost:8000/api/gmail/callback`
- frontend : ouvrir FLARE AI sur `http://localhost:3001` ou `http://127.0.0.1:3001`
- si le frontend local tourne sur une autre origine, l'ajouter dans `EXTRA_CORS_ORIGINS`

## Scope utilisé

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
```

Scopes volontairement exclus en V1 :

- `https://mail.google.com/`
- `gmail.modify`
- `gmail.compose`

## Limites V1

- Pas d'envoi automatique sans confirmation utilisateur.
- Pas de suppression ou modification d'email.
- Pas de création de brouillon Gmail.
- Pas d'intégration Google Calendar.
- Génération IA légère avec fallback rule-based.
- Token store basé sur la table existante `user_integrations`.
- La V1.4 lit les 20 derniers mails et peut encore mal classer certains emails ambigus.

## Prochaines étapes

- Chiffrage obligatoire et rotation des clés OAuth en production.
- Déconnexion Gmail visible dans les paramètres.
- Analyse IA réelle avec budget et garde-fous.
- Réglages utilisateur pour ajuster les catégories et les faux positifs.
- Création de brouillons Gmail après confirmation utilisateur.
- Mapping des mails vers tâches Executive Desk.
- Tests OAuth réels sur localhost avec un projet Google Cloud dédié.

## Gmail Assistant V1.5

Mise à jour du 28 avril 2026. Stabilisation et polissage de l'assistant mail existant.

### Ce qui a changé

**Triage renforcé :**

- Ajout de nombreux expéditeurs automatiques : `notification`, `support`, `billing`, `alert`, `info@`, `mailer-daemon`, `postmaster`, `updates`, `accounts`, `security`, `donotreply`, `bounce`, `feedback`, `system`.
- Ajout de termes de sujet faible : `receipt`, `order confirmation`, `shipping`, `livraison`, `tracking`, `survey`, `subscription`, `abonnement`, `welcome to`, `bienvenue`, `confirm your email`, `verify your email`.
- Ajout de plateformes : `github`, `gitlab`, `slack`, `notion`, `trello`, `jira`, `stripe`, `amazon`, `apple`, `microsoft`, `zoom`, `teams`, `dropbox`, `spotify`, `netflix`, `uber`, `airbnb`, `pinterest`, `snapchat`, `whatsapp`, `telegram`, `signal`, `reddit`.
- Ajout de contenus automatiques : `this is an automated message`, `ceci est un message automatique`, `your verification code is`, `your security code`, `use this code`, `expiring soon`, `automatically generated`, `this email was sent to`, `you are receiving this`, `manage your notifications`, `update your preferences`.
- Protection des vrais mails pro : les termes de plateforme ne pénalisent plus un email si l'expéditeur est non automatique ET la catégorie est Client, Partenaire, Finance, Pro, Rendez-vous ou Planning.

**Prompt IA amélioré :**

- Le prompt ne dit plus "Tu es l'assistant mail de FLARE AI" — il répond au nom de l'utilisateur.
- Instruction explicite : ne jamais écrire "l'équipe FLARE AI" ou "FLARE AI" dans la réponse.
- Détection de langue : si le mail source est en français, la réponse est en français. Si en anglais, en anglais.
- Anti-hallucination renforcé : ne pas promettre d'action impossible, ne pas inventer de pièce jointe, date, numéro de téléphone.

**Stabilité frontend :**

- Ajout d'un écran de chargement de session Gmail au lieu d'un écran blanc pendant l'initialisation.
- Si le token Firebase n'est pas disponible et que le chargement est terminé, un message clair invite à se connecter au lieu de laisser une page vide.

**Historique local enrichi :**

- `MailActivityEntry` inclut maintenant : `aiGeneratedAt`, `copiedAt`, `sendErrorAt`, `sendErrorMessage`.
- La génération IA, la copie et les erreurs d'envoi sont enregistrées dans le localStorage.
- La section "Réponses récentes" affiche des badges : `IA`, `Copié`, `Erreur`.
- Le suivi reste par `message.id` et séparé par compte Gmail connecté.

### Comment tester

1. Démarrer le backend : `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`
2. Démarrer le frontend : `npm.cmd run dev -- --port 3001` dans `frontend/`
3. Ouvrir `http://127.0.0.1:3001/app?view=executive-mail`
4. Vérifier :
   - pas d'écran blanc à l'ouverture directe ;
   - Gmail connecté affiche un état cohérent ;
   - les mails se chargent et sont triés en 3 sections ;
   - un mail peut être ouvert avec contenu lisible ;
   - la génération IA fonctionne ;
   - le brouillon est modifiable et copiable ;
   - l'envoi montre une confirmation avant action.

### Limites restantes

- Le triage reste rule-based et peut encore classer un mail de manière inattendue.
- La V1.5 lit les 20 derniers mails maximum.
- Le brouillon n'est pas sauvegardé dans Gmail (pas de gmail.compose).
- Le profil utilisateur (nom, signature, ton) n'est pas encore configurable pour la génération IA.
- L'historique est en localStorage uniquement (pas persisté côté serveur).

### Risques Gmail/OAuth

- Les scopes `gmail.readonly` et `gmail.send` sont sensibles/restricted. Une app publique nécessite une vérification Google.
- Les tokens Gmail doivent être chiffrés en production via `GOOGLE_OAUTH_MASTER_KEY` (clé Fernet).
- L'envoi Gmail est une action réelle : tout test doit utiliser un compte et un destinataire de test.

### Statut de l'envoi Gmail

L'envoi Gmail existe côté backend et frontend avec confirmation manuelle. **Aucun envoi réel n'a été effectué lors de cette session de V1.5.** Le code est testé par compilation et build, pas par envoi réel.

### Vérification effectuée

- `python -m compileall backend\routers\gmail.py backend\core\gmail_token_store.py backend\core\config.py` → OK
- `npm.cmd run build` dans `frontend/` → OK (compiled successfully, types OK, 21 static pages)
