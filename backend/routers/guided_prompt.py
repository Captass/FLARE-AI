"""
Router Guided Prompt — Gestion du prompt système guidé en 4 étapes.
"""
import logging
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db, SystemSetting
from core.auth import get_user_id_from_header

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guided-prompt", tags=["guided-prompt"])

class GuidedPromptSettings(BaseModel):
    profil: str
    ton: str
    format: str
    details: str

@router.get("/", response_model=GuidedPromptSettings)
def get_guided_prompt(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Récupère les paramètres du prompt guidé pour l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "guided_system_prompt",
        SystemSetting.user_id == user_id,
    ).first()

    if setting and setting.value:
        try:
            data = json.loads(setting.value)
            return GuidedPromptSettings(**data)
        except (json.JSONDecodeError, TypeError):
            # Si la donnée est invalide, on retourne les valeurs par défaut
            pass
    
    # Retourne une structure vide par défaut
    return GuidedPromptSettings(profil="", ton="", format="", details="")

@router.post("/", response_model=GuidedPromptSettings)
def update_guided_prompt(
    req: GuidedPromptSettings,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Sauvegarde les paramètres du prompt guidé pour l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    setting = db.query(SystemSetting).filter(
        SystemSetting.key == "guided_system_prompt",
        SystemSetting.user_id == user_id,
    ).first()

    new_value = req.model_dump_json()

    if setting:
        setting.value = new_value
    else:
        setting = SystemSetting(key="guided_system_prompt", user_id=user_id, value=new_value)
        db.add(setting)

    db.commit()
    db.refresh(setting)
    
    logger.info(f"Prompt guidé sauvegardé pour user={user_id}")
    
    return req
