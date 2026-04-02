"""
Router Prompts — Bibliothèque de prompts prédéfinis pour FLARE AI.
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from core.database import SessionLocal, PromptTemplate
from core.auth import get_user_id_from_header

router = APIRouter(prefix="/prompts", tags=["Prompts"])


class PromptIn(BaseModel):
    title: str
    content: str
    category: str = "general"


class PromptUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None


# Prompts par défaut (seed)
DEFAULT_PROMPTS = [
    {
        "title": "Stratégie Réseaux Sociaux",
        "content": "Propose-moi une stratégie complète pour les réseaux sociaux de mon entreprise. Inclus : objectifs SMART, choix des plateformes, calendrier éditorial sur 1 mois, types de contenu, fréquence de publication, KPIs à suivre. Mon secteur : [secteur]. Mon public cible : [cible].",
        "category": "marketing",
    },
    {
        "title": "Rédiger un Email de Prospection B2B",
        "content": "Rédige un email de prospection B2B professionnel mais chaleureux pour contacter [entreprise] dans le secteur [secteur]. Mets en avant nos services de [services]. L'email doit faire maximum 150 mots avec un objet accrocheur et un appel à l'action clair pour un rendez-vous découverte.",
        "category": "redaction",
    },
    {
        "title": "Analyse Concurrentielle",
        "content": "Fais une analyse concurrentielle complète de [mon entreprise] face à [concurrent 1], [concurrent 2] et [concurrent 3] sur le marché de [marché]. Pour chaque concurrent, analyse : positionnement, forces, faiblesses, stratégie marketing, pricing. Conclus avec nos opportunités de différenciation.",
        "category": "analyse",
    },
    {
        "title": "Brief Créatif Vidéo",
        "content": "Crée un brief créatif complet pour une vidéo promotionnelle de [produit/service]. Format : [format ex: Reel 30s / YouTube 3min]. Inclus : concept créatif, script structuré (accroche, développement, CTA), direction artistique, musique suggérée, plan de diffusion.",
        "category": "creative",
    },
    {
        "title": "Plan d'Action Hebdomadaire",
        "content": "Aide-moi à organiser ma semaine. Mes priorités cette semaine sont : [liste tes priorités]. Pour chaque priorité, propose : actions concrètes, temps estimé, jour recommandé, indicateur de réussite. Organise le tout dans un planning du lundi au vendredi.",
        "category": "productivite",
    },
    {
        "title": "Post Instagram Captivant",
        "content": "Rédige un post Instagram percutant sur [sujet]. Ton : [professionnel/fun/inspirant]. Inclus : une accroche irrésistible, le corps du message (max 100 mots), un call-to-action engageant, et 8-10 hashtags stratégiques. Public cible : [cible].",
        "category": "redaction",
    },
    {
        "title": "Proposition Commerciale",
        "content": "Génère une proposition commerciale structurée pour le client [nom du client] dans le secteur [secteur]. Le projet concerne [description du projet]. Inclus : résumé exécutif, compréhension du besoin, notre approche, livrables, planning, tarification, conditions.",
        "category": "strategie",
    },
    {
        "title": "Brainstorming Créatif",
        "content": "Lance un brainstorming créatif pour [objectif]. Génère 10 idées originales et innovantes. Pour chaque idée, propose : le concept en une phrase, pourquoi ça marche, comment le mettre en œuvre, le budget estimé (faible/moyen/élevé). Classe-les par impact potentiel.",
        "category": "creative",
    },
]


@router.get("")
async def list_prompts(
    category: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Liste tous les prompts (défauts + utilisateur)."""
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        query = db.query(PromptTemplate).filter(
            (PromptTemplate.user_id == user_id) | (PromptTemplate.user_id == "default")
        )
        if category:
            query = query.filter(PromptTemplate.category == category)
        prompts = query.order_by(PromptTemplate.category, PromptTemplate.title).all()
        return [_prompt_to_dict(p) for p in prompts]
    finally:
        db.close()


@router.post("", status_code=201)
async def create_prompt(
    prompt_in: PromptIn,
    authorization: Optional[str] = Header(None),
):
    """Crée un nouveau prompt utilisateur."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    if not prompt_in.title.strip() or not prompt_in.content.strip():
        raise HTTPException(status_code=400, detail="title et content sont requis.")

    db = SessionLocal()
    try:
        prompt = PromptTemplate(
            user_id=user_id,
            title=prompt_in.title.strip(),
            content=prompt_in.content.strip(),
            category=prompt_in.category.strip(),
            is_default=False,
            created_at=datetime.utcnow(),
        )
        db.add(prompt)
        db.commit()
        db.refresh(prompt)
        return _prompt_to_dict(prompt)
    finally:
        db.close()


@router.delete("/{prompt_id}", status_code=204)
async def delete_prompt(
    prompt_id: int,
    authorization: Optional[str] = Header(None),
):
    """Supprime un prompt utilisateur (pas les défauts)."""
    user_id = get_user_id_from_header(authorization)
    if user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentification requise.")

    db = SessionLocal()
    try:
        prompt = db.query(PromptTemplate).filter(
            PromptTemplate.id == prompt_id,
            PromptTemplate.user_id == user_id,
        ).first()
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt introuvable.")
        if prompt.is_default:
            raise HTTPException(status_code=403, detail="Impossible de supprimer un prompt par défaut.")
        db.delete(prompt)
        db.commit()
    finally:
        db.close()

def seed_default_prompts():
    """Crée les prompts par défaut si vides."""
    db = SessionLocal()
    try:
        existing = db.query(PromptTemplate).filter(PromptTemplate.user_id == "default").count()
        if existing > 0:
            return
        for p in DEFAULT_PROMPTS:
            db.add(PromptTemplate(
                user_id="default",
                title=p["title"],
                content=p["content"],
                category=p["category"],
                is_default="true",
                created_at=datetime.utcnow(),
            ))
        db.commit()
    finally:
        db.close()

def _prompt_to_dict(p: PromptTemplate) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "content": p.content,
        "category": p.category,
        "is_default": p.is_default == True or p.is_default == "true" or p.is_default is True,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
