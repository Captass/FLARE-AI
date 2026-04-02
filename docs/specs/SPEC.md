# 📋 CAPTASS V3 : SPEC.md (Reorganisation_Projet)

## 📌 1. Objectif Global
- Nettoyer et réorganiser l'intégralité du répertoire "V2" qui est actuellement chaotique.
- Renommer le dossier "V2" (à la fin de la réorganisation pour ne pas casser l'environnement en cours).
- S'assurer que les imports et les configurations (Next.js, FastAPI, bases de données) ne cassent pas.

## 🏗️ 2. Architecture Cible
- **`FLARE_AI_OS_CORE/`** (Ancien "V2")
  - `docs/` : Contient toute la documentation, y compris KNOWLEDGE, REVIEWS, etc.
  - `backend/` : Déplace tout le contenu Python lié au backend (actuellement dans backend ou à la racine).
  - `frontend/` : Déplace le projet Next.js (actuellement dans frontend).
  - `scripts/` : Déplace tous les scripts utilitaires isolés (.js, .py, .ps1 à la racine).
  - `infra/` : Fichiers liés au déploiement, credentials, secrets, configurations CI/CD.

## 🔄 3. Plan d'Action (Agents)
1. **BETA (Backend)** : Réorganiser le code Python, mettre à jour les chemins dans `backend/`, corriger les imports et les dépendances.
2. **DELTA (Frontend)** : Déplacer le frontend Next.js, ajuster le `tsconfig.json` et les chemins globaux.
3. **THETA (DevOps/Sécurité)** : Créer et exécuter le script de renommage final du dossier physique "V2" en "FLARE_AI_OS_CORE".

## 🛡️ 4. Contraintes
- **ZERO CASSE** : Les imports relatifs doivent être corrigés automatiquement (via des scripts ou manuellement vérifiés).
- Tester (Lint + Build) avant d'appliquer le renommage final.
