# FLARE AI — Historique des Versions

> Chaque version est un snapshot complet et fonctionnel de l'application.
> Restaurer une version : `backup.bat restore v2.x.x` (Windows) ou `./backup.sh restore v2.x.x` (Mac/Linux)

---

## v4.0.3 — 5 avril 2026 — "Correctifs UX tunnel activation — methodes de paiement, erreurs API, enterprise"

### Resume
Correctifs de la session de tests live : methodes de paiement manquantes, erreurs JSON brutes, mailto enterprise, banniere clignotante, et grille des offres dans Abonnements.

### Changements
- **Methodes de paiement par defaut** : backend retourne MVola + Orange Money (034 02 107 31) quand `MANUAL_PAYMENT_METHODS_JSON` n'est pas configure, au lieu de `[]`
- **Erreurs API lisibles** : ajout de `parseApiError()` dans `ChatbotActivationPage` qui extrait le champ `detail` du JSON FastAPI -- plus de `{"detail":"..."}` brut affiche
- **Reprise automatique** : si une AR existe deja et que le backend renvoie "deja en cours", le tunnel charge l'AR existant et saute a la bonne etape au lieu d'afficher une erreur
- **Enterprise mailto** : `window.open("mailto:...", "_blank")` remplace par `window.location.href` -- plus de page noire
- **Banniere clignotante** : ajout de `activationLoading` dans `ChatbotHomePage` pour ne pas afficher la banniere avant le fetch initial
- **Grille des offres dans Abonnements** : `BillingPage` affiche maintenant les 4 plans avec CTA vers le tunnel d'activation

### Commits
- `fix: stop activation banner flicker, add plans grid to billing page`
- `fix: parse API JSON errors, auto-resume existing AR, fix enterprise mailto`
- `fix: add default payment methods (MVola, Orange Money) when env var not set`
- `fix: update payment numbers to 034 02 107 31, remove card placeholder`

---

## v4.0.1 — 5 avril 2026 — "Correctifs lancement v1 — activation flow, admin sidebar, prix"

### Resume
Correctifs post-lancement identifies lors des tests live sur flareai.ramsflare.com.

### Changements
- **Activation flow** : le wizard d'installation Facebook self-serve ne bloque plus le parcours. `showSetupWizard` est maintenant conditionne par `isActivationActive` — il ne s'affiche qu'apres activation complete et uniquement si la configuration technique est incomplete.
- **Admin sidebar** : ajout du bouton "Administration" dans la barre laterale gauche, visible uniquement pour `cptskevin@gmail.com`. Composant `NewSidebar` accepte maintenant la prop `userEmail`.
- **Prix corriges** : Starter 30 000 Ar, Pro 60 000 Ar, Business 120 000 Ar, Entreprise sur devis (mailto). Les valeurs incorrectes (50k/120k/250k) ont ete remplacees.
- **Etape 4 de l'activation** : reecrite pour indiquer qu'un technicien FLARE sera notifie et se chargera de connecter le chatbot. L'utilisateur confirme ses informations et notifie l'equipe, sans avoir a ajouter FLARE comme admin lui-meme.
- **`page.tsx`** : passe `userEmail={user?.email ?? null}` au composant `NewSidebar`.

### Commits
- `fix: activation flow -- bypass setup wizard, add admin sidebar, fix prices` (e890129)

---

## v4.0.0 — 4 avril 2026 — "Lancement v1 — activation assistee, paiement manuel, commandes"

### Resume
Version de lancement stable avec activation Facebook assistee par FLARE, paiement manuel local, commandes issues du chatbot et dashboard operateur.

### Changements majeurs
- **Plan par defaut** : correction critique — tout nouvel espace demarre en `free`, plus en `business`
- **Paiement manuel** : methodes configurables (MVola, etc.), preuve de paiement, validation admin
- **Activation assistee** : formulaire client complet, workflow operateur, Facebook connecte par FLARE
- **Commandes** : detection automatique et manuelle depuis Messenger, dashboard client et admin
- **Dashboard** : widgets activation, paiement, commandes, mode bot/humain clarifie
- **Wording** : suppression des promesses self-serve Meta, remplacement par activation assistee
- **Admin** : hub Operations avec vues Activations, Paiements, Commandes
- **Audit** : evenements journalises pour chaque action operateur

### Specification
- [docs/specs/launch/v1_2026-04-04_assisted_activation/](../specs/launch/v1_2026-04-04_assisted_activation/README.md)

---

## v3.10.0 — 25 mars 2026 — "Audit prod chat & stabilisation"

### Résumé
Audit réel de l'agent chat en production, avec reprise de la documentation, fiabilisation mémoire et validation complète des flux principaux backend.

### Changements majeurs
- **Audit prod automatisé** : ajout d'un script de validation bout en bout du chat, auth, mémoire, knowledge, image, Word, Excel, vidéo et fichiers.
- **Mémoire** : normalisation de `user_age` et extraction immédiate des faits durables.
- **Chat** : stabilisation du flux prod backend et validation réelle sur Cloud Run.
- **Vidéo** : génération VEO live confirmée sans fallback trompeur.
- **Fichiers** : validation de la remontée image / Word / Excel / vidéo dans `FilesPanel`.
- **Documentation** : `README`, `START`, `DEVELOPER_GUIDE`, `TASKS` mis à jour avec l'état réel du projet.

### État fonctionnel à cette version
- Validé : auth, chat, mémoire, knowledge, image, Word, Excel, vidéo, fichiers, historique
- Reste ouvert : `animate_image`

### Déployé sur
- Backend : Cloud Run `flare-backend-00031-pfk`
- Frontend de validation : `rams-flare-ai.web.app`

---

## v2.8.5 — 18 mars 2026 — "Nano Banana 2 (Gemini 3.1)"

### Résumé
Mise à niveau majeure du moteur de génération d'images vers **Nano Banana 2** (Gemini 3.1 Flash Image Preview) pour des performances et une qualité accrues via API Key.

### Changements majeures
- **Nouveau Moteur Image** : Passage à `gemini-3.1-flash-image-preview` (Nano Banana 2).
- **Architecture** : Suppression de la dépendance à Vertex AI pour les images, tout passe désormais par la clé API Gemini.
- **Paramètres** : Support des aspect ratios dynamiques (1:1, 16:9) et choix de résolution (**2K / 4K**) via un nouveau sélecteur UI.
- **UI** : Intégration d'un badge cyclique HD/2K/4K dans la barre de chat multimédia.

---

## v2.8.4 — 18 mars 2026 — "Génération Multimédia & Deep Research"

### Résumé
Introduction de raccourcis directs pour la génération d'images et de vidéos dans la barre de saisie, et rétablissement du label "DEEP RESEARCH" pour une meilleure clarté.

### Changements majeures
- **Nouveaux Boutons** : Ajout d'icônes `Image` et `Vidéo` à côté de la recherche profonde pour déclencher des préfixes de commande intelligents (`/image`, `/video`).
- **Branding** : Retour au label **"DEEP RESEARCH"** (au lieu de "MODE EXPERT") dans le champ de saisie pour une cohérence accrue avec les fonctionnalités de recherche.
- **Déploiement** : Correction du ciblage projet Firebase vers `rams-flare` pour assurer la mise à jour effective du domaine `flareai.ramsflare.com`.
- **Maintenance** : Incrémentation technique v2.8.4 pour purge de cache et déploiement des nouvelles logiques de préfixe.

---

## v2.8.3 — 18 mars 2026 — "Éradication Barres de Scroll"

### Résumé
Nettoyage technique de l'interface pour supprimer les barres de défilement parasites sur les petits affichages.

### Changements majeures
- **CSS Global** : Intégration de la classe `.no-scrollbar` dans `globals.css` pour masquer les barres de défilement tout en préservant le scroll fonctionnel.
- **Maintenance** : Suppression des définitions locales redondantes.

---


## v2.8.1 — 18 mars 2026 — "Mode Expert & Verrouillage Déploiement"

### Résumé
Rétablissement de l'appellation "Mode Expert" pour les fonctions de recherche profonde et mise en place d'une politique de déploiement stricte sur `flareai.ramsflare.com`.

### Changements majeures
- **Branding** : "DEEP RESEARCH" renommé en **"MODE EXPERT"** pour une meilleure distinction des fonctions avancées.
- **Documentation** : Mise à jour de `DEVELOPER_GUIDE.md` avec interdiction de déployer ailleurs que sur le projet production `rams-flare`.
- **UI** : Nouveaux labels et icônes pour le Mode Expert dans la Sidebar et le Header.

---

## v2.8 — 18 mars 2026 — "Refonte Esthétique Ultra-Premium"

### Résumé
Refonte esthétique globale pour les modes Clair et Sombre. Augmentation radicale du contraste, de la profondeur visuelle et de l'impact UX. Correction du bug de lisibilité au survol des cartes d'accueil.

### Changements majeurs
- **Contraste Magnifié** : Utilisation de nuances Zinc-950/Slate-950 pour une lisibilité parfaite dans tous les thèmes.
- **UX Premium** : Nouvelle barre de saisie (`MessageInput`) avec lueurs de focus, animations de boutons vibrantes et tooltips 3D.
- **Expert Mode / Deep Research** : Nouveau toggle stylisé dans la barre latérale pour activer la recherche profonde.
- **Correction Critique** : Fix du texte blanc sur blanc lors du survol des cartes d'accueil en mode clair.
- **Micro-Animations** : Transitions `cubic-bezier` de haute précision sur toute l'interface.

### Fichiers clés modifiés
- `frontend/src/app/globals.css` : Système de design et variables.
- `frontend/src/components/ChatWindow.tsx` : UI des messages et cartes.
- `frontend/src/components/MessageInput.tsx` : Barre de saisie augmentée.
- `frontend/src/components/Sidebar.tsx` : Navigation et toggle de mode.

---

## v2.7 — 18 mars 2026 — "Deep Research V2 & Citations"

### Résumé
Evolution majeure du moteur de recherche avec l'introduction du "Deep Research" systématique, des citations inline et d'un panneau latéral premium pour les sources sur desktop. Amélioration de la fiabilité du cache utilisateur.

### Changements majeurs
- **Deep Research V2** : Multi-passes de recherche, désambiguïsation itérative, rapport final structuré.
- **Citations Inline** : Rendu des citations `[1], [2]` cliquables et stylisées dans le Markdown.
- **UX Premium** : Panneau latéral "Side Panel" pour les sources sur desktop (layout split-view).
- **Performance** : Script de purge automatique du Service Worker/Cache (v2.7.1).
- **Labels** : Standardisation du nom "Deep Research" sur toute l'interface.

### Fichiers clés modifiés
- `backend/agents/workers/researcher.py` — `execute_deep_research` prompt & logic.
- `backend/agents/supervisor.py` — Preservation des citations.
- `frontend/src/components/ChatWindow.tsx` — Split view, Citation component.
- `frontend/src/components/MessageInput.tsx` — Label "Deep Research".
- `frontend/src/app/page.tsx` — Cache clearing script.

### Déployé sur
- Backend : Cloud Run `flare-ai-backend` (rams-flare)
- Frontend : Firebase Hosting `flareai.ramsflare.com` (**PROJET UNIQUE**)

---

## v0 — 16 mars 2026 — "Stabilisation Production"

### Résumé
Première version stable pour 100+ utilisateurs. Migration complète vers Gemini 3 Flash,
remplacement DuckDuckGo par Google Search Grounding, correction du bug critique SSE streaming,
améliorations UX basées sur le feedback utilisateur.

### Changements majeurs
- **LLM** : Gemini 3 Flash Preview (avec retry 4 niveaux → 2.5-flash → 2.5-flash-lite)
- **Recherche web** : Google Search Grounding (remplace DuckDuckGo rate-limité)
- **Deep Research** : 5 angles parallèles via ThreadPoolExecutor
- **SSE Streaming** : `_stream_with_keepalive()` remplace `asyncio.wait_for()` (corrige les réponses vides)
- **System prompt** : Court (~300 chars), nom "FLARE AI" (pas Antigravity)
- **Stabilité** : Token budget 50K, max 30 messages, troncature 3K/msg, condensation après 10 msgs
- **Images** : Imagen 3.0 via Vertex AI, stockage Firebase Storage
- **Vidéos** : VEO 3.0 via Vertex AI, avec fallback VEO 2.0
- **UX** : Bouton STOP, Deep Research tooltip, scroll buttons, back button sur panels
- **UX** : Onboarding nouvel utilisateur, bannière PWA install, recherche conversations
- **UX** : Mode édition message amélioré, guide Knowledge panel

### Fichiers clés modifiés
- `backend/core/orchestrator.py` — Cerveau IA rewritten
- `backend/routers/chat.py` — `_stream_with_keepalive()`
- `backend/core/memory.py` — Limites réduites
- `backend/core/config.py` — `gemini-3-flash-preview`
- `frontend/src/app/page.tsx` — Back button, onboarding, PWA banner
- `frontend/src/components/ChatWindow.tsx` — Scroll buttons, edit amélioré
- `frontend/src/components/MessageInput.tsx` — Stop button, Deep Research tooltip
- `frontend/src/components/Sidebar.tsx` — Search bar
- `frontend/src/components/KnowledgePanel.tsx` — Guide utilisateur

### Déployé sur
- Backend : Cloud Run `flare-ai-backend` (europe-west9)
- Frontend : Firebase Hosting `flareai.ramsflare.com`

---

## v2.3 — 17 mars 2026 — "Optimisation Radicale & UX Premium"

### Résumé
Cette version résout les problèmes de latence et de perception de performance signalés par les utilisateurs. Elle introduit une chronométrie en temps réel, une persistance robuste des médias générés, et un workflow d'accueil (onboarding) totalement revu pour une personnalisation accrue.

### Changements majeurs
- **Performance (Zero-Latency)** :
    - Fast Path Greeting (0ms) via regex et Gemini Flash 8B.
    - Séparation des états de chargement (Skeleton Loader discret).
    - Mode "Light" du Supervisor (skip DB/KB pour les chats simples).
    - Accélération des délais frontend (status messages à 1s).
    - Suppressions et archivages optimistes (réactivité instantanée).
- **Analytics & Visibilité** : Affichage du temps de réponse (ex: ⚡ 1.2s) sous chaque message assistant.
- **Sécurité** : Audit et nettoyage des variables `.env` (masquage des clés API frontend).
- **Persistance** : Sauvegarde atomique de `attachment_json` dans le Supervisor (fix images/vidéos F5).
- **UX Premium** :
    - Nouvel écran de bienvenue (`WelcomeOnboarding`) capturant le profil utilisateur.
    - Guide interactif (`InteractiveTour`) pour la découverte de l'interface.
    - Refonte du thème clair (palettes Zinc/Slate, contrastes optimisés).

### Fichiers clés modifiés
- `backend/agents/supervisor.py` — Fast Path, minimal prompt, media persistence.
- `frontend/src/app/page.tsx` — Onboarding integration, tour state.
- `frontend/src/hooks/useChat.ts` — ResponseTime logic, separate loading states.
- `frontend/src/components/ChatWindow.tsx` — Display chronometry, status timing.

---


### Résumé
Refonte profonde du moteur d'IA pour passer d'un orchestrateur monolithique à un système **Supervisor-Worker**. Cette évolution permet une meilleure scalabilité, une réduction des coûts API et une spécialisation accrue des réponses. L'agent est désormais capable de déléguer intelligemment les tâches à des experts dédiés.

### Changements majeurs
- **Architecture d'Agents** : Implémentation du pattern Supervisor-Worker.
    - **Supervisor (Agent A)** : Routage intelligent par LLM, gestion de la relation utilisateur et synthèse.
    - **Researcher Worker** : Spécialisé en recherche web, Deep Research et mémoire.
    - **Media Worker** : Spécialisé en Imagen 3, Veo et exécution de Skills.
    - **Workspace Worker** : Spécialisé en Google Workspace (Gmail, Sheets, Drive, Docs).
- **Routage Intelligent** : Passage d'un routage par mots-clés à une classification contextuelle par LLM (Gemini 1.5 Flash).
- **Optimisation Tokens** : Réduction du nombre de tokens système par appel grâce à la spécialisation des prompts des workers.
- **Robustesse** : Introduction d'un module de contexte partagé (`context.py`) pour éviter les imports circulaires et assurer la thread-safety.
- **Déploiement** : Migration réussie vers les nouvelles révisions Cloud Run avec déploiement autonome.

### Fichiers clés modifiés
- `backend/agents/supervisor.py` — Nouveau cerveau de routage.
- `backend/agents/workers/` — Nouveaux modules experts.
- `backend/core/context.py` — Gestion centralisée du contexte.
- `backend/core/llm_factory.py` — Support multi-agents et modèles mixtes.

### Déployé sur
- Backend : Cloud Run `flare-ai-backend` (v0.9.5-multiagent)
- Frontend : Firebase Hosting `flareai.ramsflare.com`

---

## v1 — 16 mars 2026 — "Simplification Extrême & Rebranding"

### Résumé
Refonte majeure de l'identité visuelle et de l'expérience utilisateur. Passage du nom "FLARE AI OS" à **FLARE AI**. Implémentation de la philosophie "Less is More" pour une accessibilité accrue, et optimisations critiques pour les performances sur tablettes/mobiles.

### Changements majeurs
- **Rebranding** : Migration complète de la terminologie vers **FLARE AI** (frontend/backend).
- **UI "Less is More"** : 
    - Interface principale épurée (type Google Search) par défaut.
    - **Mode Expert** : Masquage intelligent des panneaux complexes (Dashboard, Agents, Prompts), activable via un toggle premium.
- **Onboarding** : 
    - Ajout de suggestions de prompts dynamiques (Étudiants, Pros, Quotidien) pré-remplissant l'input.
    - Guides visuels (tooltips) pour les fonctionnalités expertes comme "Deep Research".
- **Performance Mobile** :
    - Optimisation Spline sur tablettes (>25 FPS) via ajustement du `pixelRatio` et désactivation des ombres.
    - Correction des bugs de défilement (scrolling stable) dans la Sidebar et la ChatWindow.
- **UX Premium** : 
    - Skeleton Loaders sur tous les panneaux dynamiques.
    - Redesign de l'écran de connexion (bouton dégradé avec effet sheen).
    - Refonte du MemoryPanel (formattage Title Case, design épuré).
- **Navigation** : Centralisation de la gestion d'abonnement dans le profil et intégration du Knowledge Panel dans les réglages Agent IA.

### Fichiers clés modifiés
- `frontend/src/app/page.tsx` — Logique Expert Mode et simplification.
- `frontend/src/components/Sidebar.tsx` — Toggle Expert, refonte navigation.
- `frontend/src/components/ChatWindow.tsx` — Nouvelles suggestions, animations staggered.
- `frontend/src/components/SettingsModal.tsx` — Intégration Knowledge, refonte UI.
- `frontend/src/components/LoginScreen.tsx` — Nouveau design premium.
- `backend/main.py` & `routers/*.py` — Nettoyage terminologique IA.

### Déployé sur
- Backend : Cloud Run `flare-ai-backend` (europe-west9) — Service stable.
- Frontend : Firebase Hosting `flareai.ramsflare.com` — Version Lite/Expert.

---

---

## Comment utiliser ce système

### Sauvegarder (après chaque session de travail)
```bash
# Windows
backup.bat save "Description des changements"

# Mac/Linux
./backup.sh save "Description des changements"
```

### Lister les versions
```bash
backup.bat list    # ou ./backup.sh list
```

### Restaurer une version
```bash
backup.bat restore v0    # ou ./backup.sh restore v0
```

### Reprendre le développement après restauration
```bash
git checkout main             # Revenir à la branche principale
git checkout -b fix/mon-fix   # Ou créer une branche depuis cette version
```

### Pour une IA de vibecoding (Claude, Jules, Cursor, etc.)
1. Lire `DEVELOPER_GUIDE.md` pour comprendre l'architecture
2. Lire `VERSIONS.md` pour l'historique
3. Faire `backup.bat info` pour voir la version actuelle
4. Travailler sur les modifications
5. Faire `backup.bat save "Description"` quand c'est stable
