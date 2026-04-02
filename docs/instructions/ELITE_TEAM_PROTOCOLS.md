# CAPTASS V3 — Protocoles Elite Multi-Agents

**Version** : V3 | **Date** : Mars 2026 | **Infrastructure** : Gemini Cloud ☁️

---

## 🏗️ Architecture de l'Équipe

| Agent | Rôle | Modèle | Spécialité |
|-------|------|--------|------------|
| **ALPHA** | Orchestrateur & CTO | Gemini 2.5 Flash ☁️ | Planification, délégation, supervision. Ne code JAMAIS. |
| **BETA** | Ingénieur Backend Senior | Gemini 2.0 Flash-Lite ☁️ | FastAPI, Python, SQL, Cloud Run, API REST |
| **GAMMA** | Tech Lead & Auditeur | Gemini 2.0 Flash-Lite ☁️ | Code review, sécurité, performance, refactoring |
| **DELTA** | Ingénieur Frontend UI/UX | Gemini 2.0 Flash-Lite ☁️ | Next.js, TypeScript, Tailwind, composants React |
| **EPSILON** | QA & Tests E2E | Gemini 2.0 Flash-Lite ☁️ | Tests, validation, intégration, debug |
| **ZETA** | Product Manager | Gemini 2.0 Flash-Lite ☁️ | Veille produit, features proactives, tickets stratégiques |
| **THETA** | DevOps & Sécurité | Gemini 2.0 Flash-Lite ☁️ | Audit sécurité, CI/CD, monitoring, OWASP |

---

## 🔧 Infrastructure Technique

### Dashboard
- **URL** : `http://localhost:3000`
- **Launcher** : `C:\Users\USER\Desktop\CAPTASS V3 DEV TEAM.lnk` (ou `CAPTASS_LAUNCH.ps1`)
- **Dossier** : `D:\Travail\Kévin\Developpement\Claude code Ollama\`

### Fichiers Clés
| Fichier | Rôle |
|---------|------|
| `server.js` | Backend WebSocket du dashboard |
| `ollama-agent.js` | Moteur agent (Ollama + Gemini) |
| `start-agents.ps1` | Lanceur d'agents avec config modèles |
| `DEVS_DASHBOARD.html` | Interface visuelle |
| `LANCER_DASHBOARD.bat` | Démarrage rapide |

### Workspace Projet
- **Chemin** : `D:\Travail\RAM'S FLARE\Flare Group\Flare AI\Antigravity\FLARE AI OS\V2\`
- **Projet actif** : FLARE AI (`claude/` → frontend Next.js + backend FastAPI)

---

## 📡 Système de Communication Inter-Agents

### Outils disponibles pour chaque agent
```
node flare_dispatch.js <AGENT> "<message>"   → Envoyer un message à un agent
node flare_ticket.js create/assign/status    → Gérer le Kanban
node flare_lock.js acquire/release <fichier> → Verrouiller un fichier
node flare_review.js request/approve/reject  → Cycle de review
node flare_notify.js "<message>"             → Notification Windows à l'humain
node flare_map.js                            → Cartographier le codebase
node flare_search.js "<query>"               → Recherche web
node flare_kb.js search/add                  → Base de connaissance
```

### Inbox Polling
Chaque agent vérifie son inbox **toutes les 5 secondes** automatiquement.
Les messages sont stockés dans `agent_inbox/<AGENT>.md`.

---

## 🔄 Cycle de Développement Standard

```
Humain → Alpha (directive)
  Alpha → crée tickets Kanban
  Alpha → dispatch BETA + DELTA (code)
  BETA/DELTA → codent → dispatch GAMMA (review)
  GAMMA → approve → dispatch EPSILON (tests)
  EPSILON → valide → dispatch ALPHA (clôture)
  Alpha → ticket DONE → notifie humain si demandé
```

### Flux d'escalade
```
Agent bloqué → dispatch ALPHA
Alpha bloqué → dispatch GAMMA (conseil technique)
Alpha bloqué total +1h → flare_notify.js (alerte humain Windows)
```

---

## 🌙 Protocole Mode Nuit / Autonome

**Déclenchement** : dire à Alpha "mode nuit" ou "travaille cette nuit"

1. Alpha scanne le codebase (`flare_map.js`)
2. Alpha dispatch GAMMA pour audit qualité
3. Alpha dispatch THETA pour audit sécurité
4. Alpha dispatch ZETA pour veille features
5. Alpha dispatch EPSILON pour tests de régression
6. Les résultats génèrent des tickets → Alpha les traite en boucle
7. L'équipe tourne jusqu'au matin sans interruption
8. Rapport complet dans `DEV_SYNC.md` au réveil

**Commandes de contrôle** :
- `pause` dans le chat Alpha → met l'équipe en pause
- `reprendre` → relance l'équipe
- Bouton `⏸ PAUSE ÉQUIPE` dans le dashboard → stop immédiat

---

## 💰 Budget Cloud

| Modèle | Usage | Coût estimé/mois |
|--------|-------|-----------------|
| Gemini 2.5 Flash (Alpha) | Orchestration | ~$30-45 |
| Gemini 2.0 Flash-Lite × 6 | Exécution | ~$20-30 |
| **Total** | | **~$50-75/mois usage normal** |

**Protection** : Budget alert GCP à $100 → `console.cloud.google.com/billing`

---

## ⚡ Règles NON-NÉGOCIABLES

1. **ZÉRO QUESTION à l'humain** sauf blocage total +1h
2. **Alpha ne code JAMAIS** — il délègue uniquement
3. **DEV_SYNC.md** : lu AVANT, écrit APRÈS chaque action
4. **Tickets obligatoires** : tout travail passe par un ticket Kanban
5. **Lock files** : acquérir avant de modifier, libérer après
6. **Concision** : max 3 phrases par dispatch/rapport
7. **L'équipe ne s'arrête jamais** : si pas de tickets, créer des améliorations
