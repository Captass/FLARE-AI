import https from "https";

const SERVICE_ID = "srv-d778ie14tr6s739fe15g"; // flare-backend
const TOKEN = "rnd_BPID8LPoTe6lCHM7MIQ8gaygh64t"; // Render API Key

const CANDIDATES = [
  { url: `https://api.render.com/v1/services/${SERVICE_ID}/logs`, label: "logs" },
  { url: `https://api.render.com/v1/services/${SERVICE_ID}/events`, label: "events" },
  { url: `https://api.render.com/v1/services/${SERVICE_ID}/deploys`, label: "deploys" },
  { url: `https://api.render.com/v1/services/${SERVICE_ID}/deployments`, label: "deployments" },
];

const limit = Number(process.argv[2] || 50);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "null");
            resolve({ status: res.statusCode || 0, data: parsed });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  for (const candidate of CANDIDATES) {
    try {
      const result = await fetchJson(candidate.url);
      if (result.status !== 200) {
        console.log(`[skip] ${candidate.label}: ${result.status}`);
        continue;
      }
      console.log(`--- RENDER ${candidate.label.toUpperCase()} (flare-backend) ---`);
      if (Array.isArray(result.data)) {
        result.data.slice(-limit).forEach((entry) => console.log(entry));
      } else {
        console.log(result.data);
      }
      return;
    } catch (err) {
      console.log(`[skip] ${candidate.label}: ${err.message || err}`);
    }
  }
  console.log("[error] Aucun endpoint Render valide pour ce service.");
}

main();
