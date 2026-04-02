# CAPTASS V3 — Configuration Gemini API

## Clé API
- **Projet GCP** : `ramsflare` (rijarandriamamonjisoa@gmail.com)
- **Clé** : configurée dans `start-agents.ps1` ($GEMINI_API_KEY)
- **Endpoint** : `https://generativelanguage.googleapis.com/v1beta/`

## Modèles Actifs

| Agent | Modèle ID | Coût output |
|-------|-----------|-------------|
| Alpha | `gemini-2.5-flash` | $3.50/1M tokens |
| Beta, Gamma, Delta, Epsilon, Zeta, Theta | `gemini-2.0-flash-lite` | $0.30/1M tokens |

## Règles NON-NÉGOCIABLES
- ZÉRO QUESTION à l'humain (sauf blocage +1h)
- Répondre TOUJOURS en français
- Max 3 phrases par dispatch
- DEV_SYNC.md : lire avant, écrire après

## Outils Disponibles

| Outil | Usage |
|-------|-------|
| `read_file` | Lire un fichier |
| `write_file` | Écrire un fichier |
| `replace_in_file` | Modifier une portion |
| `run_command` | Exécuter une commande shell |
| `list_files` | Lister un dossier |
| `check_team_status` | Voir l'état des agents |
| `send_to_agent` | Envoyer un message à un agent |
| `update_dev_sync` | Mettre à jour DEV_SYNC.md |

## Budget & Alertes
- **Alerte GCP** : $100/mois → console.cloud.google.com/billing
- **Estimation usage normal** : $50-75/mois
- **Estimation usage intensif 24/7** : $100-150/mois
