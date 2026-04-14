import csv
import os
import sqlite3
from collections import defaultdict
from pathlib import Path


DB_DEFAULT = "flare_ai_os.db"


def resolve_db_path() -> str:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if db_url.startswith("sqlite:///"):
        return db_url.replace("sqlite:///", "", 1)
    return DB_DEFAULT


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    return cursor.fetchone() is not None


def fetch_org_slugs(conn: sqlite3.Connection, tables: list[str]) -> set[str]:
    slugs: set[str] = set()
    for table in tables:
        if not table_exists(conn, table):
            continue
        try:
            rows = conn.execute(f"SELECT DISTINCT organization_slug FROM {table}").fetchall()
        except Exception:
            continue
        for (slug,) in rows:
            if slug:
                slugs.add(str(slug).strip().lower())
    return slugs


def candidate_user_ids(conn: sqlite3.Connection, org_slug: str) -> set[str]:
    candidates: set[str] = set()

    if table_exists(conn, "activation_requests"):
        rows = conn.execute(
            "SELECT requester_user_id, user_id FROM activation_requests WHERE organization_slug=?",
            (org_slug,),
        ).fetchall()
        for requester_id, user_id in rows:
            if requester_id:
                candidates.add(str(requester_id).strip())
            if user_id:
                candidates.add(str(user_id).strip())

    if table_exists(conn, "manual_payment_submissions"):
        rows = conn.execute(
            "SELECT user_id FROM manual_payment_submissions WHERE organization_slug=?",
            (org_slug,),
        ).fetchall()
        for (user_id,) in rows:
            if user_id:
                candidates.add(str(user_id).strip())

    if table_exists(conn, "user_reports"):
        rows = conn.execute(
            "SELECT user_id FROM user_reports WHERE organization_slug=?",
            (org_slug,),
        ).fetchall()
        for (user_id,) in rows:
            if user_id:
                candidates.add(str(user_id).strip())

    return candidates


def candidate_email(conn: sqlite3.Connection, org_slug: str) -> str:
    if table_exists(conn, "activation_requests"):
        row = conn.execute(
            "SELECT contact_email FROM activation_requests WHERE organization_slug=? AND contact_email != '' ORDER BY updated_at DESC LIMIT 1",
            (org_slug,),
        ).fetchone()
        if row and row[0]:
            return str(row[0]).strip().lower()

    if table_exists(conn, "user_reports"):
        row = conn.execute(
            "SELECT reporter_email FROM user_reports WHERE organization_slug=? AND reporter_email != '' ORDER BY updated_at DESC LIMIT 1",
            (org_slug,),
        ).fetchone()
        if row and row[0]:
            return str(row[0]).strip().lower()

    if table_exists(conn, "manual_payment_submissions"):
        row = conn.execute(
            "SELECT payer_full_name FROM manual_payment_submissions WHERE organization_slug=? AND payer_full_name != '' ORDER BY updated_at DESC LIMIT 1",
            (org_slug,),
        ).fetchone()
        if row and row[0]:
            return str(row[0]).strip().lower()

    return ""


def main() -> None:
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    org_tables = [
        "activation_requests",
        "manual_payment_submissions",
        "user_reports",
        "chatbot_preferences",
        "chatbot_catalogue_items",
        "chatbot_portfolio_items",
        "chatbot_sales_config",
        "chatbot_orders",
    ]
    org_slugs = fetch_org_slugs(conn, org_tables)

    output_path = Path("scripts") / "org_user_mapping.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    conflicts = defaultdict(list)
    rows = []
    for slug in sorted(org_slugs):
        users = candidate_user_ids(conn, slug)
        email = candidate_email(conn, slug)
        user_id = ""
        if len(users) == 1:
            user_id = next(iter(users))
        elif len(users) > 1:
            conflicts[slug] = sorted(users)
        rows.append({
            "org_slug": slug,
            "user_email": email,
            "user_id": user_id,
            "candidate_user_ids": "|".join(sorted(users)),
        })

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["org_slug", "user_email", "user_id", "candidate_user_ids"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"[done] CSV created: {output_path}")
    if conflicts:
        print("[warn] Conflits user_id detectes (remplir user_id manuellement):")
        for slug, users in conflicts.items():
            print(f"  - {slug}: {', '.join(users)}")

    conn.close()


if __name__ == "__main__":
    main()
