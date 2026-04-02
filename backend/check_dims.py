import logging
from core.config import settings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=settings.GEMINI_API_KEY
    )
    vector = embeddings.embed_query("test")
    print(f"Dimension: {len(vector)}")
except Exception as e:
    print(f"Error: {e}")
