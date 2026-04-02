import sys
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(".env.local", override=True)

from sqlalchemy import text
from core.database import SessionLocal, FacebookPageConnection, ChatbotPreferences, ChatbotCatalogueItem, Base, engine

# Force recreate tables if needed for dev mock
with engine.connect() as con:
    con.execute(text("DROP TABLE IF EXISTS chatbot_preferences;"))
    con.commit()

Base.metadata.create_all(bind=engine)

def add_dummy_data():
    db = SessionLocal()
    org_slug = "rams-flare"
    
    # 1. Page Active
    p1 = db.query(FacebookPageConnection).filter_by(page_id="123456789").first()
    if not p1:
        p1 = FacebookPageConnection(
            organization_slug=org_slug,
            organization_scope_id=f"org:{org_slug}",
            page_id="123456789",
            page_name="Page Principal (Simulation)",
            page_picture_url="https://i.pravatar.cc/300?u=123",
            user_access_token_encrypted="dummy_token_1",
            page_access_token_encrypted="dummy_page_token_1",
            status="active",
            is_active="true",
            webhook_subscribed="true",
            direct_service_synced="true",
            connected_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(p1)

    # 2. Page Pending
    p2 = db.query(FacebookPageConnection).filter_by(page_id="987654321").first()
    if not p2:
        p2 = FacebookPageConnection(
            organization_slug=org_slug,
            organization_scope_id=f"org:{org_slug}",
            page_id="987654321",
            page_name="Support Secondaire (Config)",
            page_picture_url="https://i.pravatar.cc/300?u=987",
            user_access_token_encrypted="dummy_token_2",
            page_access_token_encrypted="dummy_page_token_2",
            status="pending",
            is_active="false",
            webhook_subscribed="false",
            direct_service_synced="false",
            connected_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(p2)
        
    # 3. Add some preferences for p1 to make it look "ready"
    pref1 = db.query(ChatbotPreferences).filter_by(page_id="123456789").first()
    if not pref1:
        pref1 = ChatbotPreferences(
            organization_slug=org_slug,
            page_id="123456789",
            bot_name="Assistant IA FLARE",
            primary_role="mixte",
            tone="professionnel",
            language="fr",
            business_name="Simulation Enterprise",
            company_description="Ceci est une description injectee en local pour pouvoir tester l'UI Multi-Page.",
            greeting_message="Bienvenue sur notre page de test local !",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(pref1)
        
    # 4. Catalogue item for P1
    cat1 = db.query(ChatbotCatalogueItem).filter_by(page_id="123456789").first()
    if not cat1:
        cat1 = ChatbotCatalogueItem(
            organization_slug=org_slug,
            page_id="123456789",
            name="Produit de Test",
            price="Gratuit",
            description="Ce catalogue appartient a la Page Principal.",
            is_active="true",
            created_at=datetime.utcnow()
        )
        db.add(cat1)

    db.commit()
    db.close()
    print("Donnees de simulation ajoutees avec succes ! Tu peux maintenant rafraichir le frontend.")

if __name__ == "__main__":
    add_dummy_data()
