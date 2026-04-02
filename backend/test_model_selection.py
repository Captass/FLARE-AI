import json
import requests

# Replace with a real Firebase token copied from a logged-in browser session.
FIREBASE_AUTH_TOKEN = "<REMPLACER_PAR_UN_VRAI_TOKEN_FIREBASE>"
BASE_URL = "http://localhost:8000"

HEADERS = {
    "Authorization": f"Bearer {FIREBASE_AUTH_TOKEN}",
    "Content-Type": "application/json",
}


def run_test(message: str, chat_mode: str) -> None:
    """Run a simple stream test for the requested chat mode."""
    print(f"\n--- Test du mode: {chat_mode.upper()} ---")

    payload = {
        "message": message,
        "session_id": f"test-session-{chat_mode}",
        "chat_mode": chat_mode,
    }

    try:
        with requests.post(
            f"{BASE_URL}/chat/stream",
            headers=HEADERS,
            json=payload,
            stream=True,
            timeout=300,
        ) as response:
            response.raise_for_status()
            print(f"Reponse du serveur (status {response.status_code}):")

            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data: "):
                    continue
                raw_json = line[6:]
                try:
                    data = json.loads(raw_json)
                    print(json.dumps(data, indent=2, ensure_ascii=False))
                    if data.get("type") == "final":
                        print("--- FIN DU STREAM ---")
                        break
                except json.JSONDecodeError:
                    print(f"(chunk brut non JSON): {raw_json}")
    except requests.exceptions.RequestException as exc:
        print(f"\nERREUR LORS DE L'APPEL API: {exc}")
        if getattr(exc, "response", None) is not None:
            print(f"Reponse du serveur: {exc.response.text}")


if __name__ == "__main__":
    if "<REMPLACER" in FIREBASE_AUTH_TOKEN:
        print("ATTENTION")
        print("Remplacez FIREBASE_AUTH_TOKEN par un vrai token Firebase.")
        print("Vous pouvez le recuperer depuis le navigateur apres connexion.")
    else:
        run_test("Salut, c'est un test pour le mode raisonnement.", "raisonnement")
        run_test("Salut, c'est un test pour le mode rapide.", "rapide")
