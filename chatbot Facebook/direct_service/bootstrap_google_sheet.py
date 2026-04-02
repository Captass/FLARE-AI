import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


HEADERS = {
    "contacts": [
        "psid",
        "first_name",
        "last_name",
        "display_name",
        "profile_pic",
        "preferred_language",
        "source_channel",
        "first_contact_at",
        "last_contact_at",
        "current_status",
        "current_mode",
        "assigned_to",
        "tags",
        "contact_details",
        "notes",
    ],
    "conversations": [
        "conversation_id",
        "psid",
        "opened_at",
        "last_message_at",
        "last_customer_message",
        "last_agent_reply",
        "conversation_status",
        "lead_stage",
        "priority",
        "needs_human",
        "current_mode",
        "last_telegram_reason",
        "last_telegram_notified_at",
        "owner",
        "notes",
    ],
    "messages": [
        "message_mid",
        "received_at",
        "psid",
        "direction",
        "customer_name",
        "message_text",
        "reply_text",
        "intent",
        "lead_status",
        "needs_human",
        "order_signal",
        "llm_provider",
        "llm_model",
        "prompt_tokens",
        "output_tokens",
        "total_tokens",
        "estimated_cost_usd",
        "latency_ms",
        "tags",
    ],
    "leads": [
        "lead_id",
        "psid",
        "created_at",
        "customer_name",
        "service_requested",
        "lead_stage",
        "lead_temperature",
        "budget_range",
        "location",
        "contact_details",
        "next_action",
        "next_action_due_at",
        "owner",
        "updated_at",
        "notes",
    ],
    "devis": [
        "quote_id",
        "psid",
        "created_at",
        "customer_name",
        "service_requested",
        "request_summary",
        "quote_status",
        "urgency",
        "responsible_notified_at",
        "contact_details",
        "follow_up_date",
        "amount_estimate",
        "owner",
        "updated_at",
        "notes",
    ],
    "rendez_vous": [
        "meeting_id",
        "psid",
        "created_at",
        "customer_name",
        "request_reason",
        "preferred_date",
        "preferred_time",
        "meeting_status",
        "responsible_notified_at",
        "scheduled_at",
        "contact_details",
        "owner",
        "updated_at",
        "notes",
    ],
    "kpi_journalier": [
        "day_key",
        "new_contacts",
        "active_conversations",
        "messages_received",
        "replies_sent",
        "human_escalations",
        "leads_created",
        "devis_requested",
        "rendez_vous_requested",
        "order_signals",
        "tokens_total",
        "cost_total_usd",
        "avg_latency_ms",
        "notes",
    ],
}


def main() -> int:
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "").strip()
    service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()

    if not sheet_id:
        print("GOOGLE_SHEET_ID est vide dans .env")
        return 1
    if not service_account_json:
        print("GOOGLE_SERVICE_ACCOUNT_JSON est vide dans .env")
        print("Je ne peux pas modifier le vrai Google Sheet sans credentials Google avec scopes Sheets.")
        print("En attendant, utilise le fichier sheet_template.xlsx pour importer les bons onglets.")
        return 1

    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except Exception:
        print("Dependances manquantes. Installe-les avec :")
        print("python -m pip install -r admin_requirements.txt")
        return 1

    creds = Credentials.from_service_account_info(
        json.loads(service_account_json),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    service = build("sheets", "v4", credentials=creds)

    spreadsheet = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing = {
        s["properties"]["title"]: s["properties"]["sheetId"]
        for s in spreadsheet.get("sheets", [])
    }

    requests = []
    if "contacts" not in existing and "Feuille 1" in existing:
        requests.append(
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": existing["Feuille 1"],
                        "title": "contacts",
                    },
                    "fields": "title",
                }
            }
        )
        existing["contacts"] = existing.pop("Feuille 1")

    for title in HEADERS:
        if title not in existing:
            requests.append({"addSheet": {"properties": {"title": title}}})

    if requests:
        service.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body={"requests": requests},
        ).execute()

    for title, headers in HEADERS.items():
        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=f"{title}!A1",
            valueInputOption="RAW",
            body={"values": [headers]},
        ).execute()

    print("Google Sheet prepare avec succes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
