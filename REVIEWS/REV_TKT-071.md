# Demande de Revue : TKT-071 (Cleanup PDF) - v2

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/document_worker.py`, `backend/agents/workers/spreadsheet_worker.py`
- **Commande de Test**: N/A (Vérification de l'absence de la fonctionnalité)
- **Description**: Suppression complète de la fonctionnalité `generate_pdf`. Cette action a été prise suite à des instructions contradictoires et pour nettoyer le code d'une feature non-désirée.

**Nettoyage Effectué (v2)**:
1.  **Suppression des Paramètres**: Le paramètre `generate_pdf` a été retiré des signatures des fonctions.
2.  **Suppression de la Logique**: Le code de simulation de l'appel au microservice a été supprimé.
3.  **Nettoyage des Prompts**: Toute mention de la génération de PDF a été retirée des prompts système.
