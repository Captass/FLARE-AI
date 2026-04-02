import sys
import os

# Append current directory to path
sys.path.append(os.getcwd())

from core.database import SessionLocal, UsageLedger, UserSubscription
from sqlalchemy import func

def check_db():
    db = SessionLocal()
    try:
        user_count = db.query(UserSubscription).count()
        ledger_count = db.query(UsageLedger).count()
        distinct_users_in_ledger = db.query(UsageLedger.user_id).distinct().count()
        
        print(f"--- DB STATUS ---")
        print(f"Total Subscriptions (Users): {user_count}")
        print(f"Total Ledger Entries: {ledger_count}")
        print(f"Distinct Users in Ledger: {distinct_users_in_ledger}")
        
        if ledger_count > 0:
            print("\n--- RECENT ENTRIES ---")
            recent = db.query(UsageLedger).order_by(UsageLedger.timestamp.desc()).limit(10).all()
            for entry in recent:
                print(f"[{entry.timestamp}] User: {entry.user_email or entry.user_id} | Model: {entry.model_name} | Action: {entry.action_kind} | Cost: ${entry.cost_usd:.4f}")
        
        # Check specific admin email
        admin_email = "cptskevin@gmail.com"
        admin_sub = db.query(UserSubscription).filter(UserSubscription.user_email == admin_email).first()
        print(f"\n--- ADMIN CHECK ({admin_email}) ---")
        if admin_sub:
            print(f"Found admin sub: ID={admin_sub.user_id}")
            # Check admin usage
            admin_usage = db.query(UsageLedger).filter(UsageLedger.user_id == admin_sub.user_id).count()
            print(f"Admin has {admin_usage} ledger entries.")
        else:
            print(f"Admin sub NOT FOUND by email.")
            
    except Exception as e:
        print(f"Error checking DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
