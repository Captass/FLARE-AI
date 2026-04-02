/**
 * CAPTASS : BOILERPLATE GENERATOR (flare_bootstrap.js)
 * Génère instantanément un projet pré-configuré pour que les agents
 * passent directement à la logique métier sans perdre de temps.
 *
 * Usage:
 *   node flare_bootstrap.js react-express
 *   node flare_bootstrap.js api-only
 *   node flare_bootstrap.js static-site
 *   node flare_bootstrap.js list
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEMPLATES = {
    'react-express': {
        description: 'Frontend React (Vite) + Backend Express.js + CORS configuré',
        structure: {
            'package.json': JSON.stringify({
                name: "captass-project",
                version: "1.0.0",
                scripts: {
                    "dev:backend": "node server.js",
                    "dev:frontend": "npx vite --port 5173",
                    "dev": "node server.js & npx vite --port 5173",
                    "build": "npx vite build",
                    "test": "node --check server.js && echo 'Syntax OK'"
                },
                dependencies: {
                    "express": "^4.18.0",
                    "cors": "^2.8.5"
                }
            }, null, 2),
            'server.js': `const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// === ROUTES API (à compléter par BETA) ===

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Démarrage
app.listen(PORT, () => console.log(\`✅ Backend CAPTASS actif sur http://localhost:\${PORT}\`));
`,
            'index.html': `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CAPTASS App</title>
    <link rel="stylesheet" href="/src/style.css">
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
</body>
</html>`,
            'src/main.js': `// === FRONTEND PRINCIPAL (à compléter par DELTA) ===
const API_URL = 'http://localhost:3001/api';

async function init() {
    const app = document.getElementById('app');
    try {
        const res = await fetch(\`\${API_URL}/health\`);
        const data = await res.json();
        app.innerHTML = '<h1>✅ Application CAPTASS Active</h1><p>Backend connecté : ' + data.status + '</p>';
    } catch (err) {
        app.innerHTML = '<h1>❌ Backend non connecté</h1><p>Lancez: npm run dev:backend</p>';
    }
}
init();
`,
            'src/style.css': `/* === DESIGN SYSTEM (à compléter par DELTA) === */
:root {
    --bg: #0f172a;
    --text: #f1f5f9;
    --accent: #38bdf8;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
h1 { font-size: 2rem; margin-bottom: 1rem; }
`,
            'vite.config.js': `// Vite config minimale
export default { root: '.', server: { port: 5173 } };
`
        }
    },
    'api-only': {
        description: 'Backend Express.js API pure (pas de frontend)',
        structure: {
            'package.json': JSON.stringify({
                name: "captass-api",
                version: "1.0.0",
                scripts: {
                    "start": "node server.js",
                    "dev": "node server.js",
                    "test": "node --check server.js && echo 'Syntax OK'"
                },
                dependencies: {
                    "express": "^4.18.0",
                    "cors": "^2.8.5"
                }
            }, null, 2),
            'server.js': `const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// === ROUTES API (à compléter par BETA) ===

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(\`✅ API CAPTASS active sur http://localhost:\${PORT}\`));
`
        }
    },
    'static-site': {
        description: 'Site statique HTML/CSS/JS (pas de backend)',
        structure: {
            'index.html': `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CAPTASS Static</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main id="app">
        <h1>CAPTASS Static Site</h1>
    </main>
    <script src="app.js"></script>
</body>
</html>`,
            'style.css': `:root { --bg: #0f172a; --text: #f1f5f9; --accent: #38bdf8; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
`,
            'app.js': `// === LOGIQUE (à compléter par DELTA) ===
console.log('CAPTASS Static Site loaded.');
`
        }
    }
};

const [,, templateName, targetDir] = process.argv;

if (!templateName || templateName === 'list') {
    console.log("\n📦 CAPTASS BOILERPLATE GENERATOR — Templates Disponibles :\n");
    Object.entries(TEMPLATES).forEach(([name, tpl]) => {
        console.log(`  🔹 ${name.padEnd(20)} — ${tpl.description}`);
    });
    console.log(`\nUsage: node flare_bootstrap.js <template> [dossier_cible]`);
    process.exit(0);
}

const template = TEMPLATES[templateName];
if (!template) {
    console.error(`❌ Template "${templateName}" introuvable. Utilisez "node flare_bootstrap.js list".`);
    process.exit(1);
}

const outputDir = targetDir ? path.resolve(targetDir) : process.cwd();

console.log(`\n🚀 Génération du projet [${templateName}] dans ${outputDir}...`);

Object.entries(template.structure).forEach(([filePath, content]) => {
    const fullPath = path.join(outputDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  ✅ ${filePath}`);
});

// Install dependencies si package.json exists
if (template.structure['package.json']) {
    console.log(`\n📦 Installation des dépendances (npm install)...`);
    try {
        execSync('npm install', { cwd: outputDir, stdio: 'inherit' });
        console.log(`✅ Dépendances installées avec succès.`);
    } catch (err) {
        console.error(`⚠️ npm install a échoué, mais les fichiers sont créés.`);
    }
}

console.log(`\n🎉 Projet [${templateName}] prêt ! Les agents peuvent commencer à coder la logique métier.`);
