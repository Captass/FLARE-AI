import argparse
import csv
import sys
from pathlib import Path

from sqlalchemy import create_engine, text


def load_mapping(csv_path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            org_slug = (raw.get("org_slug") or "").strip().lower()
            user_id = (raw.get("user_id") or "").strip()
            user_email = (raw.get("user_email") or "").strip().lower()
            if not org_slug or not user_id:
                continue
            rows.append({"org_slug": org_slug, "user_id": user_id, "user_email": user_email})
    return rows


def update_table(conn, table: str, column: str, org_value: str, user_id: str) -> int:
    sql = text(
        f"UPDATE {table} SET user_id = :user_id "
        f"WHERE user_id IS NULL AND {column} = :org_value"
    )
    result = conn.execute(sql, {"user_id": user_id, "org_value": org_value})
    return int(result.rowcount or 0)


def update_activation_events(conn, org_slug: str, user_id: str) -> int:
    # SQLite does not support UPDATE ... FROM, so fetch ids first.
    select_sql = text(
        "SELECT id FROM activation_requests "
        "WHERE organization_slug = :org_slug AND user_id = :user_id"
    )
    rows = conn.execute(select_sql, {"org_slug": org_slug, "user_id": user_id}).fetchall()
    if not rows:
        return 0
    updated = 0
    for (activation_request_id,) in rows:
        result = conn.execute(
            text(
                "UPDATE activation_request_events "
                "SET user_id = :user_id "
                "WHERE user_id IS NULL AND activation_request_id = :activation_request_id"
            ),
            {"user_id": user_id, "activation_request_id": activation_request_id},
        )
        updated += int(result.rowcount or 0)
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill user_id from organization slug mapping CSV."
    )
    parser.add_argument("--mapping", required=True, help="CSV with org_slug,user_email,user_id")
    args = parser.parse_args()

    csv_path = Path(args.mapping)
    if not csv_path.exists():
        print(f"[error] CSV not found: {csv_path}")
        return 1

    repo_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(repo_root / "backend"))

    try:
        from core.config import settings  # type: ignore
    except Exception as exc:
        print(f"[error] Unable to load backend settings: {exc}")
        return 1

    db_url = (settings.DATABASE_URL or "sqlite:///./flare_ai_os.db").strip()
    engine = create_engine(db_url)

    mapping = load_mapping(csv_path)
    if not mapping:
        print("[error] No valid rows found in CSV.")
        return 1

    org_slug_tables = [
        ("activation_requests", "organization_slug"),
        ("manual_payment_submissions", "organization_slug"),
        ("user_reports", "organization_slug"),
        ("chatbot_preferences", "organization_slug"),
        ("chatbot_catalogue_items", "organization_slug"),
        ("chatbot_portfolio_items", "organization_slug"),
        ("chatbot_sales_config", "organization_slug"),
        ("chatbot_orders", "organization_slug"),
    ]
    org_scope_tables = [
        ("activation_requests", "organization_scope_id"),
        ("manual_payment_submissions", "organization_scope_id"),
        ("user_reports", "organization_scope_id"),
        ("chatbot_orders", "organization_scope_id"),
        ("facebook_page_connections", "organization_scope_id"),
    ]

    total_updates = 0
    with engine.begin() as conn:
        for row in mapping:
            org_slug = row["org_slug"]
            user_id = row["user_id"]
            org_scope_id = f"org:{org_slug}"
            print(f"[map] org={org_slug} -> user_id={user_id}")

            for table, column in org_slug_tables:
                updated = update_table(conn, table, column, org_slug, user_id)
                if updated:
                    print(f"  - {table}.{column}: {updated}")
                total_updates += updated

            for table, column in org_scope_tables:
                updated = update_table(conn, table, column, org_scope_id, user_id)
                if updated:
                    print(f"  - {table}.{column}: {updated}")
                total_updates += updated

            events_updated = update_activation_events(conn, org_slug, user_id)
            if events_updated:
                print(f"  - activation_request_events.user_id: {events_updated}")
            total_updates += events_updated

    print(f"[done] total rows updated: {total_updates}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
