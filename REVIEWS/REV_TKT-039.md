# Demande de Revue : TKT-039 (Video CRUD)

- **Agent Demandeur**: BETA
- **Fichier(s) Modifié(s)**: `backend/agents/workers/media.py`
- **Commande de Test**: N/A (Test d'intégration via chat, demander la génération d'une vidéo à partir d'une image)
- **Description**: Implémentation de la fonctionnalité d'édition/génération de vidéo pour la Phase 2 de l'Usine Laboratoire.

**Innovation Apportée**:
1.  **Outil d'Édition Vidéo `edit_video_clip`**: Le placeholder a été remplacé par une implémentation complète qui appelle le modèle `veo-2.0-generate-001` via la méthode `generate_videos`.
2.  **API VEO (asynchrone)**: L'outil gère le workflow asynchrone de l'API Veo, en attendant la fin de l'opération avant de retourner le résultat.
3.  **Image-to-Video**: La fonction supporte la génération de vidéo à partir d'une image source, en plus du text-to-video standard.
4.  **Mise à Jour du Prompt Système**: Le prompt a été mis à jour pour guider le LLM dans l'utilisation de cette nouvelle fonctionnalité.
