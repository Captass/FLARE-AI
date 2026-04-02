import httpx
import time
import sys

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

def test_health():
    print(f"Testing Health Check: {BASE_URL}/health")
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            print("OK - Health Check Passed")
            return True
        else:
            print(f"FAIL - Health Check Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"ERROR - Health Check Error: {e}")
        return False

def test_chat():
    print(f"Testing Chat API: {BASE_URL}/chat")
    payload = {
        "message": "Bonjour, ceci est un test de fumée (smoke test). Réponds brièvement : OK.",
        "session_id": "smoke-test-session"
    }
    try:
        response = httpx.post(f"{BASE_URL}/chat", json=payload, timeout=30)
        if response.status_code == 200:
            print("OK - Chat API Passed")
            print(f"   Response: {response.text[:100]}...")
            return True
        else:
            print(f"FAIL - Chat API Failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"ERROR - Chat API Error: {e}")
        return False

if __name__ == "__main__":
    print(f"Starting Autonomous Verification for {BASE_URL}")
    success = True
    if not test_health(): success = False
    if not test_chat(): success = False
    
    if success:
        print("\nALL CORE TESTS PASSED")
        sys.exit(0)
    else:
        print("\nSOME TESTS FAILED")
        sys.exit(1)
