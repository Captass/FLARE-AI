# Demande de Revue : TKT-028 (CRUD Word) - v2

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/document_worker.py`
- **Commande de Test**: N/A (Test d'intégration via chat)
- **Description**: Suite au rejet de GAMMA, la fonction `read_word_document_as_json` a été corrigée.

**Correction Apportée (v2)**:
1.  **Gestion des Tableaux**: La fonction `read_word_document_as_json` itère maintenant sur `document.tables` pour extraire les en-têtes et les lignes des tableaux, les ajoutant à la structure JSON. Le bug où les tableaux étaient ignorés est corrigé.
2.  **Robustesse du Workflow**: Le workflow UPDATE (Read-Modify-Generate) est maintenant fonctionnel pour les documents contenant du texte et des tableaux.
