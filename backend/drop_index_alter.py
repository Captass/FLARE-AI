import sys
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text

db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)
try:
    with engine.connect() as conn:
        # Find index Name
        result = conn.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'knowledge_embeddings' AND indexdef LIKE '%ivfflat%';"))
        indices = [row[0] for row in result]
        print(f"Found ivfflat indices: {indices}")
        
        for idx in indices:
            print(f"Dropping index {idx}...")
            conn.execute(text(f"DROP INDEX {idx};"))
            
        print("Altering column to vector(3072)...")
        conn.execute(text("ALTER TABLE knowledge_embeddings ALTER COLUMN embedding TYPE vector(3072);"))
        conn.commit()
    print("SUCCESS")
except Exception as e:
    print(f"Error altering table: {e}")
