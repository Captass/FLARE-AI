import sys
import os
from dotenv import load_dotenv
load_dotenv(".env.local", override=True)

from core.database import SessionLocal, FacebookPageConnection, ChatbotPreferences, ChatbotCatalogueItem

def clean_dummy():
    db = SessionLocal()
    # Remove dummy pages
    db.query(FacebookPageConnection).filter(FacebookPageConnection.page_id.in_(["123456789", "987654321"])).delete(synchronize_session=False)
    # Remove dummy prefs
    db.query(ChatbotPreferences).filter(ChatbotPreferences.page_id.in_(["123456789", "987654321"])).delete(synchronize_session=False)
    # Remove dummy catalogue
    db.query(ChatbotCatalogueItem).filter(ChatbotCatalogueItem.page_id.in_(["123456789", "987654321"])).delete(synchronize_session=False)
    db.commit()
    db.close()
    print("Donnees de simulation supprimees. Base locale prete pour de vraies connexions.")

if __name__ == "__main__":
    clean_dummy()
