# Spécifications Techniques : Sous-Agent de Prospection B2B Autonome

Ce document définit l'architecture complète du nouveau module de prospection autonome pour **FLARE AI OS**. Il sert de feuille de route pour l'implémentation.

---

## 1. VISION ARCHITECTURALE

Le module de prospection est conçu comme un système **Event-Driven** et **Multi-Agents** capable de transformer une intention commerciale en une campagne d'emails personnalisés, validés par l'utilisateur, et exécutée de manière asynchrone sur l'infrastructure Google Cloud.

---

## 2. UI/UX (FRONTEND - NEXT.JS)

L'interface utilisateur doit respecter les standards ultra-premium de FLARE AI (v2.8+) avec des micro-animations `framer-motion` et un design épuré.

### A. Le Hub 'Agents'
*   **Description** : Tableau de bord central listant les campagnes.
*   **Fonctionnalités** :
    *   Cartes de campagne (Statut : `Brouillon`, `Actif`, `Terminé`).
    *   Métriques en temps réel perçues : Leads trouvés, Emails envoyés, Taux de réponse.
    *   CTA : "Nouvelle Mission de Prospection".

### B. Onboarding OAuth (Google Workspace)
*   **Composant** : `WorkspaceConnector.tsx`
*   **Flux** :
    1.  Bouton "Connecter Google Workspace".
    2.  Redirection vers Google Consent Screen avec Scopes requis :
        *   `https://www.googleapis.com/auth/gmail.send`
        *   `https://www.googleapis.com/auth/drive.file`
        *   `https://www.googleapis.com/auth/documents`
        *   `https://www.googleapis.com/auth/spreadsheets`
        *   `https://www.googleapis.com/auth/calendar`
    3.  Callback redirigeant vers `/auth/callback/google` géré par le backend.

### C. Prospecting Wizard (Split-View)
*   **Layout** : 
    *   **Gauche (Chat)** : Interface conversationnelle avec l'Agent Superviseur. Pose des questions ciblées (Cible, Offre, Ton, Contraintes).
    *   **Droite (Brief Dynamique)** : Formulaire interactif s'auto-complétant en fonction de la conversation.
*   **Persistance** : Mise à jour en temps réel via une API `PATCH /campaigns/{id}/draft` avec un **debounce** de 1000ms pour assurer la sauvegarde systématique.

### D. Écran de Validation (Draft Review)
*   **Fonctionnalité** : Avant le lancement, l'utilisateur passe en revue une liste de leads avec les emails générés.
*   **Actions** : Editer le corps de l'email, supprimer un prospect, ou "Valider Tout & Lancer".

---

## 3. SÉCURITÉ & OAUTH 2.0

### A. Flux de Jetons (Tokens)
Le backend FastAPI échange le `auth_code` reçu du frontend contre :
*   `access_token` (éphémère).
*   `refresh_token` (persistant, permettant l'action asynchrone hors-ligne).

### B. Module de Chiffrement (Security First)
Les `refresh_tokens` sont critiques. Ils doivent être chiffrés avant stockage en base de données.
*   **Algorithme** : AES-256 via la bibliothèque **Fernet** (cryptography.io).
*   **Gestion de la Clé (Master Key)** :
    *   Injectée via la variable d'env `GOOGLE_OAUTH_MASTER_KEY`.
    *   En production : Récupérée dynamiquement depuis **GCP Secret Manager** au démarrage (lifespan FastAPI).
*   **Logique de chiffrement** :
    ```python
    from cryptography.fernet import Fernet
    # encryption_service.py
    def encrypt_token(token: str) -> str: ...
    def decrypt_token(encrypted_token: str) -> str: ...
    ```

---

## 4. BASE DE DONNÉES (POSTGRESQL / SQLALCHEMY)

### Table `UserIntegrations`
*   `id` (UUID), `user_id` (FK), `integration_type` ("google_workspace"), `email` (str), `refresh_token_encrypted` (text), `created_at`, `updated_at`.

### Table `ProspectingCampaign`
*   `id` (UUID), `user_id` (FK), `title` (str), `status` (draft/queued/running/completed/failed), `prompt_context` (text), `target_count` (int), `schedule_cron` (str), `created_at`, `updated_at`.

### Table `ProspectLead`
*   `id` (UUID), `campaign_id` (FK), `company_name`, `website`, `email`, `contact_person`, `social_links` (JSONB), `status` (found/validated/sent/responded), `score` (float), `custom_data` (JSONB).

---

## 5. LOGIQUE MULTI-AGENTS (LANGGRAPH)

Implémentation dans `backend/agents/prospecting_graph.py` utilisant un pattern **Supervisor-Worker**.

### A. Supervisor (L'Intervieweur)
*   Accès direct en lecture à la **CoreMemory** (via `user_id`) pour injecter le contexte agence (FLARE AI, services, tone of voice).
*   Orchestre les transitions entre les workers après validation utilisateur.

### B. Agent Sourceur (Le Détective Modularisé)
*   **Moteur** : Hybride.
*   **Outils** :
    *   `google_search_grounding` : Pour dégrossir le marché local/global.
    *   **Hunter.io / Apollo API** : Pour trouver des emails B2B nominatifs et vérifiés.
    *   **Apify (Social Scraper)** : Pour les campagnes B2C (extraction FB/IG/LinkedIn).
*   **Intelligence** : Choisit dynamiquement l'outil en fonction de la cible définie dans le brief.

### C. Agent Rédacteur (Le Copywriter)
*   **Template** : Utilise le contexte de la CoreMemory pour personnaliser chaque email.
*   **Intégration** : Crée un dossier `FLARE_PROSPECTING_CAMP_{ID}` sur Google Drive. Génère un Google Doc par brouillon validé pour archivage.

### D. Agent Expéditeur (Le Closer)
*   S'active uniquement après validation humaine.
*   Utilise `send_gmail_asynchronous` via le `refresh_token`.

---

## 6. INFRASTRUCTURE & ASYNC (GCP)

Pour garantir la résilience sans surcoût permanent de workers Celery :

1.  **Cloud Scheduler** : Déclenche chaque mardi (ou selon le cron) un endpoint `/agents/prosp/cron`.
2.  **Google Cloud Tasks** :
    *   L'endpoint crée une tâche maître dans la queue `prospecting-queue`.
    *   Chaque prospect à traiter devient une tâche unitaire.
    *   **Pacing Humain** : Les tâches sont programmées avec un délai aléatoire (4 à 8 minutes entre chaque envoi) pour simuler un comportement humain et protéger la réputation du domaine.
    *   **Cloud Run** reçoit les requêtes de Cloud Tasks.
    *   **Retries** : Gérés nativement par Cloud Tasks en cas de 503 (rate limiting Google API).
    *   **Timeout** : Permet des exécutions longues (jusqu'à 30 min) via le mode d'exécution `HTTP Target`.

## 7. LOGIQUE DE RELANCE ET DÉLIVRABILITÉ

### A. Séquences de Follow-up (Auto)
*   Séquence standard à 2 étapes : 
    1.  Email initial.
    2.  Relance 1 à J+3.
    3.  Relance 2 à J+7.
*   **Sécurité Anti-Spam (Thread Check)** : Avant chaque relance, l'Agent Expéditeur doit impérativement lire le thread Gmail associé via l'API. Si une réponse du prospect est détectée :
    *   La séquence est immédiatement interrompue.
    *   Le statut du prospect passe à `responded`.

### B. Quotas et Limites
*   **Limite stricte** : 40 à 50 e-mails maximum par jour et par utilisateur pour préserver la santé des comptes Gmail Workspace.

## 8. MODÈLE ÉCONOMIQUE & CLÉS API (BYOK)

Le système adopte un modèle hybride "Bring Your Own Key" :
*   **Clés FLARE AI** (Hunter/Apollo/Apify) : Utilisées par défaut, débitées sur les "Crédits de prospection" de l'abonnement de l'utilisateur.
*   **Clés Utilisateur (BYOK)** : Disponibles via un nouvel onglet "Intégrations" dans `SettingsModal.tsx`. Si renseignées, elles sont utilisées en priorité et sans limite de crédit.

---
*Document validé par l'Architecte - 18 mars 2026*

