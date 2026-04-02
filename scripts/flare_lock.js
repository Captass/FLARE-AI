/**
 * CAPTASS : CLI LOCK BRIDGE (flare_lock.js)
 * Permet aux agents d'interagir avec le LockManager via le terminal.
 * Usage: node flare_lock.js <action> <filePath> <agentName>
 */

const lockManager = require('./lockManager');

const [,, action, filePath, agentName] = process.argv;

if (!action || !filePath || !agentName) {
    console.error("Usage: node flare_lock.js <acquire|release|status> <filePath> <agentName>");
    process.exit(1);
}

async function run() {
    try {
        switch (action.toLowerCase()) {
            case 'acquire':
                await lockManager.acquireLock(filePath, agentName);
                console.log(`✅ SUCCESS : Verrou posé sur '${filePath}' pour ${agentName}.`);
                process.exit(0);
                break;

            case 'release':
                const released = await lockManager.releaseLock(filePath, agentName);
                if (released) {
                    console.log(`🔓 SUCCESS : Verrou libéré pour '${filePath}'.`);
                } else {
                    console.log(`⚠️ INFO : Aucun verrou trouvé pour '${filePath}' sous le nom ${agentName}.`);
                }
                process.exit(0);
                break;

            case 'status':
                const status = await lockManager.getLockStatus(filePath, agentName);
                if (status.locked) {
                    console.log(`🔒 LOCKED : Détenu par ${status.owner}.`);
                } else if (status.owner === agentName.toUpperCase()) {
                    console.log(`🟢 OWNED : Vous possédez déjà ce verrou.`);
                } else {
                    console.log(`🔓 FREE : Fichier disponible.`);
                }
                process.exit(0);
                break;

            default:
                console.error(`❌ ERROR : Action inconnue '${action}'.`);
                process.exit(1);
        }
    } catch (error) {
        console.error(`❌ ERROR : ${error.message}`);
        process.exit(1); // Crucial pour arrêter l'exécution de l'agent
    }
}

run();
