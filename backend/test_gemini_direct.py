import os
import requests
import json

# Charger la clé du .env
api_key = None
try:
    with open(".env", "r") as f:
        for line in f:
            if "GEMINI_API_KEY=" in line:
                api_key = line.split("=", 1)[1].strip()
except Exception:
    pass

if not api_key:
    print("Erreur : GEMINI_API_KEY non trouvée dans .env")
    exit(1)

print(f"Test de la clé : {api_key[:10]}...")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
headers = {'Content-Type': 'application/json'}
data = {
    "contents": [{"parts":[{"text": "Dis 'OK' si tu me reçois."}]}]
}

response = requests.post(url, headers=headers, data=json.dumps(data))

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")
