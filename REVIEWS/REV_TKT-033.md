# Demande de Revue : TKT-033 (Word Extreme)

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/document_worker.py`
- **Commande de Test**: N/A (Test d'intégration via chat, demander la création d'un graphique dans un document Word)
- **Description**: Implémentation de la deuxième phase de l'Opération Usine Laboratoire. Le `document_worker` a été amélioré pour supporter la génération de graphiques via `matplotlib`.

**Innovation Apportée**:
1.  **Génération de Graphiques via Matplotlib**: Un nouvel outil `generate_chart_image` a été ajouté. Il prend des données structurées (type de graphique, données, labels) et génère une image de graphique en base64.
2.  **Insertion d'Images**: L'outil `generate_word_document` peut maintenant insérer des images (y compris les graphiques) à partir d'une chaîne base64 via un nouvel élément de type `image`.
3.  **Workflow en 2 Étapes**: Le prompt système a été mis à jour pour guider le LLM à utiliser ce nouveau workflow sécurisé : d'abord générer l'image du graphique, puis l'insérer dans le document.
