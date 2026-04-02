/**
 * CAPTASS : KNOWLEDGE BASE MANAGER (flare_kb.js)
 * Gère la mémoire à long terme de l'équipe (RAG basique).
 * Usage:
 *   node flare_kb.js add <topic> <content>
 *   node flare_kb.js search <keyword>
 *   node flare_kb.js list
 */

const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, 'KNOWLEDGE');

// Ensure KB directory exists
if (!fs.existsSync(KB_DIR)) {
    fs.mkdirSync(KB_DIR, { recursive: true });
}

const [,, action, arg1, ...rest] = process.argv;
const arg2 = rest.join(' ');

function listKB() {
    const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
        console.log("📚 La Base de Connaissance est vide.");
        return;
    }
    console.log("📚 BASE DE CONNAISSANCE :");
    files.forEach(f => console.log(` - ${f}`));
}

function addKB(topic, content) {
    if (!topic || !content) {
        console.error("❌ Usage: node flare_kb.js add <topic> <content>");
        return;
    }
    // Clean topic name for filesystem
    const safeTopic = topic.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
    const filePath = path.join(KB_DIR, safeTopic);
    
    let existingContent = "";
    if (fs.existsSync(filePath)) {
        existingContent = fs.readFileSync(filePath, 'utf-8') + "\n\n";
    }
    
    const timestamp = new Date().toISOString();
    const entry = `### Entrée du ${timestamp}\n${content}\n`;
    
    fs.writeFileSync(filePath, existingContent + entry, 'utf-8');
    console.log(`✅ SUCCESS : Connaissance ajoutée à '${safeTopic}'`);
}

function searchKB(keyword) {
    if (!keyword) {
        console.error("❌ Usage: node flare_kb.js search <keyword>");
        return;
    }
    const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'));
    let found = false;
    
    console.log(`🔍 RECHERCHE DE : "${keyword}"`);
    files.forEach(f => {
        const filePath = path.join(KB_DIR, f);
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
            console.log(`\n📄 Trouvé dans [${f}] :`);
            // Extract a small snippet around the keyword
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    console.log(`   L${idx+1}: ${line.trim()}`);
                    found = true;
                }
            });
        }
    });
    
    if (!found) {
        console.log("❌ Aucun résultat trouvé.");
    }
}

switch (action) {
    case 'add':
        addKB(arg1, arg2);
        break;
    case 'search':
        searchKB(arg1);
        break;
    case 'list':
        listKB();
        break;
    default:
        console.error("❌ Action inconnue. Utilisez 'add', 'search', ou 'list'.");
}
