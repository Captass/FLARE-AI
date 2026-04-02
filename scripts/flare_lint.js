/**
 * CAPTASS : SYSTEM LINTING PRE-FLIGHT (flare_lint.js)
 * Force l'analyse syntaxique native de Node.js avant toute Code Review.
 * 
 * Usage:
 *   node flare_lint.js src/app.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetPath = process.argv[2];

if (!targetPath) {
    console.error("❌ Usage: node flare_lint.js <fichier.js>");
    process.exit(1);
}

if (!fs.existsSync(targetPath)) {
    console.error(`❌ Fichier introuvable : ${targetPath}`);
    process.exit(1);
}

// Fonction pour linter un fichier JS avec `node --check`
function lintFile(filePath) {
    if (!filePath.endsWith('.js')) {
        return true; // Ignore les non-js
    }

    try {
        execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
        return true;
    } catch (err) {
        console.error(`\n========================================`);
        console.error(`❌ ERREUR DE SYNTAXE FATALE DANS : ${filePath}`);
        console.error(`========================================`);
        console.error(err.stderr ? err.stderr.toString() : err.message);
        console.error(`➡️ CORRIGE TA SYNTAXE AVANT DE DEMANDER UNE REVIEW.`);
        return false;
    }
}

console.log(`⏳ Pre-flight Linter en cours sur [${targetPath}]...`);

const stats = fs.statSync(targetPath);
let success = true;

if (stats.isDirectory()) {
    // Vérification basique récursive non implémentée pour l'instant (focus fichier unique pr review)
    console.log("ℹ️ Linting de dossier complet non supporté nativement ici, spécifiez un fichier .js");
} else {
    success = lintFile(targetPath);
}

if (success) {
    console.log(`✅ LINT PASSÉ : Aucune erreur de syntaxe Node.js bloquante détectée.`);
    process.exit(0);
} else {
    process.exit(1);
}
