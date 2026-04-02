import sys
import os
sys.path.append('.')
from dotenv import load_dotenv

load_dotenv()

from core.database import SessionLocal, SystemSetting, CoreMemoryFact

session = SessionLocal()

# 1. Wipe old system_prompt overrides
settings = session.query(SystemSetting).filter(SystemSetting.key == "system_prompt").all()
for s in settings:
    session.delete(s)
session.commit()
print(f"Deleted {len(settings)} system_prompt overrides.")

# 2. Cleanup bad memory fact
facts = session.query(CoreMemoryFact).filter(CoreMemoryFact.key.like("%DESCRIPTION%")).all()
for f in facts:
    session.delete(f)
session.commit()
print(f"Deleted {len(facts)} bad descriptive facts.")

session.close()
