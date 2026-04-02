/**
 * CAPTASS : HUMAN NOTIFICATION SYSTEM (flare_notify.js)
 * Déclenche une notification native Windows / Mac / Linux pour le Directeur Humain.
 * 
 * Usage:
 *   node flare_notify.js "J'ai besoin de la clé Stripe"
 *   node flare_notify.js "Objectif principal terminé."
 */

const notifier = require('node-notifier');
const path = require('path');

const [,, ...messageWords] = process.argv;
const message = messageWords.join(' ') || "Votre attention est requise.";

try {
    notifier.notify({
        title: '🔔 CAPTASS DEV TEAM',
        message: message,
        sound: true, // Joue un son natif
        wait: false // Ne bloque pas l'exécution de l'agent
    });
    
    console.log(`✅ NOTIFICATION ENVOYÉE AU DIRECTEUR HUMAIN : "${message}"`);
} catch (err) {
    console.error(`❌ Échec de la notification : ${err.message}`);
}
