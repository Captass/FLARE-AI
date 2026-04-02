# CAPTASS V3 — Règles Communes à Tous les Agents

Ces règles s'appliquent à **TOUS** les agents sans exception.

---

## ⚡ RÈGLES NON-NÉGOCIABLES

1. **LANGUE** : Toujours répondre en **français**
2. **AUTONOMIE** : ZÉRO question à l'humain — résoudre soi-même ou escalader à Alpha
3. **CONCISION** : Maximum 3 phrases par rapport/dispatch
4. **TICKETS** : Tout travail passe par un ticket Kanban — rien d'informel
5. **DEV_SYNC.md** : Lire AVANT toute action. Écrire APRÈS toute action majeure
6. **LOCKS** : Acquérir `flare_lock.js` avant de modifier un fichier, libérer après

---

## 🛠️ OUTILS NATIFS (disponibles pour tous)

| Outil | Commande |
|-------|----------|
| Lire fichier | `read_file {"path": "chemin"}` |
| Écrire fichier | `write_file {"path": "chemin", "content": "..."}` |
| Modifier fichier | `replace_in_file {"path": "...", "old": "...", "new": "..."}` |
| Exécuter commande | `run_command {"command": "..."}` |
| Lister dossier | `list_files {"path": "..."}` |
| État équipe | `check_team_status {}` |
| Message agent | `send_to_agent {"target": "BETA", "message": "..."}` |
| Mise à jour sync | `update_dev_sync {"entry": "..."}` |

---

## 📡 OUTILS SYSTÈME (via run_command)

| Outil | Commande |
|-------|----------|
| Dispatch agent | `node flare_dispatch.js <AGENT> "<msg>"` |
| Ticket Kanban | `node flare_ticket.js create/assign/status/list` |
| Lock fichier | `node flare_lock.js acquire/release <fichier> <AGENT>` |
| Review code | `node flare_review.js request/approve/reject` |
| Notification humain | `node flare_notify.js "<message>"` |
| Carte codebase | `node flare_map.js` |
| Recherche web | `node flare_search.js "<query>"` |
| Base connaissance | `node flare_kb.js search/add "<query>"` |

---

## 🔄 PROTOCOLE D'ESCALADE

```
1. Problème simple → résoudre soi-même
2. Besoin d'un autre agent → dispatch direct
3. Bloqué techniquement → dispatch ALPHA avec détail
4. Alpha bloqué +1h → node flare_notify.js "Besoin humain : <détail>"
```

---

## 📁 CHEMINS IMPORTANTS

```
Workspace V2    : D:\Travail\RAM'S FLARE\...\V2\
Code FLARE AI   : V2\claude\
Frontend        : V2\claude\frontend\
Backend         : V2\claude\backend\
DEV_SYNC        : V2\docs\handover\DEV_SYNC.md
SPEC            : V2\docs\specs\SPEC.md
Dashboard       : http://localhost:3000
Backend prod    : https://flare-backend-ynhuvwocwq-ew.a.run.app
Frontend prod   : https://flareai.ramsflare.com
```
