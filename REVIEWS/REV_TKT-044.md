# Demande de Revue : TKT-044 (Word Advanced Features)

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/document_worker.py`
- **Commande de Test**: N/A (Test d'intégration via chat, demander un document avec une table des matières)
- **Description**: Implémentation de la génération de table des matières automatique pour la Phase 3 de l'Usine Laboratoire.

**Innovation Apportée**:
1.  **Table des Matières (ToC)**: L'outil `generate_word_document` supporte maintenant un nouvel élément `{"type": "toc"}`. Il injecte le code de champ XML nécessaire pour que Microsoft Word génère la ToC.
2.  **Mise à Jour du Prompt Système**: Le prompt a été mis à jour pour guider le LLM dans l'utilisation de cette nouvelle fonctionnalité.
3.  **Synchronisation des Thèmes**: Le code des thèmes graphiques (TKT-043) qui avait été perdu a été restauré dans le prompt.
