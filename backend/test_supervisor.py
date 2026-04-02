import asyncio
import sys
import os

# 1. Préparer l'environnement
env_vars = {}
try:
    with open(".env", "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()
except Exception:
    pass

os.environ["LLM_PROVIDER"] = "groq"
os.environ["GROQ_API_KEY"] = env_vars.get("GROQ_API_KEY", "")

# Ajouter le chemin du backend
sys.path.append(os.path.abspath("."))

# Mock de llm_factory
import core.llm_factory
from langchain_groq import ChatGroq

def mock_get_llm(temperature=0.7, streaming=False, model_override=None):
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=temperature,
        groq_api_key=os.environ["GROQ_API_KEY"]
    )

core.llm_factory.get_llm = mock_get_llm

from agents.supervisor import classify_request

async def test_classification():
    tests = [
        ("Quelle est la météo à Paris ?", "researcher"),
        ("Génère une image de chat dans l'espace", "media"),
        ("Liste mes derniers emails Gmail", "workspace"),
        ("Bonjour, comment vas-tu ?", "chat"),
        ("Crée un tableau Sheets pour mon budget", "workspace"),
        ("Fais une recherche approfondie sur l'IA en 2026", "researcher"),
        ("Utilise ma compétence de rédaction pour un email", "media"), # 'media' gère les skills
    ]
    
    print("\n--- TEST DE CLASSIFICATION INTELLIGENTE (GROQ) ---\n")
    
    success_count = 0
    for query, expected in tests:
        print(f"Test: '{query}'")
        try:
            result = await classify_request(query)
            if result == expected:
                print(f"  SUCCESS : -> '{result}'")
                success_count += 1
            else:
                print(f"  FAILURE : -> '{result}' (Attendu: {expected})")
        except Exception as e:
            print(f"  ERROR : {e}")
            
    print(f"\nRESULTAT : {success_count}/{len(tests)} classifications réussies.")

if __name__ == "__main__":
    asyncio.run(test_classification())
