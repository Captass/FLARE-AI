"""
Router Skills — Gestion des compétences/automatisations de FLARE AI.
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import SessionLocal, Skill

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from core.database import SessionLocal, Skill

router = APIRouter(prefix="/skills", tags=["Skills"])

from core.auth import get_user_id_from_header

class SkillIn(BaseModel):
    name: str
    title: str
    description: Optional[str] = ""
    prompt_template: str
    category: str = "general"

class SkillUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("")
async def list_skills(category: Optional[str] = None, active_only: bool = False, authorization: Optional[str] = Header(None)):
    """Liste toutes les compétences de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        query = db.query(Skill).filter((Skill.user_id == user_id) | (Skill.user_id == "default"))
        if category:
            query = query.filter(Skill.category == category)
        if active_only:
            query = query.filter(Skill.is_active == "true")
        skills = query.order_by(Skill.category, Skill.title).all()
        return [_skill_to_dict(s) for s in skills]
    finally:
        db.close()

@router.post("", status_code=201)
async def create_skill(skill_in: SkillIn, authorization: Optional[str] = Header(None)):
    """Crée une nouvelle compétence pour l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    name = skill_in.name.strip().lower().replace(" ", "_")
    if not name or not skill_in.title.strip() or not skill_in.prompt_template.strip():
        raise HTTPException(status_code=400, detail="name, title et prompt_template sont requis.")

    db = SessionLocal()
    try:
        existing = db.query(Skill).filter(Skill.name == name, Skill.user_id == user_id).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Une compétence '{name}' existe déjà.")

        skill = Skill(
            user_id=user_id,
            name=name,
            title=skill_in.title.strip(),
            description=skill_in.description or "",
            prompt_template=skill_in.prompt_template.strip(),
            category=skill_in.category.strip(),
            is_active="true",
            usage_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(skill)
        db.commit()
        db.refresh(skill)
        return _skill_to_dict(skill)
    finally:
        db.close()

@router.get("/{skill_name}")
async def get_skill(skill_name: str, authorization: Optional[str] = Header(None)):
    """Récupère une compétence de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        skill = db.query(Skill).filter(Skill.name == skill_name, Skill.user_id == user_id).first()
        if not skill:
            raise HTTPException(status_code=404, detail=f"Compétence '{skill_name}' introuvable.")
        return _skill_to_dict(skill)
    finally:
        db.close()

@router.patch("/{skill_name}")
async def update_skill(skill_name: str, updates: SkillUpdate, authorization: Optional[str] = Header(None)):
    """Met à jour une compétence de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    db = SessionLocal()
    try:
        skill = db.query(Skill).filter(Skill.name == skill_name, Skill.user_id == user_id).first()
        if not skill:
            raise HTTPException(status_code=404, detail=f"Compétence '{skill_name}' introuvable.")

        if updates.title is not None:
            skill.title = updates.title.strip()
        if updates.description is not None:
            skill.description = updates.description
        if updates.prompt_template is not None:
            skill.prompt_template = updates.prompt_template.strip()
        if updates.category is not None:
            skill.category = updates.category.strip()
        if updates.is_active is not None:
            skill.is_active = "true" if updates.is_active else "false"

        skill.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(skill)
        return _skill_to_dict(skill)
    finally:
        db.close()

@router.delete("/{skill_name}", status_code=204)
async def delete_skill(skill_name: str, authorization: Optional[str] = Header(None)):
    """Supprime une compétence de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    db = SessionLocal()
    try:
        skill = db.query(Skill).filter(Skill.name == skill_name, Skill.user_id == user_id).first()
        if not skill:
            raise HTTPException(status_code=404, detail=f"Compétence '{skill_name}' introuvable.")
        db.delete(skill)
        db.commit()
    finally:
        db.close()

@router.post("/{skill_name}/use")
async def use_skill(skill_name: str, variables: dict = {}, authorization: Optional[str] = Header(None)):
    """Exécute une compétence de l'utilisateur."""
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        skill = db.query(Skill).filter(Skill.name == skill_name, Skill.user_id == user_id).first()
        if not skill:
            raise HTTPException(status_code=404, detail=f"Compétence '{skill_name}' introuvable.")
        if skill.is_active != "true":
            raise HTTPException(status_code=400, detail="Cette compétence est désactivée.")

        prompt = skill.prompt_template
        for key, val in variables.items():
            prompt = prompt.replace(f"{{{{{key}}}}}", str(val))

        skill.usage_count = (skill.usage_count or 0) + 1
        skill.updated_at = datetime.utcnow()
        db.commit()

        return {"skill": skill_name, "prompt": prompt, "usage_count": skill.usage_count}
    finally:
        db.close()


def _skill_to_dict(skill: Skill) -> dict:
    return {
        "id": skill.id,
        "name": skill.name,
        "title": skill.title,
        "description": skill.description or "",
        "prompt_template": skill.prompt_template,
        "category": skill.category,
        "is_active": skill.is_active == "true",
        "usage_count": skill.usage_count or 0,
        "created_at": skill.created_at.isoformat() if skill.created_at else None,
        "updated_at": skill.updated_at.isoformat() if skill.updated_at else None,
    }
