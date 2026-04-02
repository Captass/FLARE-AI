/**
 * CAPTASS : CODEBASE MAPPER (flare_map.js)
 * Scanne le projet et génère PROJECT_MAP.md — une carte complète
 * des exports, routes API, composants et fonctions du projet.
 * Les agents lisent ce fichier AVANT de coder pour éviter les hallucinations.
 *
 * Usage:
 *   node flare_map.js [dossier_cible]
 */

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', '.git', '.gemini', 'KNOWLEDGE', 'REVIEWS', 'dist', 'build', '.next'];
const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

const targetDir = process.argv[2] || process.cwd();

function scanDirectory(dir, relativeTo) {
    let files = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (IGNORE_DIRS.includes(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(scanDirectory(fullPath, relativeTo));
            } else if (CODE_EXTENSIONS.includes(path.extname(entry.name))) {
                files.push(fullPath);
            }
        }
    } catch (e) { /* skip unreadable dirs */ }
    return files;
}

function analyzeFile(filePath, relativeTo) {
    const relPath = path.relative(relativeTo, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const analysis = {
        path: relPath,
        exports: [],
        routes: [],
        components: [],
        functions: [],
        imports: []
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        // Detect exports
        if (/^export\s+(default\s+)?(function|class|const|let|var)\s+(\w+)/.test(line)) {
            const match = line.match(/^export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/);
            if (match) analysis.exports.push({ name: match[1], line: lineNum });
        }
        if (/module\.exports\s*=/.test(line)) {
            analysis.exports.push({ name: 'module.exports', line: lineNum });
        }

        // Detect Express routes
        if (/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/.test(line)) {
            const match = line.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (match) analysis.routes.push({ method: match[1].toUpperCase(), path: match[2], line: lineNum });
        }
        if (/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/.test(line)) {
            const match = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (match) analysis.routes.push({ method: match[1].toUpperCase(), path: match[2], line: lineNum });
        }

        // Detect React components (function Component or const Component = )
        if (/^(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w+)/.test(line)) {
            const match = line.match(/function\s+([A-Z]\w+)/);
            if (match) analysis.components.push({ name: match[1], line: lineNum });
        }
        if (/^(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*\(/.test(line)) {
            const match = line.match(/const\s+([A-Z]\w+)\s*=/);
            if (match) analysis.components.push({ name: match[1], line: lineNum });
        }

        // Detect regular functions
        if (/^(?:async\s+)?function\s+([a-z]\w+)/.test(line)) {
            const match = line.match(/function\s+([a-z]\w+)/);
            if (match) analysis.functions.push({ name: match[1], line: lineNum });
        }

        // Detect imports
        if (/^(?:const|let|var)\s+.*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/.test(line)) {
            const match = line.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
            if (match) analysis.imports.push(match[1]);
        }
        if (/^import\s+/.test(line)) {
            const match = line.match(/from\s+['"`]([^'"`]+)['"`]/);
            if (match) analysis.imports.push(match[1]);
        }
    }

    return analysis;
}

function generateMap(analyses) {
    let md = `# 🗺️ PROJECT_MAP.md — Carte du Projet\n`;
    md += `> Généré automatiquement par \`flare_map.js\` le ${new Date().toISOString()}\n`;
    md += `> **Agents** : Lisez ce fichier AVANT de coder pour connaître l'architecture existante.\n\n`;

    // Routes API
    const allRoutes = analyses.flatMap(a => a.routes.map(r => ({ ...r, file: a.path })));
    if (allRoutes.length > 0) {
        md += `## 🌐 Routes API\n\n`;
        md += `| Méthode | URL | Fichier | Ligne |\n|---|---|---|---|\n`;
        allRoutes.forEach(r => {
            md += `| \`${r.method}\` | \`${r.path}\` | ${r.file} | L${r.line} |\n`;
        });
        md += `\n`;
    }

    // React Components
    const allComponents = analyses.flatMap(a => a.components.map(c => ({ ...c, file: a.path })));
    if (allComponents.length > 0) {
        md += `## ⚛️ Composants React/UI\n\n`;
        md += `| Composant | Fichier | Ligne |\n|---|---|---|\n`;
        allComponents.forEach(c => {
            md += `| \`${c.name}\` | ${c.file} | L${c.line} |\n`;
        });
        md += `\n`;
    }

    // Exports
    const allExports = analyses.flatMap(a => a.exports.map(e => ({ ...e, file: a.path })));
    if (allExports.length > 0) {
        md += `## 📤 Exports\n\n`;
        md += `| Nom | Fichier | Ligne |\n|---|---|---|\n`;
        allExports.forEach(e => {
            md += `| \`${e.name}\` | ${e.file} | L${e.line} |\n`;
        });
        md += `\n`;
    }

    // Functions
    const allFunctions = analyses.flatMap(a => a.functions.map(f => ({ ...f, file: a.path })));
    if (allFunctions.length > 0) {
        md += `## 🔧 Fonctions\n\n`;
        md += `| Fonction | Fichier | Ligne |\n|---|---|---|\n`;
        allFunctions.forEach(f => {
            md += `| \`${f.name}\` | ${f.file} | L${f.line} |\n`;
        });
        md += `\n`;
    }

    // File tree
    md += `## 📁 Arbre des Fichiers Code\n\n`;
    analyses.forEach(a => {
        const deps = a.imports.filter(i => !i.startsWith('.')).join(', ');
        const localDeps = a.imports.filter(i => i.startsWith('.')).join(', ');
        md += `- \`${a.path}\``;
        if (deps) md += ` — Deps: [${deps}]`;
        if (localDeps) md += ` — Local: [${localDeps}]`;
        md += `\n`;
    });

    return md;
}

// === EXECUTION ===
console.log(`🗺️ Scanning du projet dans: ${targetDir}...`);
const files = scanDirectory(targetDir, targetDir);
console.log(`   ${files.length} fichiers code trouvés.`);

const analyses = files.map(f => analyzeFile(f, targetDir));
const mapContent = generateMap(analyses);

const outputPath = path.join(targetDir, 'PROJECT_MAP.md');
fs.writeFileSync(outputPath, mapContent, 'utf-8');
console.log(`✅ PROJECT_MAP.md généré avec succès (${analyses.length} fichiers analysés).`);
console.log(`   Routes API : ${analyses.reduce((s, a) => s + a.routes.length, 0)}`);
console.log(`   Composants : ${analyses.reduce((s, a) => s + a.components.length, 0)}`);
console.log(`   Exports    : ${analyses.reduce((s, a) => s + a.exports.length, 0)}`);
console.log(`   Fonctions  : ${analyses.reduce((s, a) => s + a.functions.length, 0)}`);
