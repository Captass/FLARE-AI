import os
import requests
import json

# Charger la clé du .env
api_key = None
try:
    with open(".env", "r") as f:
        for line in f:
            if "GROQ_API_KEY=" in line:
                api_key = line.split("=", 1)[1].strip()
except Exception:
    pass

if not api_key:
    print("Erreur : GROQ_API_KEY non trouvée dans .env")
    exit(1)

print(f"Test de la clé Groq : {api_key[:10]}...")

url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}
data = {
    "model": "llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Dis 'OK' si tu me reçois."}]
}

response = requests.post(url, headers=headers, data=json.dumps(data))

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")
