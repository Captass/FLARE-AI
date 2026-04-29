# Script pour lancer FLARE AI Backend en Local
# Usage: ./scripts/start-backend.ps1

Write-Host "🚀 Démarrage du Backend FLARE AI (Local)..." -ForegroundColor Cyan

# On se place dans le dossier backend
# Note: Pas de 'cd', on utilise le chemin relatif ou absolu pour les commandes

# Installation des dépendances si nécessaire
# pip install -r backend/requirements.txt

# Lancement de l'application avec les variables locales
$env:ENV_FILE = "backend/.env.local"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
