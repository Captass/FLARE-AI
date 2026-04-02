# Demande de Revue : TKT-035 (Media Inpainting)

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/media.py`
- **Commande de Test**: N/A (Test d'intégration via chat, demander l'édition d'une image avec un masque)
- **Description**: Implémentation de la dernière phase de l'Opération Usine Laboratoire. Le `media_worker` a été amélioré pour supporter l'inpainting d'images.

**Innovation Apportée**:
1.  **Outil d'Inpainting `edit_image_zone`**: Le placeholder a été remplacé par une implémentation complète qui appelle le modèle `imagen-3.0-capability-001`.
2.  **API Google GenAI**: L'outil utilise la méthode `client.models.edit_image` avec un masque et un prompt pour modifier des zones spécifiques d'une image.
3.  **Mise à Jour du Prompt Système**: Le prompt a été mis à jour pour guider le LLM dans l'utilisation de ce nouvel outil puissant.
