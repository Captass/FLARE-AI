import sys
import asyncio
import os

sys.path.append(os.path.abspath("."))

try:
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()
except Exception:
    pass

os.environ["DATABASE_URL"] = "sqlite:///./test_e2e.db"



from core.database import engine, Base
# Initialize schema
Base.metadata.create_all(bind=engine)

from agents.supervisor import get_supervisor

async def test_generation():
    sup = get_supervisor()
    
    print("--- Testing Word Generation ---")
    doc_success = False
    try:
        async for chunk in sup.chat_stream(user_message="génère un document word intitulé 'TestDoc' avec un paragraphe simple.", session_id="test1", user_id="u1"):
            print(">>> CHUNK", chunk); chunk_type = chunk.get("type")
            if chunk_type == "final":
                images = chunk.get("images", [])
                if any(img.get("name", "").endswith(".docx") for img in images):
                    doc_success = True
                print("MEDIA CHUNK:", chunk)
                if chunk.get("name", "").endswith(".docx") or chunk.get("type_mime", "") in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
                    doc_success = True
            elif chunk_type == "tool_use":
                print("TOOL USE:", chunk)
            elif chunk_type == "error":
                print("ERROR:", chunk)
    except Exception as e:
        import traceback; traceback.print_exc()

    print("\n--- Testing Excel Generation ---")
    xls_success = False
    try:
        async for chunk in sup.chat_stream(user_message="génère un tableau excel intitulé 'TestExcel' avec 2 colonnes", session_id="test2", user_id="u1"):
            print(">>> CHUNK", chunk); chunk_type = chunk.get("type")
            if chunk_type == "final":
                images = chunk.get("images", [])
                if any(img.get("name", "").endswith(".docx") for img in images):
                    doc_success = True
                print("MEDIA CHUNK:", chunk)
                if chunk.get("name", "").endswith(".xlsx") or chunk.get("type_mime", "") in ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]:
                    xls_success = True
            elif chunk_type == "tool_use":
                print("TOOL USE:", chunk)
            elif chunk_type == "error":
                print("ERROR:", chunk)
    except Exception as e:
        import traceback; traceback.print_exc()

    print("\n--- RESULTS ---")
    print(f"Word E2E Test: {'SUCCESS' if doc_success else 'FAILED'}")
    print(f"Excel E2E Test: {'SUCCESS' if xls_success else 'FAILED'}")

if __name__ == "__main__":
    asyncio.run(test_generation())






