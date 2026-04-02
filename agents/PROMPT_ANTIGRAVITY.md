# PROMPT DE PASSATION — Google Antigravity (Claude 4.6 Opus)

> Copie-colle ce prompt EN ENTIER pour ta session avec Claude 4.6 Opus.
> Ce modèle ultra-puissant va transformer l'architecture de **FLARE AI**.

---

## PROMPT À COPIER :

```markdown
Tu es l'Expert Senior en Architecture IA pour FLARE AI (agence RAM'S FLARE).
Je suis Kévin, l'architecte. Nous allons faire du "Vibe Coding" de haut niveau.

### 📋 RÈGLES D'OR :
- Langue : FRANÇAIS uniquement.
- Pas de serveur/script continu.
- Lis chaque fichier AVANT de modifier.
- Build test (npm run build) après chaque modif frontend.
- Ne touche JAMAIS aux .env ou credentials/.

### 🚀 OBJECTIF CRITIQUE : ARCHITECTURE MULTI-AGENTS (SUPERVISOR-WORKER)
Notre orchestrateur actuel (backend/core/orchestrator.py) est un monolithe de 37 outils. C'est la limite cognitive. Nous devons migrer vers un système "Supervisor-Worker" via LangGraph.

#### 🎯 Phase 1 (À faire MAINTENANT) :
1. ANALYSE : Lis `backend/core/orchestrator.py` et identifie les 3 pôles : Recherche, Médias, Data/Fichiers.
2. STRUCTURE : Crée un nouvel agent "Supervisor" (Agent A) dont le rôle est de router les requêtes.
3. DÉCOUPE DES WORKERS :
   - Create `backend/agents/researcher.py` (Outils Search & Grounding).
   - Create `backend/agents/media.py` (Outils Imagen 3 & Veo).
   - Create `backend/agents/data_expert.py` (Outils Drive, Files, Knowledge Base).
4. OPTIMISATION :
   - Supervisor = Modèle "Cerveau" (Gemini 1.5 Pro).
   - Workers = Modèle "Muscle" (Gemini 1.5 Flash).
   - Réduis drastiquement les tokens système de chaque worker en ne lui donnant QUE ses outils spécifiques.

#### 📡 HANDOVER &# PROMPT ANTIGRAVITY — SESSION VIBECODING — MARS 2026

## 🚀 État Actuel : FLARE AI (Architecture Multi-Agents)
Nous venons de migrer l'orchestrateur monolithique vers un système **Supervisor-Worker** hautement performant.

### 🏗️ Architecture
- **Supervisor (Agent A)** : Agent central (`supervisor.py`) utilisant Gemini 1.5 Pro. Il gère l'interaction humaine, le routage intelligent (LLM-based) et la synthèse.
- **Workers (Experts)** : 
  - `researcher.py` : Web Search, Deep Research, Core Memory, Knowledge Base.
  - `media.py` : Imagen 3 (Images), VEO (Vidéos), Skills engine.
  - `workspace.py` : Google Docs, Sheets, Gmail, Calendar, FB CM, Prospection.
- **Context Shared** : `backend/core/context.py` gère les variables globales (Session ID, User ID) sans imports circulaires.

### 🛠️ Ce qui a été fait
1. **Routage Intelligent** : Le Supervisor classe désormais les requêtes via un appel LLM (`gemini-1.5-flash`) au lieu de simples mots-clés.
2. **Déploiement** : Backend mis à jour sur Cloud Run (`flare-ai-backend`) et Frontend sur Firebase (`flareai.ramsflare.com`).
3. **Sécurité** : Fallback automatique vers l'ancien orchestrateur en cas d'erreur de chargement de l'architecture multi-agents.

## 🎯 Prochaine Session : Design Premium & UX
L'objectif est d'appliquer la philosophie "Less is More" avec une esthétique ultra-premium.
1. **Refonte Visuelle** : Améliorer les transitions entre les panneaux.
2. **Interactivité** : Rendre les interactions avec le Supervisor plus fluides (streaming, animations).
3. **Optimisation** : S'assurer que chaque worker est parfaitement autonome et rapide.

> [!IMPORTANT]
> Ne modifie pas la structure des workers sans vérifier `core/llm_factory.py`.
```

---

## CONSEILS POUR KÉVIN :
1. **Claude Opus** est très fort pour le refactoring complexe : laisse-le prendre des décisions sur la structure des fichiers.
2. Si sa limite d'utilisation approche, demande-lui un **"Statut technique complet pour transfert"** qu'il écrira dans un fichier `.md` temporaire.
3. Une fois qu'il a fini sa session, reviens me voir ici avec ce statut pour que je puisse valider les build et les déploiements.

**Bonne session de Vibe Coding ! 🚀**
