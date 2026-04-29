# Script pour lancer FLARE AI Frontend en Local
# Usage: ./scripts/start-frontend.ps1

Write-Host "🌐 Démarrage du Frontend FLARE AI (Local)..." -ForegroundColor Green

# On se place dans le dossier frontend
# Note: Pas de 'cd', on utilise le chemin relatif ou absolu pour les commandes

# Lancement de Next.js en mode développement
# Le frontend détectera automatiquement le backend sur localhost:8000
npm --prefix frontend run dev
