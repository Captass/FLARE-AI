# Workspace Structure

Derniere mise a jour : 28 mars 2026

## Dossiers actifs

- `backend/` : API FastAPI, logique metier, auth, settings, chatbot bridge
- `frontend/` : application Next.js et landing publique
- `chatbot Facebook/` : service Messenger direct et ses scripts
- `agents/` : agents et orchestration hors UI
- `scripts/` : scripts utilitaires actifs du workspace
- `docs/` : documentation produit, technique et handover
- `infra/` : fichiers d'infrastructure et de support au deploiement
- `KNOWLEDGE/` : base de contenus et ressources de connaissance
- `Logos/` : logos source et ressources de marque
- `REVIEWS/` : sorties de revue et notes de controle

## Dossiers de support

- `tmp/` : artefacts temporaires, captures QA, scripts jetables, logs runtime
- `backups/` : sauvegardes et snapshots locaux
- `_archive/` : anciens fichiers et scripts conserves hors du flux actif

## Convention appliquee

Le rangement a ete nettoye pour separer :

- le code actif
- les donnees temporaires
- les captures de QA
- les snapshots de base locale

## Sous-structure utile

### scripts

- `scripts/BOARD.json` : board utilise par `scripts/flare_ticket.js`

### tmp

- `tmp/screenshots/ui-qa/2026-03-28/` : captures d'interface issues des controles visuels
- `tmp/runtime/` : pid et logs de session locale
- `tmp/diagnostics/messenger/` : exports de logs Messenger temporaires
- `tmp/scripts/` : scripts ponctuels ou de debug qui ne font pas partie du flux actif

### backups

- `backups/local_snapshots/root_db/` : anciennes bases SQLite presentes a la racine et rangees comme snapshots locaux

## Regle simple

Si un fichier sert au code en production ou en dev, il reste dans son dossier actif.
Si un fichier est temporaire, de debug, de capture ou de snapshot local, il doit aller dans `tmp/`, `backups/` ou `_archive/`.
