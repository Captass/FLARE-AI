import sys
import os

from sqlalchemy import text
from core.database import engine, init_db

def run_migration():
    print("Initializing DB to create new tables if any...")
    init_db()

    with engine.connect() as conn:
        try:
            print("Adding 'summary' column to conversations table...")
            conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT;"))
            
            # Commit the transaction
            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Error during migration: {e}")
            conn.rollback()

if __name__ == "__main__":
    run_migration()
