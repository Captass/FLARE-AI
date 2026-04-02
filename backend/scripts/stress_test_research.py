import httpx
import time
import sys

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "https://flare-backend-697087764922.europe-west1.run.app"

def test_stress_deep_research():
    print(f"Starting Deep Research Stress Test (URL: {BASE_URL})")
    
    # Sujet complexe pour forcer plusieurs angles et recherches
    payload = {
        "message": "Fais une recherche TRES approfondie sur l'etat actuel de l'intelligence artificielle a Madagascar en 2026. Analyse le marche, les startups locales, et les opportunites d'investissement. Je veux un rapport complet.",
        "session_id": "stress-test-research",
        "deep_research": True
    }
    
    start_time = time.time()
    try:
        # Long timeout pour le deep research (orchestrator a un timeout de 120s interne)
        response = httpx.post(f"{BASE_URL}/chat", json=payload, timeout=300)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            content = data.get("response", "")
            print(f"OK - Stress Test Succeeded in {duration:.2f}s")
            print(f"   Response Length: {len(content)} characters")
            # Vérifier si on a bien des résultats de recherche mentionnés
            if len(content) > 500:
                print("   Result seems substantial.")
            else:
                print("   WAIT - Result seems thin for a deep research.")
            return True
        else:
            print(f"FAIL - Stress Test Failed: {response.status_code} - {response.text}")
            return False
    except httpx.ReadTimeout:
        print(f"FAIL - Stress Test Failed: Timeout after 300s")
        return False
    except Exception as e:
        print(f"ERROR - Stress Test Error: {e}")
        return False

if __name__ == "__main__":
    test_stress_deep_research()
