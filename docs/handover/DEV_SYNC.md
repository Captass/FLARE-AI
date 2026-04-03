# 🔄 CAPTASS : MÉMOIRE PARTAGÉE (DEV_SYNC.md)

Ce fichier est la source unique de vérité. **LIRE avant toute action. ÉCRIRE après toute action.**

**Mise à jour infra (2026-04) :** déploiement prod et procédure Git (dont **`git --git-dir` / `--work-tree`** pour chemins Windows avec apostrophe) = source de vérité **[docs/instructions/DEVELOPER_GUIDE.md](../instructions/DEVELOPER_GUIDE.md)**. Mettre à jour ce DEV_SYNC quand l’état d’équipe change, pas pour dupliquer le guide.

---

## 🎯 1. PROJET EN COURS
**Projet** : FLARE AI — Plateforme SaaS de création de contenu IA
**Stack** : Next.js (frontend) + FastAPI (backend) + Firebase Auth + PostgreSQL (Render) — voir DEVELOPER_GUIDE
**Déploiement** : Render (frontend statique + web service backend) — domaine public `flareai.ramsflare.com` (CNAME vers Render)
**Référence Git / agents Windows** : `docs/instructions/DEVELOPER_GUIDE.md` (section Déploiement)
**Workspace local typique** : `D:\Travail\FLARE AI\Flare Group\Flare AI\FLARE AI` (apostrophe : utiliser technique Git du guide si le shell intégré échoue)

---

## 🧭 2. OBJECTIF ACTUEL
> **EN ATTENTE DE DIRECTIVE** — L'équipe est prête. Alpha attend les instructions du directeur.

---

## 👥 3. ÉTAT DE L'ÉQUIPE

| Agent | Rôle | Modèle | Statut | Tâche |
|-------|------|--------|--------|-------|
| **ALPHA** | Orchestrateur | Gemini 2.5 Pro | 🟢 PRÊT | En attente du directeur |
| **BETA** | Backend Dev | Gemini 2.0 Flash-Lite | 🟢 PRÊT | Standby |
| **GAMMA** | Tech Lead | Gemini 2.0 Flash-Lite | 🟢 PRÊT | Standby |
| **DELTA** | Frontend Dev | Gemini 2.0 Flash-Lite | 🟢 PRÊT | Standby |
| **EPSILON** | QA & Tests | Gemini 2.0 Flash-Lite | 🟢 PRÊT | Standby |
| **ZETA** | Product Manager | Gemini 2.0 Flash-Lite | 🟢 PRÊT | Standby |
| **THETA** | DevOps/Sécurité | Gemini 2.0 Flash-Lite | 🟢 PRÊT | Standby |

---

## 🔒 4. VERROUS ACTIFS
<!-- LOCKS_START -->
<!-- LOCKS_END -->

---

## 📋 5. KANBAN

### 🔴 TODO
_(vide)_

### 🟡 IN PROGRESS
_(vide)_

### ✅ DONE
- **TKT-103** : Réorganiser le projet V2 en FLARE_AI_OS_CORE (terminé)

---

## 💬 6. JOURNAL INTER-AGENTS
_Format : `[AGENT][TIMESTAMP] Message`_

_(journal vidé — nouvel environnement propre)_

---

## 📝 7. DÉCISIONS ARCHITECTURALES

- **Auth** : Firebase Authentication (Google + Email)
- **DB** : Cloud SQL PostgreSQL 15 + pgvector
- **LLM Backend** : Gemini API (provider configurable via LLM_PROVIDER env var)
- **Frontend** : Next.js static export → Firebase Hosting
- **Backend** : FastAPI + uvicorn → Cloud Run

---

## ⚠️ 8. BLOCAGES ET ESCALADES
_Format : `[AGENT][DATE] Problème — Statut`_

_(aucun blocage actuel)_

## [ALPHA] 10:39:54

## 🧭 2. OBJECTIF ACTUEL
> **TKT-104 : Vérification de l'état opérationnel de l'application FLARE AI en production.**
- **Demandeur** : Directeur Humain
- **Responsable** : EPSILON (QA)
- **Objectif** : S'assurer que le site public `flareai.ramsflare.com` et son backend associé sont fonctionnels.

---

## 📋 5. KANBAN

### 🔴 TODO
- **TKT-104** : [QA] Vérifier le statut de l'application live sur flareai.ramsflare.com


## [ALPHA] 10:46:46

## 🧭 2. OBJECTIF ACTUEL
> **EPIC TKT-105 : Activer les fonctionnalités multimodales du Chat Agent via Vertex AI.**
- **Demandeur** : Directeur Humain
- **Responsable** : ALPHA (Coordination)
- **Objectif** : Intégrer pleinement Vertex AI pour permettre l'analyse et la génération de textes, images, documents et vidéos.

---

## 📋 5. KANBAN

### 🔴 TODO
- **TKT-105** : [EPIC] Activer les fonctionnalités multimodales du Chat Agent via Vertex AI
- **TKT-106** : [ZETA] Rédiger les spécifications fonctionnelles pour les features multimodales (TKT-105)
- **TKT-107** : [THETA] Créer et sécuriser la clé d'API Vertex AI (TKT-105)
- **TKT-108** : [BETA] Développer les endpoints backend pour les features multimodales (TKT-105)
- **TKT-109** : [DELTA] Implémenter l'interface frontend pour les features multimodales (TKT-105)
- **TKT-110** : [GAMMA] Superviser et reviewer le code de l'intégration Vertex AI (TKT-105)
- **TKT-111** : [EPSILON] Mener une campagne de tests complète sur les features multimodales (TKT-105)
- **TKT-104** : [QA] Vérifier le statut de l'application live sur flareai.ramsflare.com

### 🟡 IN PROGRESS
_(vide)_


## [ALPHA] 11:20:51

## 🧭 2. OBJECTIF ACTUEL
> **EPIC TKT-105 : Activer les fonctionnalités multimodales du Chat Agent via Vertex AI.**
- **Demandeur** : Directeur Humain
- **Responsable** : ALPHA (Coordination)
- **Objectif** : Intégrer pleinement Vertex AI pour permettre l'analyse et la génération de textes, images, documents et vidéos.

---

## 📋 5. KANBAN

### 🔴 TODO
- **TKT-106** : [DevOps] Provisionner et sécuriser la clé API Vertex AI pour le projet.
- **TKT-107** : [Backend] Implémenter les endpoints FastAPI pour les fonctionnalités multimodales de Vertex AI.
- **TKT-108** : [Frontend] Développer les composants UI pour l'interaction multimodale dans le chat.
- **TKT-109** : [QA] Valider de bout en bout toutes les fonctionnalités multimodales.

### 🟡 IN PROGRESS
_(vide)_

## [ALPHA] 20:23:00

## 🧭 2. OBJECTIF ACTUEL
> **TKT-112 : Diagnostic et Debug de la non-réponse du Chatbot Facebook en Production.**
- **Demandeur** : Directeur Humain
- **Responsable** : ALPHA (Coordination / Diagnostic)
- **Objectif** : Identifier pourquoi bien que la Page Facebook soir "activée" avec succès (Webhook "subscribed_apps"), le Chatbot IA reste complètement muet aux messages clients sur Messenger.

---

## 📝 7. DÉCISIONS ARCHITECTURALES (UPDATE DIAGNOSTIC FB)
- **Diagnostic** : L'architecture SaaS est correcte (Un seul Meta App Webhook).
- L'échec furtif en production peut venir de :
  1. Conflit Webhook (pointé vers service direct `messenger-direct...` au lieu de `flare-backend...`).
  2. Crash silencieux sur le SDK Gemini si `GEMINI_API_KEY_*` n'est pas rempli côté Prod.
  3. `pages_messaging` d'application non validé par Meta en mode Production/Advanced.
- **Résolution immédiate** : Refonte de `_send_api_request` dans `backend/agents/facebook_cm/tools.py` pour implémenter un "logger.error" formel incluant l'HTTP_STATUS et l'erreur FB brute afin de permettre un diagnostic asynchrone (Render Logs).
- **Docs modifiées** : `DEVELOPER_GUIDE.md` section Troubleshooting Chatbot ajoutée.
