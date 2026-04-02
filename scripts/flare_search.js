/**
 * CAPTASS : SYSTEM WEB SEARCH (flare_search.js)
 * Permet aux agents de rechercher des documentations récentes pour éviter les hallucinations.
 * Utilise DuckDuckGo HTML.
 * 
 * Usage:
 *   node flare_search.js "React 19 hooks documentation"
 */

const axios = require('axios');
const cheerio = require('cheerio');

const query = process.argv.slice(2).join(' ');
if (!query) {
    console.error("❌ Usage: node flare_search.js <requête>");
    process.exit(1);
}

async function search() {
    try {
        console.log(`🔍 Recherche web en cours pour: "${query}"...\n`);
        const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            },
            timeout: 10000 // Timeout de 10 secondes pour éviter le blocage de l'agent
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.result').each((i, el) => {
            if (i < 5) { // Prendre les 5 premiers résultats
                const title = $(el).find('.result__title').text().trim();
                const snippet = $(el).find('.result__snippet').text().trim();
                const link = $(el).find('.result__url').text().trim();
                
                if (title && snippet) {
                    results.push(`🔹 [${title}] (${link})\n   ${snippet}\n`);
                }
            }
        });
        
        if (results.length > 0) {
            console.log("✅ RÉSULTATS TROUVÉS :\n");
            console.log(results.join('\n'));
        } else {
            console.log("❌ Aucun résultat trouvé. Soyez plus spécifique.");
        }
    } catch (err) {
        console.error("❌ Erreur de réseau ou de parsing lors de la recherche :", err.message);
    }
}

search();
