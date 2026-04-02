import asyncio
import time
import sys
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv(os.path.join(os.getcwd(), "backend", ".env"))

# Ajouter le chemin du backend
sys.path.append(os.path.join(os.getcwd(), "backend"))

from agents.supervisor import get_supervisor

async def test_latency(message: str):
    supervisor = get_supervisor()
    print(f"\n--- Test: '{message}' ---")
    
    start_time = time.time()
    first_token_time = None
    
    async for event in supervisor.chat_stream(
        user_message=message,
        session_id="test_latency_session",
        user_id="anonymous"
    ):
        if first_token_time is None and event.get("type") in ["delta", "thought"]:
            first_token_time = time.time() - start_time
            print(f"⏱️ Premier événement ({event['type']}) après {first_token_time:.3f}s")
        
        if event.get("type") == "delta":
            print(event["content"], end="", flush=True)
        elif event.get("type") == "final":
            print(f"\n✅ Terminé en {time.time() - start_time:.3f}s")

if __name__ == "__main__":
    # Test Bonjour (Fast Path)
    asyncio.run(test_latency("Bonjour"))
    
    # Test Recherche (Routage LLM)
    # asyncio.run(test_latency("Qui est le président de la France ?"))
