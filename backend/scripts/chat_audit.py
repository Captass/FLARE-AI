import json
import secrets
import sys
import time
from typing import Any

import httpx


FIREBASE_API_KEY = "AIzaSyDZld3Ndw9maCtJsi3Ol9F6gV9Zbf4tZRg"
BACKEND_URL = sys.argv[1] if len(sys.argv) > 1 else "https://flare-backend-236458687422.europe-west1.run.app"


def record(results: list[dict[str, Any]], name: str, ok: bool, detail: str = ""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'OK   ' if ok else 'FAIL '} {name} {detail}")


def firebase_signup(email: str, password: str) -> str:
    response = httpx.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}",
        json={"email": email, "password": password, "returnSecureToken": True},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["idToken"]


def main():
    results: list[dict[str, Any]] = []
    email = f"codex.audit.{int(time.time())}.{secrets.token_hex(3)}@example.com"
    password = "CodexTest!123"
    session_id = None

    with httpx.Client(timeout=240) as client:
        try:
            token = firebase_signup(email, password)
            headers = {"Authorization": f"Bearer {token}"}
            json_headers = {**headers, "Content-Type": "application/json"}
            record(results, "firebase_signup", True, email)
        except Exception as exc:
            record(results, "firebase_signup", False, str(exc))
            print(json.dumps(results, indent=2, ensure_ascii=False))
            raise SystemExit(1)

        for method, path in (("POST", "/api/auth/sync"), ("GET", "/api/auth/plan")):
            try:
                response = client.request(method, BACKEND_URL + path, headers=headers)
                response.raise_for_status()
                record(results, path, True, response.text[:180])
            except Exception as exc:
                record(results, path, False, str(exc))

        def chat(message: str, stream: bool = False, **extra):
            nonlocal session_id
            payload = {"message": message, "chat_mode": "raisonnement", **extra}
            if session_id:
                payload["session_id"] = session_id

            if stream:
                with client.stream("POST", BACKEND_URL + "/chat/stream", headers=json_headers, json=payload, timeout=1800) as response:
                    response.raise_for_status()
                    final = None
                    for raw in response.iter_lines():
                        if not raw or not raw.startswith("data: "):
                            continue
                        data = json.loads(raw[6:])
                        if data.get("type") == "final":
                            final = data
                            break
                if not final:
                    raise RuntimeError("No final event received")
                session_id = final.get("session_id") or session_id
                return final

            response = client.post(BACKEND_URL + "/chat", headers=json_headers, json=payload, timeout=1800)
            response.raise_for_status()
            data = response.json()
            session_id = data.get("session_id") or session_id
            return data

        try:
            data = chat("Bonjour, réponds seulement en une phrase courte.")
            record(results, "chat_basic", bool(data.get("response")), data.get("response", "")[:180])
        except Exception as exc:
            record(results, "chat_basic", False, str(exc))

        try:
            chat("Bonjour j'ai 19 ans, je vis à Madagascar et je suis entrepreneur en marketing digital.")
            time.sleep(8)
            memory_resp = client.get(BACKEND_URL + "/memory/facts", headers=headers)
            memory_resp.raise_for_status()
            facts = memory_resp.json()
            fact_map = {item["key"]: item["value"] for item in facts}
            ok = fact_map.get("user_age") == "19 ans" and "madagascar" in fact_map.get("user_location", "").lower()
            record(results, "memory_auto_extract", ok, json.dumps(fact_map, ensure_ascii=False)[:220])
        except Exception as exc:
            record(results, "memory_auto_extract", False, str(exc))

        try:
            create_fact = client.post(
                BACKEND_URL + "/memory/facts",
                headers=json_headers,
                json={"key": "favorite_food", "value": "ramen", "category": "general"},
            )
            create_fact.raise_for_status()
            facts_resp = client.get(BACKEND_URL + "/memory/facts", headers=headers)
            facts_resp.raise_for_status()
            facts = {item["key"]: item["value"] for item in facts_resp.json()}
            record(results, "memory_manual_fact", facts.get("favorite_food") == "ramen", json.dumps(facts, ensure_ascii=False)[:220])
        except Exception as exc:
            record(results, "memory_manual_fact", False, str(exc))

        try:
            knowledge_create = client.post(
                BACKEND_URL + "/knowledge/",
                headers=json_headers,
                json={
                    "title": "Info spéciale FLARE",
                    "content": "Le code secret du projet test est BAOBAB-42.",
                    "source": "manual",
                    "type": "text",
                },
            )
            knowledge_create.raise_for_status()
            knowledge_search = client.post(
                BACKEND_URL + "/knowledge/search",
                headers=json_headers,
                json={"query": "Quel est le code secret du projet test ?", "max_results": 3},
            )
            knowledge_search.raise_for_status()
            search_results = knowledge_search.json().get("results", [])
            refresh = client.post(BACKEND_URL + "/knowledge/refresh", headers=headers)
            refresh.raise_for_status()
            ok = any("BAOBAB-42" in json.dumps(item, ensure_ascii=False) for item in search_results)
            record(results, "knowledge_manual_search", ok, json.dumps(search_results, ensure_ascii=False)[:220])

            upload = client.post(
                BACKEND_URL + "/knowledge/upload",
                headers=headers,
                files={"file": ("note.txt", b"La capitale de test est Antananarivo.", "text/plain")},
                timeout=180,
            )
            upload.raise_for_status()
            record(results, "knowledge_upload", True, upload.text[:180])
        except Exception as exc:
            record(results, "knowledge_suite", False, str(exc))

        media_checks = [
            ("image_generation", "Crée une image photoréaliste d'un café moderne à Antananarivo au coucher du soleil.", "image/", False),
            ("word_generation", "/doc Génère un document Word bref sur le marketing digital à Madagascar.", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", False),
            ("sheet_generation", "/sheet Génère un tableau Excel simple des dépenses d'une petite entreprise à Madagascar.", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", False),
            ("video_generation", "/video Crée une vidéo réaliste live action d'un chef japonais qui mange un bol de ramen, cinematic, no cartoon.", "video/mp4", True),
            ("image_animation", "Anime-la maintenant.", "video/mp4", True),
        ]

        for name, prompt, expected_type, use_stream in media_checks:
            try:
                data = chat(prompt, stream=use_stream)
                media = (data.get("images") or [{}])[0]
                media_type = media.get("type") or ""
                ok = (media_type.startswith(expected_type) if expected_type.endswith("/") else media_type == expected_type) and bool(media.get("data") or media.get("url"))
                detail = json.dumps(
                    {
                        "type": media.get("type"),
                        "name": media.get("name"),
                        "has_data": bool(media.get("data")),
                        "has_url": bool(media.get("url")),
                        "ephemeral": media.get("ephemeral"),
                    },
                    ensure_ascii=False,
                )
                record(results, name, ok, detail)
            except Exception as exc:
                record(results, name, False, str(exc))

        try:
            files_all = client.get(BACKEND_URL + "/files/all/user", headers=headers)
            files_all.raise_for_status()
            files = files_all.json().get("files", [])
            kinds = sorted({item.get("kind") for item in files if item.get("kind")})
            ok = {"image", "document", "sheet", "video"}.issubset(set(kinds))
            record(results, "files_all_user", ok, json.dumps({"count": len(files), "kinds": kinds}, ensure_ascii=False))
        except Exception as exc:
            record(results, "files_all_user", False, str(exc))

        try:
            conversations = client.get(BACKEND_URL + "/chat/conversations", headers=headers)
            conversations.raise_for_status()
            conv_list = conversations.json()
            messages = client.get(BACKEND_URL + f"/chat/conversations/{session_id}/messages", headers=headers)
            messages.raise_for_status()
            message_list = messages.json()
            has_attachment = any(isinstance(message.get("attachment"), dict) for message in message_list if message.get("role") == "assistant")
            record(results, "conversation_history", bool(conv_list) and has_attachment, json.dumps({"conversation_count": len(conv_list), "message_count": len(message_list)}, ensure_ascii=False))
        except Exception as exc:
            record(results, "conversation_history", False, str(exc))

    print("\nJSON_SUMMARY_START")
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print("JSON_SUMMARY_END")

    if not all(item["ok"] for item in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
