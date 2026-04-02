/**
 * CAPTASS : INTER-AGENT DISPATCHER (flare_dispatch.js)
 * Permet à un agent d'envoyer une instruction à un autre agent.
 * Inclut retry automatique si le serveur Dashboard n'est pas joignable.
 * 
 * Usage: node flare_dispatch.js <targetAgentId> "<message>"
 */

const { io } = require("socket.io-client");

const targetAgentId = process.argv[2];
const message = process.argv.slice(3).join(" ");

if (!targetAgentId || !message) {
    console.error('Usage: node flare_dispatch.js <targetAgentId> "<message>"');
    console.error('Agents: ALPHA, BETA, GAMMA, DELTA, EPSILON, ZETA, THETA');
    process.exit(1);
}

const VALID_AGENTS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'theta'];
if (!VALID_AGENTS.includes(targetAgentId.toLowerCase())) {
    console.error(`❌ Agent "${targetAgentId}" inconnu. Agents valides: ${VALID_AGENTS.join(', ').toUpperCase()}`);
    process.exit(1);
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
let attempt = 0;

function tryDispatch() {
    attempt++;
    const socket = io("http://localhost:3000", { 
        timeout: 5000,
        reconnection: false 
    });

    socket.on("connect", () => {
        socket.emit("dispatch", { targetAgentId: targetAgentId.toLowerCase(), message });
    });

    socket.on("dispatch-success", (data) => {
        console.log(`✅ DISPATCH → ${data.targetAgentId.toUpperCase()} : "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
        socket.disconnect();
        process.exit(0);
    });

    socket.on("dispatch-error", (data) => {
        console.error(`❌ DISPATCH ERROR : ${data.error}`);
        socket.disconnect();
        process.exit(1);
    });

    socket.on("connect_error", () => {
        socket.disconnect();
        if (attempt < MAX_RETRIES) {
            console.log(`⚠️ Dashboard non joignable (tentative ${attempt}/${MAX_RETRIES}). Retry dans ${RETRY_DELAY/1000}s...`);
            setTimeout(tryDispatch, RETRY_DELAY);
        } else {
            console.error(`❌ DISPATCH ÉCHOUÉ après ${MAX_RETRIES} tentatives. Le serveur Dashboard (port 3000) n'est pas démarré.`);
            process.exit(1);
        }
    });

    // Timeout par tentative
    setTimeout(() => {
        socket.disconnect();
        if (attempt < MAX_RETRIES) {
            console.log(`⚠️ Timeout (tentative ${attempt}/${MAX_RETRIES}). Retry...`);
            setTimeout(tryDispatch, RETRY_DELAY);
        } else {
            console.error("❌ TIMEOUT : Le serveur n'a pas répondu après 3 tentatives.");
            process.exit(1);
        }
    }, 5000);
}

tryDispatch();
