import requests
import json
import os
import sys
from datetime import datetime

# Configuration
SERVICE_ID = "srv-d778ie14tr6s739fe15g" # flare-backend
TOKEN = "rnd_BPID8LPoTe6lCHM7MIQ8gaygh64t" # Render API Key

def fetch_logs(limit=20):
    url = f"https://api.render.com/v1/services/{SERVICE_ID}/logs"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json"
    }
    
    try:
        # Note: Render logs endpoint might differ based on API version or specific setup.
        # But for an agent, listing deployments or events is also useful.
        # This specific endpoint is for log streams or historical logs.
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        logs = response.json()
        
        print(f"--- LOGS PROD (flare-backend) - {datetime.now().isoformat()} ---")
        for entry in logs[-limit:]:
            # Format depends on Render API response structure
            print(entry)
            
    except Exception as e:
        print(f"Erreur lors de la récupération des logs: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(f"Détail: {e.response.text}")

if __name__ == "__main__":
    count = 50
    if len(sys.argv) > 1:
        count = int(sys.argv[1])
    fetch_logs(limit=count)
