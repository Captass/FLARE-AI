# FLARE AI OS V2 — Tâches & Avancées

> Document de suivi pour la continuité entre sessions de développement.
> Dernière mise à jour : **25 mars 2026**

---

## ÉTAT COURANT — AUDIT PROD CHAT

### Validé en production

- [x] Auth Firebase
- [x] Sync backend utilisateur
- [x] Récupération du plan
- [x] Chat simple
- [x] Mémoire auto
- [x] Mémoire manuelle
- [x] Knowledge create / search / refresh / upload
- [x] Génération image
- [x] Génération Word
- [x] Génération Excel
- [x] Génération vidéo
- [x] `FilesPanel`
- [x] Historique conversations/messages

### Reste à corriger

- [ ] `animate_image` : l'animation image → vidéo est encore instable en production

### Correctifs récents déjà faits

- [x] Normalisation mémoire `user_age` → `19 ans`
- [x] Extraction mémoire immédiate sur messages utilisateur
- [x] Audit backend automatisé via `backend/scripts/chat_audit.py`
- [x] Suppression des faux fallbacks vidéo de démonstration
- [x] Génération vidéo live validée de bout en bout
- [x] `FilesPanel` reflète bien image / document / sheet / video

---

## FAIT (Session 21 mars 2026 — Claude Code, Session 3 — UI/UX Refonte)

### Refonte Chat Full-Width (style ChatGPT)
- [x] **Messages IA full-width** : suppression du conteneur bulle, messages en pleine largeur
- [x] **Welcome page marketing** : titres courts et impactants ("Hey {user}, Qu'est-ce qu'on construit ?")
- [x] **Suggestion cards** : redesign avec couleurs charte (orange léger, gris)

### Adaptation Mobile Complète
- [x] **Mode toggle (Pro/Flash)** : icônes seules sur mobile, labels complets sur desktop
- [x] **Deep Research** : renommé depuis "Outils", icône seule sur mobile
- [x] **Boutons Image/Vidéo** : visibles sur mobile avec tailles adaptées
- [x] **Bouton Envoyer** : corrigé (était invisible blanc sur blanc) → navy `#1B2A4A`
- [x] **Swap mic/send** : micro à droite, envoyer à gauche sur mobile (`order-first md:order-last`)

### Sidebar — Sélection & Déplacement
- [x] **Déplacer vers un espace** : fonctionnalité réelle de déplacement (bulk et individuel)
- [x] **Drag & drop** : glisser-déposer conversations entre espaces
- [x] **Long press mobile** : 600ms pour entrer en mode sélection
- [x] **Click-triggered dropdown** : menu déplacement au clic (pas hover) pour mobile
- [x] **Simplification** : suppression bouton "Tout", merge en toggle "Sélectionner"

### Charte Graphique (Blanc, Noir, Gris, Orange léger, Navy Blue)
- [x] **KnowledgePanel** : réécriture complète, jargon supprimé, couleurs charte
- [x] **FilesPanel** : réécriture complète, layout simplifié, couleurs charte
- [x] **MessageInput** : send button navy, image/video buttons navy
- [x] **ChatWindow** : citations et sources en theme vars + hover orange
- [x] **Sidebar** : sélection/déplacement en theme vars

---

## FAIT (Session 21 mars 2026 — Claude Code, Session 2)

### Bugs Critiques Production — Tracking Admin
- [x] **`record_usage()` jamais appelé** : la fonction existait dans `database.py` mais n'était invoquée nulle part → ajout dans `supervisor.py` après chaque message
- [x] **Double-comptage média** : `supervisor.py` ET `media.py` loguaient les images/vidéos séparément → ajout check `_has_media_tools` pour éviter le doublon
- [x] **Context variables** : `_current_user_id`, `_current_session_id`, `_current_request_id` ajoutés dans `media.py` comme fallback quand `configurable` est vide
- [x] **Colonne `usage_metadata` manquante** : `psycopg2.errors.UndefinedColumn` en prod → migration `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS usage_metadata JSONB` ajoutée dans `main.py`
- [x] **Backfill historique** : endpoint `POST /api/admin/backfill-usage` créé dans `admin.py` — scanne `conversation_files` + `messages` pour remplir rétroactivement `UsageLedger`
- [x] **`ACTION_NORMALIZE`** : ajout mapping `"workspace": "message"` dans `admin.py`
- [x] **Frontend auto-backfill** : `AdminPanel.tsx` appelle `backfillAdminUsage()` silencieusement avant chaque fetch
- [x] **Résultat** : Images: 11, Vidéos: 1, Messages: 65+ — compteurs enfin synchronisés

### CORS & Domaine Custom
- [x] **CORS bloquait le PIN** : `https://flareai.ramsflare.com` et `https://www.flareai.ramsflare.com` ajoutés dans `_allowed_origins` (main.py)

### Google OAuth redirect_uri_mismatch
- [x] **Diagnostic** : l'URL complète `/__/auth/handler` était dans "Origines JS autorisées" (n'accepte que domaines)
- [x] **Guidage** : domaine seul dans origines JS, URL complète dans URIs de redirection → corrigé par Kévin

### Optimisation Vitesse (4.2s → ~1-2s)
- [x] **Firebase KB désactivé pour chat** : `_build_system_prompt(include_kb=False)` pour le path chat → économise 1-3s de latence réseau Firebase
- [x] **Résultat** : TTFB réduit significativement pour les messages simples

### Fix Streaming [SUGGESTION:] Tags (v2)
- [x] **Bug résiduel** : le buffer flush utilisait `re.match(r'^\[SUGGESTION:', ...)` qui échouait avec whitespace devant
- [x] **Fix backend** : `re.sub(r'\[SUGGESTION:\s*[^\]]*\]', '', _stream_buffer)` pour nettoyer robustement
- [x] **Fix frontend** : filet de sécurité dans `ChatWindow.tsx` — `.replace(/\[SUGGESTION:\s*[^\]]*\]/gi, "")` dans le rendu ReactMarkdown

### Volume Hymne National
- [x] **Volume baissé** : `audioRef.current.volume = 0.06` dans `LandingPage.tsx`

---

## FAIT (Session 21 mars 2026 — Antigravity)

### Admin Panel — Sync & Deploy
- [x] **Admin router manquant** : `admin_router` importé et inclus dans `main.py` (causait des 404)
- [x] **Chemins API corrigés** : frontend `api.ts` → `/api/admin/usage/summary` et `/api/admin/usage/ledger`
- [x] **Dépendance `slowapi`** : ajoutée dans `requirements.txt` (manquante → échec build Cloud Run)
- [x] **Import `Body`** : ajouté dans `routers/admin.py` (NameError corrigé)
- [x] **Encodage `requirements.txt`** : réencodé en UTF-8 (caractères invisibles causaient crash pip)

### Synchronisation Modèles & Coûts UI
- [x] **AdminPanel.tsx** : "FLASH 2.5" → "GEMINI 3 FLASH" (en-tête tableau)
- [x] **SettingsModal.tsx** : toutes les références "2.5" → "3.6" (version OS, guide, engine label)
- [x] **Vérification backend** : prix token confirmés dans `config.py` — `AI_PRICING` utilise les vrais tarifs Gemini mars 2026

### Fix Streaming [SUGGESTION:] Tags
- [x] **Bug** : les tags `[SUGGESTION: ...]` générés par le LLM apparaissaient en clair dans le chat
- [x] **Cause** : le prompt demande au LLM d'écrire ces tags, `_extract_suggestions()` les nettoie APRÈS le streaming — mais les deltas sont envoyés au frontend PENDANT le streaming
- [x] **Fix** : ajout d'un **buffer de streaming intelligent** dans `supervisor.py` qui intercepte les `[SUGGESTION:]` en temps réel avant envoi au frontend
- [x] **Backend déployé** : revision `flare-ai-backend-00093-qp9` (Cloud Run europe-west9)
- [x] **Frontend déployé** : Firebase Hosting (`rams-flare.web.app`)

---

## FAIT (Session 21 mars 2026 — Claude Code + Antigravity)

### Optimisation Vitesse Agent
- [x] **Classification sans LLM** : `classify_request()` refactorisé en routage 100% mots-clés (<1ms au lieu de 2-5s)
- [x] **Bug `_user_model` corrigé** : variable indéfinie dans `supervisor.py` → crash évité
- [x] **Suppression double quota** : `chat.py` ne fait plus de vérification redondante (le supervisor gère via `check_quota`)
- [x] **Cache `user_email`** : 1 seule query DB au lieu de N par requête worker (dans `on_chat_model_end`)
- [x] **Workers async** : `_call_model` passe de `llm.invoke()` synchrone à `await llm.ainvoke()` (researcher, media, workspace)
- [x] **Mémoire background** : `CoreMemory(user_id)` local au lieu du singleton (fix race condition multi-user)
- [x] **Fréquence mémoire** : extraction tous les 4 messages au lieu de 8
- [x] **Modèle background** : Flash-Lite (`GEMINI_ROUTING_MODEL`) au lieu de Flash pour les tâches mémoire

### Refactoring Quota
- [x] **Système de quotas basé sur les coûts** : passage de compteur de messages à budget quotidien en USD
- [x] **`check_quota()`** : nouvelle fonction basée sur `UsageLedger` (coûts réels)
- [x] **Plans** : Free ($0.05/jour), Pro ($0.50/jour), Business (illimité)
- [x] **Pricing Gemini 3** : tarifs mars 2026 dans `AI_PRICING` + `MEDIA_PRICING`
- [x] **`seed_subscription_plans()`** : upsert (update existing plans)
- [x] **`get_user_subscription()`** : calcul usage quotidien depuis UsageLedger en temps réel
- [x] **Frontend `UserPlan`** : interface TypeScript mise à jour (daily_budget_usd, daily_cost_usd, etc.)
- [x] **`SettingsModal.tsx`** : affichage adapté au nouveau format (budget quotidien, reset minuit UTC)

### Configuration & Sécurité
- [x] **`GEMINI_PRO_MODEL`** ajouté dans `config.py` (gemini-3.1-pro-preview)
- [x] **`GEMINI_ROUTING_MODEL`** ajouté (gemini-3.1-flash-lite)
- [x] **`ADMIN_EMAILS`** dans config au lieu de hardcodé
- [x] **CORS** : origines restreintes au lieu de `allow_origins=["*"]`
- [x] **Modèles LLM mis à jour** : gemini-3-flash, gemini-3.1-pro-preview
- [x] **Rate limiting** : `slowapi` ajouté pour limiter les abus API
- [x] **Validation Firebase Auth** : `check_revoked=True` pour la vérification token
- [x] **Auth domain Firebase** : corrigé vers `flareai.ramsflare.com`

### Bug Fixes Production
- [x] **Import `core_memory`** manquant dans `prospecting_graph.py` → supprimé (inutilisé)
- [x] **Import `logging`** manquant dans `routers/prospecting.py` → ajouté
- [x] **`auth_sync.py`** : rewrite pour nouveau format quota
- [x] **Auto-migration PostgreSQL** : ALTER TABLE pour subscription_plans + user_subscriptions

### Restauration UI Premium (Antigravity)
- [x] **Backup complet** : création d'une archive de l'état du projet avant restauration
- [x] **Restauration ciblée** : fichiers du frontend restaurés depuis l'état premium
- [x] **Compatibilité API** : résolution de 10 conflits de typage
- [x] **Déploiement Frontend** : redéployé avec l'UI Premium restaurée

---

## FAIT (Session 21 mars 2026 — Claude Code)

### Inscription Sécurisée PIN 6 Chiffres
- [x] **`routers/email_verification.py`** : nouveau router avec `POST /api/auth/send-pin` et `POST /api/auth/verify-pin`
- [x] **`main.py`** : import + inclusion du `email_verification_router`
- [x] **`api.ts`** : fonctions `sendVerificationPin()` et `verifyEmailPin()` ajoutées
- [x] **`useAuth.ts`** : `sendSignupPin()` et `verifySignupPin()` exposés dans l'interface `AuthState`
- [x] **`LoginScreen.tsx`** : UI complète réécrite — mode `pin` avec 6 inputs séparés, gestion paste, cooldown renvoi 60s
- [x] **`page.tsx`** : props `onSendPin` et `onVerifyPin` passés à `LoginScreen`
- **Sécurité** : PIN `random.SystemRandom()`, expiration 10 min, max 5 tentatives, max 3 envois/heure, code usage unique
- **Dev mode** : si SMTP non configuré → PIN retourné dans la réponse API + affiché dans l'UI
- **Email HTML** : template dark premium (indigo/violet) + version texte plain

---

## FAIT (Session 21 mars 2026 — Agent ALPHA/BETA/GAMMA/DELTA)

### UI / UX & Admin
- [x] **Restructuration Admin Panel** : divisé en onglets (Cost Intelligence, Utilisateurs Connectés en temps réel, Nouveaux Comptes). Backend lié avec succès.
- [x] **Restructuration Agents Panel** : affichage de tous les agents avec statut (Prospection: actif, CM: en dev, Contenu: en dev, autres: bientôt).
- [x] **Mode guidé System Prompt** : formulaire structuré (Profil, Ton, Format, Détails) ajouté dans les paramètres, avec fonctions de parsing bidirectionnelles pour stocker la chaîne complète en BDD.
- [x] **Confirmation reset mot de passe** : ajout d'une alerte et d'un changement d'état UI lors de l'oubli de mot de passe.

### Backend & Monétisation
- [x] **Paiement Stripe** : module backend initié (`routers/billing.py`) avec création de session Checkout et sécurisation stricte des Webhooks pour l'upgrade automatique du plan utilisateur. UI branchée dans le modal de paramètres.
- [x] **OAuth Google per-user** : flux d'autorisation (auth/callback) implémenté dans `routers/google_auth.py`, chiffré en BDD et gated par abonnement (bloqué pour le plan Free). UI-shell du bouton ajoutée dans le panel Agents.

## ⚠️ ORDRES ÉQUIPE — À FAIRE MAINTENANT (Audit 22 mars 2026, 2ème passe)

> **Le bug FilesPanel (point 1) est CORRIGÉ. Bien joué. Le JSON structuré ArtifactViewer (point 2 partiel) est fait aussi.**
> **Il reste 2 tâches NON TERMINÉES ci-dessous. Elles doivent être faites AVANT de passer au Content Creator.**
> **Ne marquez PAS [x] tant que le code n'est pas réellement implémenté.**

### ~~1. FilesPanel "Aucun fichier"~~ — ✅ RÉSOLU
Code corrigé end-to-end (supervisor → workers → memory → files.py → FilesPanel.tsx).

### 2. Sélection par blocs dans ArtifactViewer — EN COURS (JSON fait, UI manquante)

**Ce qui est fait** : Le micro-chat envoie maintenant du JSON structuré `{prompt, selection}` au lieu d'un string. Le backend le parse correctement via `[CONTEXTE DE SÉLECTION]`.

**Ce qui manque** : L'utilisateur tape toujours en aveugle dans un textarea. Il n'a aucun moyen de VOIR et CHOISIR quelle section du document il veut modifier.

**TÂCHE A — Dropdown de sélection de section (Document Word)** :
- Fichier : `frontend/src/components/ArtifactViewer.tsx`
- Quand `artifact.type === "document"` et que le micro-chat s'ouvre :
  1. Appeler `GET` sur l'URL du document pour obtenir le JSON des sections (via un nouvel endpoint ou en appelant `read_word_document_as_json` depuis le frontend)
  2. Parser le JSON et extraire les blocs : titres (`type: "title"`), headings (`type: "heading"`), paragraphes (premiers 50 caractères), tableaux (`type: "table"`)
  3. Afficher un **dropdown au-dessus du textarea** avec la liste des blocs. Exemple :
     ```
     [Sélectionner une section ▼]
     ├── Titre : "Rapport Annuel FLARE AI"
     ├── Section 1 : "Introduction"
     ├── § "Notre mission est de démocratiser..."
     ├── Section 2 : "Analyse du marché"
     ├── Tableau : "Revenus par trimestre" (4 colonnes)
     └── Section 3 : "Conclusion"
     ```
  4. Quand l'utilisateur sélectionne un bloc, injecter le texte sélectionné dans le JSON envoyé :
     ```json
     {
       "prompt": "Rends plus concis",
       "selection": {
         "type": "text_selection",
         "selected_text": "Notre mission est de démocratiser l'accès à l'IA...",
         "block_index": 3,
         "file_url": "https://storage.googleapis.com/..."
       }
     }
     ```
  5. Le dropdown doit être **optionnel** — si l'utilisateur ne sélectionne rien, l'IA modifie le document entier selon la demande

**TÂCHE B — Sélection de plage Excel** :
- Fichier : `frontend/src/components/ArtifactViewer.tsx`
- Quand `artifact.type === "sheet"` et que le micro-chat s'ouvre :
  1. Appeler `read_excel_document_as_json` (même principe que pour Word)
  2. Afficher un dropdown avec les **feuilles** du classeur, puis permettre de taper une **plage** (ex: `A1:D10`)
     ```
     Feuille : [Ventes 2026 ▼]
     Plage :   [A1:D10        ]  (optionnel)
     ```
  3. Injecter dans le JSON :
     ```json
     {
       "prompt": "Ajoute une colonne TVA",
       "selection": {
         "type": "cell_selection",
         "sheet_name": "Ventes 2026",
         "range": "A1:D10",
         "file_url": "https://storage.googleapis.com/..."
       }
     }
     ```

**TÂCHE C — Endpoint backend pour lire la structure d'un document** :
- Fichier : `backend/routers/files.py` ou `backend/routers/content_studio.py`
- Créer un endpoint :
  ```
  GET /api/files/structure?url={document_url}
  ```
  - Si l'URL pointe vers un `.docx` → appeler `read_word_document_as_json(url)` et retourner le JSON
  - Si l'URL pointe vers un `.xlsx` → appeler `read_excel_document_as_json(url)` et retourner le JSON
  - Le frontend utilise cet endpoint pour peupler le dropdown

**Fichiers à modifier** :
- `frontend/src/components/ArtifactViewer.tsx` — ajouter dropdown sections + plage Excel
- `frontend/src/lib/api.ts` — ajouter fonction `fetchDocumentStructure(url: string)`
- `backend/routers/files.py` — ajouter endpoint `GET /api/files/structure`

### 3. PDF Generation — SUPPRIMER LE FAUX MESSAGE

**Le message "Une version PDF est en cours de génération" est MENSONGER. L'utilisateur attend pour rien.**

**Action simple et immédiate** : Supprimer le bloc `if generate_pdf:` + le message trompeur dans les deux fichiers. On réimplémentera proprement plus tard avec un vrai microservice.

- Fichier 1 : `backend/agents/workers/document_worker.py` lignes 221-223
  **Supprimer** :
  ```python
  if generate_pdf:
      logger.info(f"[PDF Generation] Appel simulé au microservice de conversion PDF pour {safe_filename}")
      pass
  ```

- Fichier 2 : `backend/agents/workers/spreadsheet_worker.py` lignes 176-180
  **Supprimer** :
  ```python
  if generate_pdf:
      logger.info(f"[PDF Generation] Appel simulé au microservice de conversion PDF pour {safe_filename}")
      pass
  ```

- Supprimer aussi le paramètre `generate_pdf: bool = False` des signatures des deux fonctions `generate_word_document` et `generate_excel_document`
- Supprimer les mentions de `generate_pdf` dans les `DOCUMENT_SYSTEM_PROMPT` et `SPREADSHEET_SYSTEM_PROMPT`

**C'est 4 suppressions, 5 minutes de travail. Pas d'excuse.**

---

## À FAIRE (Prochaines sessions)

### Priorité HAUTE — Agent Création de Contenu (Studio Créatif)

> **Vision** : Studio créatif IA complet, accessible depuis AgentsPanel → "Agent Création de Contenu". Module INDÉPENDANT du chat avec sa propre interface et sous-agents.
> **Spec complète** : voir **`docs/instructions/CONTENT_CREATOR_ARCHITECTURE.md`**

#### Phase 1 — Copywriter Agent (Équipe dev IA)
- [ ] `backend/agents/content_studio/copywriter_agent.py` — Rédaction marketing (posts, articles, scripts vidéo, emails, copy)
- [ ] `backend/agents/content_studio/supervisor.py` — ContentCreatorSupervisor orchestrateur
- [ ] `backend/routers/content_studio.py` — Endpoints API (`/api/content-studio/generate`, `/projects`, `/export`)
- [ ] `frontend/src/components/ContentStudioPage.tsx` — Interface studio (projets + zone de travail + onglets)
- [ ] `frontend/src/components/CopywriterPanel.tsx` — Onglet textes (brief, plateforme/ton, preview, export)
- [ ] Routing AgentsPanel : clic "Agent Création de Contenu" → ouvre `ContentStudioPage` (PAS un chat)

#### Phase 2 — Graphic Designer Agent (Équipe dev IA)
- [ ] `backend/agents/content_studio/graphic_designer_agent.py` — Composition en couches : Imagen (fond) + Pillow (typo/layout)
- [ ] `backend/agents/content_studio/fonts_manager.py` — Téléchargement Google Fonts à la demande
- [ ] `frontend/src/components/GraphicDesignerPanel.tsx` — Choix format/police/couleurs, preview, export multi-plateforme
- [ ] Dépendances : `Pillow>=10.0.0`, `rembg>=2.0.0`, `playwright>=1.40.0`
- [ ] Formats supportés : Post IG 1080×1080, Story 1080×1920, Post FB 1200×630, LinkedIn 1200×627, A4, YouTube Thumbnail

#### Phase 3 — Video Generator Agent (Équipe dev IA)
- [ ] `backend/agents/content_studio/video_generator_agent.py` — Storyboard auto + génération Veo 2.0 par scène
- [ ] `frontend/src/components/VideoGeneratorPanel.tsx` — Interface storyboard (cartes par scène, régénérer/modifier/uploader rush)
- [ ] Storyboard structuré : Gemini Pro décompose brief en scènes (timing, prompts visuels, voix-off, mood, caméra)
- [ ] Rushes utilisateur : upload vidéos existantes intégrées au storyboard
- [ ] Bouton "Envoyer au monteur" → passe clips au VideoEditor (Phase 4)

#### Phase 4 — Video Editor Agent (Claude Opus)
> **Assigné à Claude (Opus)**. Voir spec détaillée dans `CONTENT_CREATOR_ARCHITECTURE.md` section Phase 4.
- [ ] `backend/agents/content_studio/video_editor_agent.py` — Agent monteur LangGraph avec EDL JSON
- [ ] `backend/agents/content_studio/video_render_engine.py` — Moteur FFmpeg (interprète l'EDL)
- [ ] `backend/agents/content_studio/assets/` — LUTs color grading + overlays transitions pré-rendues
- [ ] `frontend/src/components/VideoEditorPanel.tsx` — Interface montage avec timeline
- [ ] `frontend/src/components/VideoTimeline.tsx` — Composant timeline interactif (pistes vidéo/texte/audio)
- [ ] Compétences : coupes, transitions pro, textes animés, raccords ciné, motion design, color grading, audio, sous-titres auto, export multi-format
- [ ] Infra : FFmpeg dans Dockerfile, Cloud Run 2Gi+ RAM, 2+ CPU, timeout 900s

---

### Priorité HAUTE (suite) — Sub-Agents Documents & Outils

> **Vision** : L'utilisateur clique sur un bouton "Outils" (icône boîte à outils) dans la barre d'input. Un menu s'ouvre avec les outils disponibles. Chaque outil déclenche un sub-agent backend spécialisé qui tourne en arrière-plan.

- [x] **Bouton "Outils" dans MessageInput** : dropdown avec Deep Research, Créer un Document, Tableur Intelligent
- [x] **Sub-Agent "Créateur de Documents" (DOCX)** : `document_worker.py` — CRUD complet, design soigné, téléchargement
- [x] **Sub-Agent "Tableur Intelligent" (Excel/XLSX)** : `spreadsheet_worker.py` — CRUD complet, mise en forme, graphiques
- [x] **Architecture Sub-Agents** : invocation par `supervisor.py`, stream résultat, stockage GCS, affichage dans FilesPanel


### Opération Usine Laboratoire (Phase 1 à 4) - FAIT
- [x] **UI Artifacts (Side-by-Side)** : Panneau latéral interactif pour l'affichage de documents, avec bouton plein écran/présentation et responsive mobile (Overlay).
- [x] **Word & Excel Avancé (Cheat Code)** : Insertion d'images Base64 dans Word, création de tableaux de bord et graphiques natifs dans Excel.
- [x] **Inpainting Images** : Outil pinceau UI avec canvas superposé pour masquer des zones, interfacé avec Google GenAI (Imagen 3).
- [x] **Édition Contextuelle (Micro-Chat)** : Barre de chat intégrée aux documents permettant de cibler des sélections (`[SÉLECTION: ...]`).
- [x] **Vidéo** : Câblage LRO asynchrone pour Veo 2.0 (génération & édition).
- [x] **Historique de Versions** : Dropdown de navigation temporelle (v1, v2) dans le Viewer.
- [x] **Révision Collaborative Word** : Commentaires IA en rouge/italique pour correction.
- [x] **CodeMirror Natif** : Remplacement de l'iframe par un éditeur de code interactif pour les fichiers JSON/JS/HTML.

### Priorité Moyenne (Technique & Fiabilité)
- [ ] **Stabilité BDD** : gestion reconnexion PostgreSQL, pooling robuste, et mise en place d'une vraie migration **Alembic** (actuellement `SQLAlchemy.create_all` au démarrage).

### Priorité Moyenne (Fonctionnelle & Infra)
- [ ] **Apps natives** : Capacitor (pour export Android/iOS) + Tauri (pour exécutable desktop Windows/Mac).

### Priorité Basse
- [ ] **Système de paiement Stripe** : finaliser l'intégration Stripe (checkout, webhooks, upgrade auto). Module `billing.py` initié mais non terminé.
- [ ] **TTS** : text-to-speech via Gemini pour la lecture audio des réponses de l'assistant.
- [ ] **Google Sheets CRUD** : lecture/écriture/création de spreadsheets (à lier avec l'OAuth Google).

---

## Architecture Actuelle (21 mars 2026)

- **Backend** : FastAPI + LangGraph + SQLAlchemy (SQLite dev / PostgreSQL Cloud SQL prod)
- **Frontend** : Next.js 14 + TypeScript + Tailwind CSS + Framer Motion
- **LLM Raisonnement** : `gemini-3.1-pro-preview` (configuré via `GEMINI_PRO_MODEL`)
- **LLM Rapide** : `gemini-3-flash` (configuré via `GEMINI_MODEL`)
- **LLM Routage/Background** : `gemini-3.1-flash-lite` (configuré via `GEMINI_ROUTING_MODEL`)
- **Images** : `gemini-3.1-flash-image-preview` (Nano Banana 2)
- **Audio** : `gemini-2.5-flash-lite`
- **TTS** : `gemini-2.5-flash-preview-tts`
- **Auth** : Firebase Admin SDK
- **Hosting** : Cloud Run (backend `europe-west9`) + Firebase Hosting (frontend)
- **GCP** : `rams-flare`, DB `rams-flare:africa-south1:flare-ai-db`
- **Revision active** : `flare-ai-backend-00093-qp9`
- **Version UI** : FLARE AI 3.6 (label affiché dans les settings)

## Fichiers Modifiés (Session 21 mars — Claude Code, Session 2)

| Fichier | Changement |
|---|---|
| `backend/main.py` | CORS `flareai.ramsflare.com` + migration `usage_metadata` |
| `backend/agents/supervisor.py` | `record_usage()` ajouté, `include_kb=False` pour chat, fix buffer flush `[SUGGESTION:]` |
| `backend/agents/workers/media.py` | Context variables fallback pour `user_id`/`session_id` |
| `backend/routers/admin.py` | Endpoint backfill-usage, `ACTION_NORMALIZE["workspace"]`, imports `ConversationFile`/`Message`/`Conversation` |
| `frontend/src/lib/api.ts` | Fonction `backfillAdminUsage()` |
| `frontend/src/components/AdminPanel.tsx` | Auto-backfill avant fetch |
| `frontend/src/components/ChatWindow.tsx` | Strip `[SUGGESTION:]` dans rendu ReactMarkdown |
| `frontend/src/components/LandingPage.tsx` | Volume hymne `0.06` |

## Fichiers Modifiés (Session 21 mars — Antigravity)

| Fichier | Changement |
|---|---|
| `backend/main.py` | Import + inclusion `admin_router` |
| `backend/routers/admin.py` | Import `Body` de fastapi |
| `backend/agents/supervisor.py` | Buffer streaming pour filtrer `[SUGGESTION:]` en temps réel |
| `backend/requirements.txt` | Ajout `slowapi`, fix encodage UTF-8 |
| `frontend/src/lib/api.ts` | Chemins API admin corrigés (`/usage/summary`, `/usage/ledger`) |
| `frontend/src/components/AdminPanel.tsx` | "FLASH 2.5" → "GEMINI 3 FLASH" |
| `frontend/src/components/SettingsModal.tsx` | "FLARE AI 2.5" → "FLARE AI 3.6" partout |

---

*Document maintenu par les Agents (Claude Code + Antigravity) pour continuité entre sessions.*
