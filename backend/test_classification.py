import asyncio
import sys
import os
import re
from unittest.mock import MagicMock, patch

# Ajouter le chemin du backend
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock des dépendances avant l'import
sys.modules['core.config'] = MagicMock()
sys.modules['core.config'].settings = MagicMock()
sys.modules['core.config'].settings.LLM_PROVIDER = "gemini"

sys.modules['core.llm_factory'] = MagicMock()

async def test_classification():
    from agents.supervisor import classify_request
    
    print("\n--- Test Classification ---")
    
    # 1. Test Fast Path (Greetings)
    res = await classify_request("Bonjour")
    print(f"Greeting 'Bonjour' -> {res} (Expected: chat)")
    
    res = await classify_request("Salut !")
    print(f"Greeting 'Salut !' -> {res} (Expected: chat)")
    
    # 2. Test Mots-clés Media
    res = await classify_request("Génère une image de chat")
    print(f"Keywords 'Génère une image' -> {res} (Expected: media)")
    
    # 3. Test Routage LLM (Simulation)
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = MagicMock(content="researcher")
    
    with patch('core.llm_factory.get_llm', return_value=mock_llm) as mock_get_llm:
        res = await classify_request("Qui a gagné la ligue des champions ?")
        print(f"Complex Query -> {res} (Expected: researcher)")
        
        # Vérifier le modèle utilisé
        args, kwargs = mock_get_llm.call_args
        print(f"Modèle utilisé pour le routage : {kwargs.get('model_override')}")

if __name__ == "__main__":
    asyncio.run(test_classification())
