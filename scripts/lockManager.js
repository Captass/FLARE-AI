/**
 * CAPTASS : LOCK MANAGER (lockManager.js)
 * Responsable de la coordination asynchrone des agents via Mutex sur DEV_SYNC.md.
 */

const fs = require('fs/promises');
const path = require('path');

const DEV_SYNC_PATH = path.join(__dirname, 'DEV_SYNC.md');
const LOCK_START_TAG = "<!-- LOCKS_START -->";
const LOCK_END_TAG = "<!-- LOCKS_END -->";

const LOCK_FILE_PATH = path.join(__dirname, 'DEV_SYNC.lock');

/**
 * Exécute une tâche avec un VRAI verrouillage système inter-processus.
 * Utilise la création atomique de répertoire/fichier (wx flag).
 */
async function runWithLock(task) {
    const maxRetries = 20; // 10 secondes max (20 * 500ms)
    const retryDelay = 500;
    const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    // Auto-cleanup stale system locks (crashed agent protection)
    try {
        const stat = await fs.stat(LOCK_FILE_PATH);
        if (Date.now() - stat.mtimeMs > STALE_TIMEOUT_MS) {
            await fs.unlink(LOCK_FILE_PATH);
        }
    } catch (e) { /* no lock file = nothing to clean */ }

    for (let i = 0; i < maxRetries; i++) {
        try {
            // Création atomique : échoue si le fichier existe déjà
            await fs.writeFile(LOCK_FILE_PATH, process.pid.toString(), { flag: 'wx' });
            
            try {
                // Exécuter la tâche métier
                return await task();
            } finally {
                // Toujours supprimer le verrou à la fin
                try { await fs.unlink(LOCK_FILE_PATH); } catch (e) {}
            }
        } catch (err) {
            if (err.code === 'EEXIST') {
                // Le verrou est pris, on attend et on réessaie
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                throw err;
            }
        }
    }
    throw new Error("TIMEOUT : Impossible d'obtenir le verrou système sur DEV_SYNC.md après 10 secondes.");
}

/**
 * Vérifie si un fichier est verrouillé par un autre agent.
 * @param {string} filePath - Chemin relatif du fichier cible.
 * @param {string} requestingAgent - Nom de l'agent demandeur (ex: 'BETA').
 * @returns {Promise<{locked: boolean, owner: string|null}>}
 */
async function getLockStatus(filePath, requestingAgent) {
    return await runWithLock(async () => {
        try {
            const content = await fs.readFile(DEV_SYNC_PATH, 'utf-8');
            const locksZone = extractLocksZone(content);
            
            // Regex pour trouver qui possède le verrou sur ce fichier précis
            const lockRegex = new RegExp(`\\[LOCKED BY (.*?)\\] ${filePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\r?\\n|$)`, 'i');
            const match = locksZone.match(lockRegex);

            if (match) {
                const owner = match[1].toUpperCase();
                if (owner === requestingAgent.toUpperCase()) {
                    return { locked: false, owner: owner }; // Possède déjà le verrou
                }
                return { locked: true, owner: owner }; // Verrouillé par quelqu'un d'autre
            }

            return { locked: false, owner: null }; // Libre
        } catch (error) {
            console.error("Erreur lecture DEV_SYNC.md :", error);
            throw error;
        }
    });
}

/**
 * Pose un verrou sur un fichier pour un agent donné.
 * @param {string} filePath - Chemin relatif du fichier.
 * @param {string} agentName - Nom de l'agent (ex: 'BETA').
 */
async function acquireLock(filePath, agentName) {
    return await runWithLock(async () => {
        const status = await getLockStatusNoQueue(filePath, agentName);
        
        if (status.locked) {
            throw new Error(`ACCÈS REFUSÉ : Le fichier '${filePath}' est actuellement VERROUILLÉ par l'agent ${status.owner}. Veuillez choisir une autre tâche.`);
        }

        if (status.owner === agentName.toUpperCase()) {
            return true; // Déjà possédé
        }

        const content = await fs.readFile(DEV_SYNC_PATH, 'utf-8');
        const newLockEntry = `* [LOCKED BY ${agentName.toUpperCase()}] ${filePath}`;
        
        // Insertion dans la zone de verrous
        const updatedContent = content.replace(LOCK_START_TAG, `${LOCK_START_TAG}\n${newLockEntry}`);
        await fs.writeFile(DEV_SYNC_PATH, updatedContent, 'utf-8');
        
        return true;
    });
}

/**
 * Libère un verrou sur un fichier.
 * @param {string} filePath - Chemin relatif du fichier.
 * @param {string} agentName - Nom de l'agent (ex: 'BETA').
 */
async function releaseLock(filePath, agentName) {
    return await runWithLock(async () => {
        const content = await fs.readFile(DEV_SYNC_PATH, 'utf-8');
        
        // Escape regex special chars in filePath, and handle \r?\n gracefully
        const safeFilePath = filePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const lockRegex = new RegExp(`\\r?\\n\\* \\[LOCKED BY ${agentName.toUpperCase()}\\] ${safeFilePath}(?=\\r?\\n|$)`);
        
        if (lockRegex.test(content)) {
            const updatedContent = content.replace(lockRegex, "");
            await fs.writeFile(DEV_SYNC_PATH, updatedContent, 'utf-8');
            return true;
        }
        return false;
    });
}

/**
 * Version interne sans queue pour acquireLock
 */
async function getLockStatusNoQueue(filePath, requestingAgent) {
    const content = await fs.readFile(DEV_SYNC_PATH, 'utf-8');
    const locksZone = extractLocksZone(content);
    const lockRegex = new RegExp(`\\[LOCKED BY (.*?)\\] ${filePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\r?\\n|$)`, 'i');
    const match = locksZone.match(lockRegex);
    if (match) {
        const owner = match[1].toUpperCase();
        return { locked: owner !== requestingAgent.toUpperCase(), owner: owner };
    }
    return { locked: false, owner: null };
}

/**
 * Helper : Extrait la zone entre les tags de parsing.
 */
function extractLocksZone(content) {
    const startIdx = content.indexOf(LOCK_START_TAG);
    const endIdx = content.indexOf(LOCK_END_TAG);
    
    if (startIdx === -1 || endIdx === -1) {
        throw new Error("Tags de parsing <!-- LOCKS_START/END --> manquants dans DEV_SYNC.md");
    }
    
    return content.substring(startIdx + LOCK_START_TAG.length, endIdx);
}

module.exports = {
    getLockStatus,
    acquireLock,
    releaseLock
};
