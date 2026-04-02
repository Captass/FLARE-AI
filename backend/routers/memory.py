from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from core.memory import CoreMemory, _normalize_memory_key
from core.config import settings

router = APIRouter(prefix="/memory", tags=["Memory"])

from core.auth import get_user_id_from_header

class FactIn(BaseModel):
    key: str
    value: str
    category: str = "general"

@router.get("/facts")
async def list_facts(category: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Liste tous les faits mémorisés de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    memory = CoreMemory(user_id=user_id)
    return memory.get_all_facts(category=category)

@router.post("/facts", status_code=201)
async def create_fact(fact: FactIn, authorization: Optional[str] = Header(None)):
    """Crée ou met à jour un fait pour l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")
        
    if not fact.key.strip() or not fact.value.strip():
        raise HTTPException(status_code=400, detail="key et value sont requis.")
        
    memory = CoreMemory(user_id=user_id)
    memory.upsert_fact(fact.key.strip(), fact.value.strip(), fact.category.strip())
    
    facts = memory.get_all_facts()
    normalized_key = _normalize_memory_key(fact.key.strip())
    result = next((f for f in facts if f["key"] == normalized_key), None)
    return result or {"key": normalized_key, "value": fact.value.strip(), "category": fact.category.strip()}

@router.delete("/facts/{key}", status_code=204)
async def delete_fact(key: str, authorization: Optional[str] = Header(None)):
    """Supprime un fait par sa clé pour l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")
        
    memory = CoreMemory(user_id=user_id)
    existing = memory.get_fact(key)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Fait '{key}' introuvable.")
    memory.delete_fact(key)
