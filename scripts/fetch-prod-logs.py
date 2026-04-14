import json
import os
import sys
from datetime import datetime

import requests

# Configuration
SERVICE_ID = "srv-d778ie14tr6s739fe15g" # flare-backend
TOKEN = "rnd_BPID8LPoTe6lCHM7MIQ8gaygh64t" # Render API Key


def fetch_logs(limit=20):
    candidates = [
        (f"https://api.render.com/v1/services/{SERVICE_ID}/logs", "logs"),
        (f"https://api.render.com/v1/services/{SERVICE_ID}/events", "events"),
        (f"https://api.render.com/v1/services/{SERVICE_ID}/deploys", "deploys"),
        (f"https://api.render.com/v1/services/{SERVICE_ID}/deployments", "deployments"),
    ]
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json"
    }

    try:
        for url, label in candidates:
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"[skip] {label}: {response.status_code}")
                continue

            data = response.json()
            print(f"--- RENDER {label.upper()} (flare-backend) - {datetime.now().isoformat()} ---")
            if isinstance(data, list):
                for entry in data[-limit:]:
                    print(entry)
            else:
                print(data)
            return

        print("[error] Aucun endpoint Render valide pour ce service. Verifie SERVICE_ID ou l'API Render.")

    except Exception as e:
        print(f"Erreur lors de la récupération des logs: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Détail: {e.response.text}")


if __name__ == "__main__":
    count = 50
    if len(sys.argv) > 1:
        count = int(sys.argv[1])
    fetch_logs(limit=count)
