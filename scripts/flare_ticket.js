/**
 * CAPTASS : AGENTIC KANBAN MANAGER (flare_ticket.js)
 * Gère le board des tickets (TODO -> IN_PROGRESS -> IN_REVIEW -> DONE)
 * Usage:
 *   node flare_ticket.js create "Titre" "Description"
 *   node flare_ticket.js assign TKT-001 BETA
 *   node flare_ticket.js status TKT-001 IN_PROGRESS
 *   node flare_ticket.js list
 */

const fs = require('fs');
const path = require('path');

const BOARD_PATH = path.join(__dirname, 'BOARD.json');
const LOCK_FILE = path.join(__dirname, 'BOARD.lock');

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

// Ensure BOARD.json exists
if (!fs.existsSync(BOARD_PATH)) {
    fs.writeFileSync(BOARD_PATH, JSON.stringify([]), 'utf-8');
}

// Fonction utilitaire pour verrouiller le fichier JSON
async function withLock(callback) {
    const maxRetries = 20;
    const retryDelay = 500;
    const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    // Auto-cleanup stale locks
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
            if (lockAge > STALE_TIMEOUT_MS) {
                fs.unlinkSync(LOCK_FILE);
                console.log("⚠️ Lock orphelin détecté (>5min). Auto-nettoyé.");
            }
        } catch (e) { /* ignore */ }
    }

    for (let i = 0; i < maxRetries; i++) {
        try {
            fs.writeFileSync(LOCK_FILE, process.pid.toString(), { flag: 'wx' });
            try {
                return await callback();
            } finally {
                try { fs.unlinkSync(LOCK_FILE); } catch (e) {}
            }
        } catch (err) {
            if (err.code === 'EEXIST') {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                throw err;
            }
        }
    }
    throw new Error("TIMEOUT: BOARD.json est verrouillé depuis trop longtemps.");
}

async function readBoard() {
    const data = fs.readFileSync(BOARD_PATH, 'utf-8');
    return JSON.parse(data || '[]');
}

function writeBoard(board) {
    fs.writeFileSync(BOARD_PATH, JSON.stringify(board, null, 2), 'utf-8');
}

async function listTickets() {
    await withLock(async () => {
        const board = await readBoard();
        if (board.length === 0) {
            console.log("📋 KANBAN BOARD : Vide. Aucun ticket.");
            return;
        }
        console.log("📋 KANBAN BOARD :\n");
        board.forEach(t => {
            console.log(`[${t.id}] ${t.status.padEnd(12)} | Assigné: ${t.assignee || 'Personne'} | ${t.title}`);
        });
    });
}

function generateId(board) {
    let maxNum = 0;
    board.forEach(t => {
        const match = t.id.match(/TKT-(\d+)/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
    });
    return `TKT-${(maxNum + 1).toString().padStart(3, '0')}`;
}

async function createTicket(title, description) {
    if (!title) return console.error("❌ Erreur: Titre manquant.");
    
    await withLock(async () => {
        const board = await readBoard();
        const newTicket = {
            id: generateId(board),
            title,
            description: description || "",
            status: 'TODO',
            assignee: null,
            created: new Date().toISOString()
        };
        board.push(newTicket);
        writeBoard(board);
        console.log(`✅ SUCCESS : Ticket créé -> ${newTicket.id} (${newTicket.status})`);
    });
}

async function assignTicket(id, agent) {
    if (!id || !agent) return console.error("❌ Erreur: ID ou Agent manquant.");
    
    await withLock(async () => {
        const board = await readBoard();
        const ticket = board.find(t => t.id === id);
        if (!ticket) return console.error(`❌ Erreur: Ticket ${id} introuvable.`);
        
        ticket.assignee = agent.toUpperCase();
        writeBoard(board);
        console.log(`✅ SUCCESS : ${id} assigné à ${ticket.assignee}`);
    });
}

async function updateStatus(id, status) {
    if (!id || !status) return console.error("❌ Erreur: ID ou Status manquant.");
    const upperStatus = status.toUpperCase();
    
    if (!VALID_STATUSES.includes(upperStatus)) {
        return console.error(`❌ Erreur: Statut invalide. Utilisez: ${VALID_STATUSES.join(', ')}`);
    }

    await withLock(async () => {
        const board = await readBoard();
        const ticket = board.find(t => t.id === id);
        if (!ticket) return console.error(`❌ Erreur: Ticket ${id} introuvable.`);
        
        const oldStatus = ticket.status;
        ticket.status = upperStatus;
        writeBoard(board);
        console.log(`✅ SUCCESS : ${id} passé de [${oldStatus}] à [${upperStatus}]`);
    });
}

const [,, action, arg1, ...rest] = process.argv;
const arg2 = rest.join(' ');

switch(action) {
    case 'list': listTickets(); break;
    case 'create': createTicket(arg1, arg2); break;
    case 'assign': assignTicket(arg1, arg2); break;
    case 'status': updateStatus(arg1, arg2); break;
    default:
        console.log("Usage: node flare_ticket.js [list | create | assign | status] [args...]");
}
