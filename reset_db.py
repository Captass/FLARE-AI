import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath('backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.database import Base, ActivationRequest, ActivationRequestEvent, ManualPaymentSubmission, UserReport, ChatbotOrder, FacebookPageConnection, ChatbotPreferences, ChatbotCatalogueItem, ChatbotPortfolioItem, ChatbotSalesConfig, Conversation, Message, ConversationFile, ProspectingCampaign, ProspectLead, UsageLedger, CoreMemoryFact, Skill, PromptTemplate, LocalKnowledgeDoc

DB_URL = "postgresql://flare_admin:rgxtlshBG8jq5K7fYH8xIhB2vVIKc0qX@dpg-d778i4p4tr6s739fdtc0-a.oregon-postgres.render.com/flare_yjx3"

# Engine
engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def reset_db():
    db = SessionLocal()
    try:
        print("Suppression des événements d'activation...")
        db.query(ActivationRequestEvent).delete()
        print("Suppression des paiements manuels...")
        db.query(ManualPaymentSubmission).delete()
        print("Suppression des requêtes d'activation...")
        db.query(ActivationRequest).delete()
        print("Suppression des rapports d'utilisateurs...")
        db.query(UserReport).delete()
        print("Suppression des commandes chatbot...")
        db.query(ChatbotOrder).delete()
        print("Suppression des connexions Facebook...")
        db.query(FacebookPageConnection).delete()
        print("Suppression des préférences chatbot...")
        db.query(ChatbotPreferences).delete()
        print("Suppression des items catalogue...")
        db.query(ChatbotCatalogueItem).delete()
        print("Suppression des portfolios chatbot...")
        db.query(ChatbotPortfolioItem).delete()
        print("Suppression des configs de vente chatbot...")
        db.query(ChatbotSalesConfig).delete()
        print("Suppression des messages...")
        db.query(Message).delete()
        print("Suppression des fichiers de conversation...")
        db.query(ConversationFile).delete()
        print("Suppression des conversations...")
        db.query(Conversation).delete()
        print("Suppression des leads...")
        db.query(ProspectLead).delete()
        print("Suppression des campagnes de prospection...")
        db.query(ProspectingCampaign).delete()
        print("Suppression des factures d'utilisation...")
        db.query(UsageLedger).delete()
        print("Suppression des faits mémorisés...")
        db.query(CoreMemoryFact).delete()
        print("Suppression des compétences...")
        db.query(Skill).delete()
        print("Suppression des modèles de prompt...")
        db.query(PromptTemplate).delete()
        print("Suppression des documents locaux...")
        db.query(LocalKnowledgeDoc).delete()
        
        db.commit()
        print("✅ Toutes les activités ont été supprimées de la base PROD Render avec succès ! Les comptes (user_subscriptions) ont été conservés.")
    except Exception as e:
        db.rollback()
        print(f"Erreur lors de la réinitialisation: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    reset_db()
