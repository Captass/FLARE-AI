from dotenv import load_dotenv
load_dotenv(".env.local", override=True)
from core.config import settings

print("BACKEND_URL =", settings.BACKEND_URL)
print("FRONTEND_URL =", settings.FRONTEND_URL)
print("META_APP_ID =", settings.META_APP_ID)
