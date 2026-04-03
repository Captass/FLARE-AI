import httpx
import json
import asyncio
import sys

BASE_URL = "https://flare-ai-backend-680977256801.europe-west9.run.app"

async def test_stream(message, test_name, deep_research=False):
    print(f"\n--- Testing: {test_name} ---")
    payload = {
        "message": message,
        "deep_research": deep_research
    }
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("POST", f"{BASE_URL}/chat/stream", json=payload) as response:
                if response.status_code != 200:
                    print(f"Error: Status {response.status_code}")
                    return False
                
                full_text = ""
                has_thought = False
                has_delta = False
                has_final = False
                has_image = False
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        msg_type = data.get("type")
                        
                        if msg_type == "keepalive":
                            print(".", end="", flush=True)
                        elif msg_type == "thought":
                            has_thought = True
                        elif msg_type == "delta":
                            has_delta = True
                            full_text += data.get("content", "")
                        elif msg_type == "final":
                            has_final = True
                            if data.get("images"):
                                has_image = True
                            print("\nFinal Response received.")
                        elif msg_type == "error":
                            print(f"\nAPI Error: {data.get('content')}")
                            return False
                
                print(f"\nResults for {test_name}:")
                print(f"- SSE Connection: OK")
                print(f"- Thought blocks: {'YES' if has_thought else 'NO'}")
                print(f"- Delta streaming: {'YES' if has_delta else 'NO'}")
                print(f"- Final event: {'YES' if has_final else 'NO'}")
                if "image" in test_name.lower():
                    print(f"- Image generated: {'YES' if has_image else 'NO'}")
                
                return has_final
    except Exception as e:
        print(f"\nRequest failed: {e}")
        return False

async def main():
    # Test 1: Simple Chat
    success1 = await test_stream("Bonjour FLARE AI, qui es-tu ?", "Simple Chat SSE")
    
    # Test 2: Web Search (Grounding)
    success2 = await test_stream("Quel est le dernier cri de FLARE AI sur Google Search ?", "Web Search Grounding")
    
    # Test 3: Image Generation
    success3 = await test_stream("Génère une image de logo futuriste pour une agence IA appelée FLARE AI. (Anglais: Generate a futuristic logo for an AI agency named FLARE AI)", "Image Generation")

    if success1 and success2 and success3:
        print("\n✅ ALL TESTS PASSED SUCCESSFULLY")
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
