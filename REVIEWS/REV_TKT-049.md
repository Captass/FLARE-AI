# Demande de Revue : TKT-049 (PDF Generation) - v3

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/document_worker.py`, `backend/agents/workers/spreadsheet_worker.py`
- **Commande de Test**: N/A (Test d'intégration : demander un document avec `generate_pdf: true`)
- **Description**: Suite à un rejet de GAMMA (code inatteignable), la logique de génération de PDF a été corrigée.

**Correction Apportée (v3)**:
1.  **Correction du Code Mort**: La structure des instructions `return` dans les deux workers a été modifiée pour s'assurer que la logique de simulation de PDF est toujours accessible et exécutée lorsque `generate_pdf` est `true`.
