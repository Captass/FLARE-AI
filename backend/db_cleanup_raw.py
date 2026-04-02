import sys
import os
sys.path.append('.')
from dotenv import load_dotenv

load_dotenv()

from core.database import SessionLocal
from sqlalchemy import text

session = SessionLocal()

session.execute(text("DELETE FROM system_settings WHERE key='system_prompt'"))
session.execute(text("DELETE FROM core_memory_facts WHERE key LIKE '%DESCRIPTION%'"))

session.commit()
print("Cleaned up system_settings and bad descriptive facts via raw SQL.")
session.close()
