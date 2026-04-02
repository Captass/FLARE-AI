/**
 * CAPTASS : SYSTEM CODE REVIEW (flare_review.js)
 * Gère le flux de Code Review par l'agent GAMMA (Tech Lead).
 * 
 * Usage:
 *   node flare_review.js request TKT-001 BETA "src/file1.js src/file2.js"
 *   node flare_review.js approve TKT-001
 *   node flare_review.js reject TKT-001 "Le code est non sécurisé..."
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REVIEWS_DIR = path.join(__dirname, 'REVIEWS');

// S'assurer que le dossier existe
if (!fs.existsSync(REVIEWS_DIR)) {
    fs.mkdirSync(REVIEWS_DIR, { recursive: true });
}

const [,, action, ticketId, agentOrFeedback, filesList, ...testCmdParts] = process.argv;
const testCommand = testCmdParts.join(' ');

function requestReview() {
    if (!ticketId || !agentOrFeedback || !filesList || !testCommand) {
        console.error("❌ Usage: node flare_review.js request <TKT-ID> <AGENT> \"<fichiers>\" \"<commande_de_test>\"");
        console.error("   Exemple: node flare_review.js request TKT-001 BETA \"src/app.js\" \"node test.js\"");
        return;
    }
    const filesArray = filesList.split(' ').filter(f => f.trim().length > 0);

    console.log(`🧹 Phase 1 : Validation Syntaxique (Pre-flight LINT)...`);
    for (const file of filesArray) {
        if (file.endsWith('.js') && fs.existsSync(file)) {
            try {
                const lintScript = path.join(__dirname, 'flare_lint.js');
                execSync(`node "${lintScript}" "${file}"`, { stdio: 'inherit' });
            } catch (err) {
                console.error(`\n❌ REVIEW REJETÉE ! Le fichier ${file} contient des erreurs de syntaxe fatales.`);
                console.error(`➡️ Utilisez "node flare_lint.js ${file}" pour voir l'erreur, corrigez-la, puis recommencez.`);
                return;
            }
        }
    }

    console.log(`⏳ Phase 2 : Exécution de la Preuve de Travail (Test) : [${testCommand}]...`);
    let testOutput = "";
    try {
        testOutput = execSync(testCommand, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(`✅ Preuve de Travail (Test) réussie.`);
    } catch (err) {
        console.error(`\n❌ ÉCHEC DE LA PREUVE DE TRAVAIL. Review automatique rejetée.`);
        console.error(`Détails de l'erreur pour la commande '${testCommand}' :`);
        console.error("STDOUT:", err.stdout);
        console.error("STDERR:", err.stderr || err.message);
        console.error(`\n➡️ CORRIGE TON CODE POUR FAIRE PASSER LE TEST AVANT DE SOUMETTRE LA REVIEW.`);
        return;
    }
    
    let diffOutput = "";
    
    try {
        // Obtenir le diff via GIT pour les fichiers demandés (même untracked si on fait un diff spécial, mais git diff marche sur les modifiés)
        // Pour les nouveaux fichiers non suivis, on les liste.
        filesArray.forEach(file => {
            if (fs.existsSync(file)) {
                // Essayer git diff d'abord
                try {
                    const diff = execSync(`git diff HEAD -- "${file}"`).toString();
                    if (diff.trim() !== '') {
                        diffOutput += `\n### DIFF POUR ${file}\n\`\`\`diff\n${diff}\n\`\`\`\n`;
                    } else {
                        // Pas de diff git (nouveau fichier ?), on met le contenu
                        const content = fs.readFileSync(file, 'utf-8');
                        diffOutput += `\n### NOUVEAU FICHIER : ${file}\n\`\`\`\n${content}\n\`\`\`\n`;
                    }
                } catch (e) {
                     const content = fs.readFileSync(file, 'utf-8');
                     diffOutput += `\n### FICHIER COMPLET : ${file}\n\`\`\`\n${content}\n\`\`\`\n`;
                }
            } else {
                diffOutput += `\n### FICHIER SUPPRIMÉ : ${file}\n`;
            }
        });

        const reviewPath = path.join(REVIEWS_DIR, `REV_${ticketId}.md`);
        const reviewContent = `# CODE REVIEW REQUEST: ${ticketId}
**Auteur**: ${agentOrFeedback}
**Date**: ${new Date().toISOString()}

## Preuve de Travail (Test Automatisé)
Commande exécutée : \`${testCommand}\`
Résultat : **SUCCÈS**
\`\`\`text
${testOutput.substring(0, 1500)} // (Tronqué si trop long)
\`\`\`

## Changements
${diffOutput}

**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: \`node flare_review.js approve ${ticketId}\`
3. S'il y a des erreurs, tape: \`node flare_review.js reject ${ticketId} "Tes explications..."\`
`;
        fs.writeFileSync(reviewPath, reviewContent, 'utf-8');
        
        console.log(`✅ SUCCESS : Code Review préparée dans REVIEWS/REV_${ticketId}.md`);
        console.log(`📢 Envoie ce dispatch à GAMMA : node flare_dispatch.js GAMMA "[REVIEW] Code prêt pour ${ticketId}. Lis REVIEWS/REV_${ticketId}.md"`);
        
    } catch (err) {
        console.error("❌ ERREUR lors de la préparation de la Review :", err.message);
    }
}

function approveReview() {
    if (!ticketId) return console.error("❌ Usage: node flare_review.js approve <TKT-ID>");
    console.log(`✅ SUCCESS : Le code du ticket ${ticketId} a été APPROUVÉ par la Tech Lead.`);
    console.log(`📢 Envoie le dispatch : node flare_dispatch.js ALPHA "[APPROVED] Le ticket ${ticketId} est validé, tu peux le passer en DONE."`);
}

function rejectReview() {
    if (!ticketId || !agentOrFeedback) return console.error("❌ Usage: node flare_review.js reject <TKT-ID> \"<raisons>\"");
    
    // agentOrFeedback contient la raison ici
    const reason = process.argv.slice(4).join(' ');
    
    console.log(`❌ REVIEW REJETÉE pour le ticket ${ticketId}.`);
    console.log(`📢 Envoie le dispatch à l'auteur : node flare_dispatch.js BETA "[REJECTED] Ticket ${ticketId} refusé. Raison : ${reason}"`);
}

switch(action) {
    case 'request': requestReview(); break;
    case 'approve': approveReview(); break;
    case 'reject': rejectReview(); break;
    default:
        console.log("Usage: node flare_review.js [request|approve|reject] [args...]");
}
