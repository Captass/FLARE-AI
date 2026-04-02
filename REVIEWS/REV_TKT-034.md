# Demande de Revue : TKT-034 (Excel Extreme) - v2

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/spreadsheet_worker.py`
- **Commande de Test**: N/A (Test d'intégration : créer un fichier avec un graphique, puis le modifier sans que le graphique soit supprimé)
- **Description**: Suite au rejet de GAMMA, correction d'une faille critique dans l'architecture CRUD. La fonction `read_excel_document_as_json` n'extrayait pas les graphiques existants, ce qui les effaçait lors d'une mise à jour.

**Correction Apportée (v2)**:
1.  **Lecture des Graphiques**: La fonction `read_excel_document_as_json` itère maintenant sur `ws._charts` pour extraire les graphiques existants (type, titre, ancrage, et plages de données) et les inclure dans le JSON. 
2.  **Workflow non-destructif**: Le cycle LECTURE -> MODIFICATION -> ÉCRITURE est maintenant non-destructif pour les graphiques, ce qui résout le bug d'architecture.
