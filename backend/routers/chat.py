"""
Router Chat â€” Conversations avec l'Orchestrateur FLARE AI.
"""
import uuid
import base64
import os
import tempfile
import logging
import asyncio
from datetime import datetime
from typing import Optional

import json
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


async def _stream_with_keepalive(gen, interval: float = 12):
    """
    ItÃ¨re un async generator en envoyant des keepalives (None) toutes les
    `interval` secondes si aucun Ã©vÃ©nement n'arrive. SANS annuler le travail.

    CRITIQUE: asyncio.wait_for() annule les coroutines au timeout, ce qui
    tue les opÃ©rations longues (video 60-240s, deep research, web search).
    Cette approche utilise asyncio.wait() qui N'annule PAS les tasks.
    """
    aiter = gen.__aiter__()
    while True:
        next_task = asyncio.ensure_future(aiter.__anext__())
        try:
            # Boucle de keepalive : tant que la task n'est pas finie, envoyer des keepalives
            while not next_task.done():
                done, _ = await asyncio.wait({next_task}, timeout=interval)
                if done:
                    break
                # Task pas encore finie â†’ envoyer keepalive
                yield None
            # Task terminÃ©e â€” rÃ©cupÃ©rer le rÃ©sultat
            result = next_task.result()
            yield result
        except StopAsyncIteration:
            return
        except asyncio.CancelledError:
            next_task.cancel()
            return


from core.database import SessionLocal, Conversation, Message
from core.config import settings

# Architecture Supervisor-Worker : le Supervisor remplace l'orchestrateur monolithique
# Fallback sur l'ancien orchestrateur si le Supervisor Ã©choue Ã  l'import
try:
    from agents.supervisor import get_supervisor as _get_agent
    _USE_SUPERVISOR = True
    logger.info("[chat.py] Architecture Supervisor-Worker activÃ©e")
except ImportError as e:
    from core.orchestrator import get_orchestrator as _get_agent
    _USE_SUPERVISOR = False
    logger.warning(f"[chat.py] Fallback orchestrateur monolithique: {e}")

# â”€â”€ Document de seed â€” Techniques Marketing & Audiovisuel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_SEED_KNOWLEDGE_TITLE = "Techniques Fondamentales â€” Marketing, Communication & Audiovisuel"

_SEED_KNOWLEDGE_CONTENT = """# Techniques Fondamentales â€” Marketing, Communication & Audiovisuel
## Base de rÃ©fÃ©rence RAM'S FLARE

---

## 1. MARKETING DIGITAL

### StratÃ©gie de Contenu
- **RÃ¨gle des 80/20** : 80% contenu de valeur (Ã©ducatif, inspirant, divertissant), 20% promotionnel
- **Pilier de contenu** : dÃ©finir 3 Ã  5 thÃ¨mes piliers alignÃ©s avec l'expertise de la marque
- **Calendrier Ã©ditorial** : planifier au minimum 2 semaines en avance
- **Repurposing** : transformer 1 contenu long (vidÃ©o YouTube) en 5 formats courts (Reels, stories, posts, tweets, email)

### Social Media (Meta / Instagram)
- **FrÃ©quence optimale** : 1 Reel/jour ou 1 post/jour + 5 stories/jour
- **Hook visuel** : les 3 premiÃ¨res secondes sont dÃ©cisives â€” commencer en mouvement ou avec une question
- **Call-to-Action (CTA)** : toujours terminer avec une action claire (commenter, partager, lien en bio)
- **Engagement bait** : poser des questions, sondages, quiz en stories
- **Hashtags** : 5 Ã  10 hashtags ciblÃ©s (mÃ©lange niche + populaires), pas de spam
- **Heure de publication** : analyser les Insights pour identifier les crÃ©neaux oÃ¹ l'audience est active

### Meta Ads
- **Structure de campagne** : 1 campagne â†’ 3 ensembles de publicitÃ©s (audiences diffÃ©rentes) â†’ 2 Ã  3 visuels
- **Test A/B systÃ©matique** : tester 1 variable Ã  la fois (visuel, texte, audience, CTA)
- **Audiences** : Lookalike 1% (la plus efficace), intÃ©rÃªts prÃ©cis, retargeting (visiteurs site, engagÃ©s page)
- **Budget recommandÃ©** : minimum 10â‚¬/jour par ensemble pour obtenir des donnÃ©es significatives
- **KPIs Ã  surveiller** : CPM, CTR (>2% = bon), CPC, ROAS, frÃ©quence (<3 = ok)
- **Fatigue publicitaire** : renouveler les crÃ©atifs toutes les 2 Ã  4 semaines

### Email Marketing
- **Objet d'email** : 40 caractÃ¨res max, chiffre ou question si possible, curiositÃ© sans clickbait
- **Taux d'ouverture cible** : >25% en B2C, >20% en B2B
- **Structure AIDA** : Attention â†’ IntÃ©rÃªt â†’ DÃ©sir â†’ Action
- **Segmentation** : envoyer le bon message Ã  la bonne cible, pas en masse
- **Heure d'envoi** : mardi-jeudi, 9h-11h ou 14h-16h

### SEO / RÃ©fÃ©rencement
- **Longue traÃ®ne** : cibler des mots-clÃ©s spÃ©cifiques plutÃ´t que gÃ©nÃ©riques
- **Intention de recherche** : informationnelle, navigationnelle, transactionnelle â€” adapter le contenu
- **Contenu E-E-A-T** : Experience, Expertise, Authoritativeness, Trustworthiness

---

## 2. COMMUNICATION & BRANDING

### Storytelling
- **Structure narrative** : Situation â†’ ProblÃ¨me â†’ Solution â†’ RÃ©sultat
- **HÃ©ros du rÃ©cit** : le client est le hÃ©ros, la marque est le guide (cadre StoryBrand)
- **Ã‰motion en premier** : toucher les Ã©motions avant d'adresser la raison
- **AuthenticitÃ©** : partager les coulisses, les erreurs, le processus â€” Ã§a humanise

### Copywriting
- **PAS** : ProblÃ¨me â†’ Agitation â†’ Solution
- **BÃ©nÃ©fices vs fonctionnalitÃ©s** : parler de ce que Ã§a apporte, pas de ce que c'est
- **Preuve sociale** : tÃ©moignages, chiffres, Ã©tudes de cas â€” toujours avec des donnÃ©es concrÃ¨tes
- **Urgence lÃ©gitime** : dÃ©lai rÃ©el, stock limitÃ©, offre exclusive â€” ne jamais mentir

### IdentitÃ© de Marque
- **Charte graphique** : palette de 3 couleurs max, 2 polices (titre + texte), logo dans 3 formats
- **Ton de voix** : dÃ©finir 3 Ã  5 adjectifs qui dÃ©crivent la faÃ§on de s'exprimer
- **Positionnement** : 1 phrase claire qui exprime pour qui, quoi et pourquoi diffÃ©rent
- **CohÃ©rence** : mÃªme ton, mÃªmes couleurs, mÃªme message sur TOUS les canaux

### Community Management
- **RÃ©ponse rapide** : rÃ©pondre aux commentaires et messages dans les 2h (max 24h)
- **Personnalisation** : utiliser le prÃ©nom, rÃ©pondre au fond du message, Ã©viter les copier-coller
- **Gestion de crise** : jamais supprimer les commentaires nÃ©gatifs, rÃ©pondre publiquement puis passer en DM
- **Animation** : crÃ©er des rituels (rendez-vous rÃ©guliers), challenges, UGC (User Generated Content)

---

## 3. PRODUCTION AUDIOVISUELLE

### VidÃ©o â€” Cadrage & Composition
- **RÃ¨gle des tiers** : placer le sujet Ã  l'intersection des lignes de tiers
- **Ligne d'horizon** : garder l'horizon droit sauf effet crÃ©atif intentionnel
- **Profondeur de champ** : ouverture large (f/1.8-2.8) pour bokeh, ouverture petite (f/8-11) pour tout net
- **Formats recommandÃ©s** : 9:16 (Reels/TikTok/Stories), 1:1 (feed carrÃ©), 16:9 (YouTube)
- **RÃ©solution minimum** : 1080p pour les rÃ©seaux sociaux, 4K pour les productions pro

### LumiÃ¨re
- **Triangle lumineux** : lumiÃ¨re principale (key light) + lumiÃ¨re de remplissage (fill light) + contre-jour (back light)
- **Heure dorÃ©e** : 30 min aprÃ¨s lever / avant coucher de soleil â€” lumiÃ¨re chaude et douce naturellement
- **Ã‰viter le contre-jour direct** : ne jamais filmer dos Ã  une fenÃªtre sans compensation
- **TempÃ©rature de couleur** : cohÃ©rence entre les plans (mÃªme balance des blancs)

### Son
- **RÃ¨gle d'or** : la qualitÃ© audio prime sur la qualitÃ© image â€” un son mauvais est rÃ©dhibitoire
- **Micro-cravate** : idÃ©al pour les interviews et prises de parole
- **Distance micro** : 30 Ã  50 cm max du sujet
- **Environnement** : Ã©viter les espaces rÃ©verbÃ©rants, enregistrer avec des surfaces absorbantes autour

### Montage
- **Rythme** : couper sur le mouvement ou sur le beat musical
- **J-cut et L-cut** : son qui commence avant / aprÃ¨s le plan â€” fluidifie les transitions
- **Jump cut assumÃ©** : surtout sur YouTube et TikTok â€” maintient l'Ã©nergie
- **Ã‰talonnage** : cohÃ©rence chromatique entre tous les plans, LUT personnalisÃ©e pour une identitÃ© visuelle

### Motion Design
- **Animation 12 principes** : squash & stretch, anticipation, follow through, etc.
- **DurÃ©e des textes** : 1 seconde par 3 mots pour une lecture confortable
- **HiÃ©rarchie visuelle** : taille + couleur + mouvement pour guider l'Å“il
- **Export** : ProRes 4444 pour master, H.264/H.265 pour livraison web

---

## 4. STRATÃ‰GIE & INDICATEURS

### Mesure de Performance
- **Reach vs Engagement** : le reach sans engagement ne sert Ã  rien â€” prioriser l'engagement
- **Taux d'engagement cible** : Instagram >3%, Facebook >1%, LinkedIn >2%
- **ROI publicitÃ©** : ROAS minimum 3x pour Ãªtre rentable en e-commerce
- **Rapport mensuel** : analyser les 5 meilleures et 5 pires performances pour ajuster

### Prospection B2B
- **ICP (Ideal Customer Profile)** : dÃ©finir prÃ©cisÃ©ment le profil client idÃ©al (taille, secteur, problÃ¨me)
- **Approche multicanal** : LinkedIn + Email + Phone + Event
- **Message de prospection** : court (5 lignes max), personnalisÃ©, orientÃ© bÃ©nÃ©fice client, avec CTA clair
- **Relance** : 5 Ã  7 points de contact avant d'abandonner un lead (espacÃ©s de 3 Ã  5 jours)

---

*Document de rÃ©fÃ©rence â€” Ã  enrichir au fil des expÃ©riences et des nouvelles techniques dÃ©couvertes.*
"""

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    file_content: Optional[str] = None
    file_type: Optional[str] = None
    file_name: Optional[str] = None
    deep_research: bool = False
    quality: Optional[str] = "HD"
    chat_mode: Optional[str] = "raisonnement"


class ChatResponse(BaseModel):
    response: str
    session_id: str
    images: Optional[list[dict]] = None
    knowledge_saved: Optional[list[str]] = None
    suggestions: Optional[list[str]] = None

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    folder_id: Optional[str] = None

from core.auth import get_user_id_from_header, get_user_email_from_header, get_user_identity
from core.database import SessionLocal, Conversation, CoreMemoryFact
from core.config import settings
from core.firebase_client import knowledge_manager as kb, firebase_storage as storage

async def _transcribe_audio(
    audio_b64: str,
    file_type: str = "audio/webm",
    file_name: str = "audio.webm",
) -> Optional[str]:
    """
    Transcrit un fichier audio en texte.
    PrioritÃ© : Gemini (dÃ©jÃ  configurÃ©) â†’ Groq Whisper (gratuit) â†’ OpenAI Whisper (payant) â†’ None.
    """
    audio_bytes = base64.b64decode(audio_b64)
    mime = file_type.split(";")[0]

    # Vertex AI (prioritaire en production â€” pas besoin de GEMINI_API_KEY)
    if settings.LLM_PROVIDER == "vertexai":
        try:
            from google import genai
            from google.genai import types as gtypes
            client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_REGION,
            )
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=settings.GEMINI_AUDIO_MODEL,
                contents=[
                    gtypes.Part.from_text(
                        "Transcris exactement ce message vocal en franÃ§ais. "
                        "Retourne uniquement la transcription, sans explication ni commentaire."
                    ),
                    gtypes.Part.from_bytes(data=audio_bytes, mime_type=mime),
                ],
            )
            text = (response.text or "").strip()
            if text:
                logger.info(f"Audio transcrit via Vertex AI ({len(text)} chars)")
                return text

        except Exception as e:
            logger.warning(f"Transcription Vertex AI Ã©chouÃ©e : {e}")

    if settings.GEMINI_API_KEY:
        try:
            import httpx
            # Use the main model for audio transcription (flash supports audio inline)
            audio_model = settings.GEMINI_AUDIO_MODEL
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{audio_model}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            payload = {
                "contents": [{
                    "parts": [
                        {
                            "text": (
                                "Transcris exactement ce message vocal en franÃ§ais. "
                                "Retourne uniquement la transcription, sans explication ni commentaire."
                            )
                        },
                        {"inlineData": {"mimeType": mime, "data": audio_b64}},
                    ]
                }]
            }
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, timeout=30.0)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    logger.info(f"Audio transcrit via Gemini ({len(text)} chars)")
                    return text
        except Exception as e:
            logger.warning(f"Transcription Gemini Ã©chouÃ©e : {e}")

    if settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            transcription = await client.audio.transcriptions.create(
                file=(file_name, audio_bytes, mime),
                model="whisper-large-v3-turbo",
                language="fr",
                response_format="text",
            )
            text = transcription if isinstance(transcription, str) else transcription.text
            logger.info(f"Audio transcrit via Groq ({len(text)} chars)")
            return text
        except Exception as e:
            logger.warning(f"Transcription Groq Ã©chouÃ©e : {e}")

    if settings.OPENAI_API_KEY:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            ext_map = {
                "audio/webm": ".webm", "audio/ogg": ".ogg",
                "audio/mp4": ".mp4", "audio/wav": ".wav", "audio/mpeg": ".mp3",
            }
            ext = ext_map.get(mime, ".webm")
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name
            try:
                with open(tmp_path, "rb") as f:
                    transcript = await client.audio.transcriptions.create(
                        model="whisper-1", file=f, language="fr",
                    )
                logger.info(f"Audio transcrit via OpenAI ({len(transcript.text)} chars)")
                return transcript.text
            finally:
                os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Transcription OpenAI Ã©chouÃ©e : {e}")

    return None

class ConversationOut(BaseModel):
    id: str
    title: str
    platform: str
    status: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


def _select_model_override(chat_mode: Optional[str]) -> Optional[str]:
    """
    SÃ©lectionne explicitement le modÃ¨le Gemini selon le mode UX.
    - rapide => flash
    - raisonnement (dÃ©faut) => pro
    """
    provider = (settings.LLM_PROVIDER or "").lower()
    if provider not in {"gemini", "vertexai"}:
        return None
    if (chat_mode or "").lower() == "rapide":
        return settings.GEMINI_MODEL
    return settings.GEMINI_PRO_MODEL


def _build_message_attachment_payload(media: dict) -> dict:
    media_type = str(media.get("type") or "")
    is_video = media_type.startswith("video/")
    is_doc = "wordprocessingml" in media_type or media_type.endswith("/document")
    is_sheet = "spreadsheetml" in media_type or "excel" in media_type
    media_kind = "sheet" if is_sheet else ("document" if is_doc else ("video" if is_video else "image"))
    media_name = media.get(
        "name",
        "gen.xlsx" if is_sheet else ("gen.docx" if is_doc else ("video-generee.mp4" if is_video else "image-generee.jpg")),
    )

    attachment = {
        "kind": media_kind,
        "name": media_name,
        "type": media_type,
        "url": media.get("url"),
        "ephemeral": bool(media.get("ephemeral")),
    }
    if media.get("data") and not media.get("url"):
        attachment["data"] = media["data"]
    return attachment

def _seed_user_knowledge_if_empty(user_id: str) -> None:
    """
    Si l'utilisateur n'a aucun document dans sa base de connaissances,
    on lui ajoute automatiquement le document de rÃ©fÃ©rence RAM'S FLARE.
    Utilise KnowledgeManager pour la vectorisation (Cloud SQL).
    """
    try:
        
        # On vÃ©rifie si l'utilisateur a dÃ©jÃ  des documents
        docs = kb.get_user_knowledge(user_id)
        if docs:
            return
            
        # Ajout du document de rÃ©fÃ©rence
        kb.add_knowledge(
            user_id=user_id,
            title=_SEED_KNOWLEDGE_TITLE,
            content=_SEED_KNOWLEDGE_CONTENT,
            source="seed_system",
            doc_type="reference",
        )
        logger.info(f"âœ… Document de rÃ©fÃ©rence seedÃ© (vectorisÃ©) pour l'utilisateur {user_id[:8]}...")
    except Exception as e:
        logger.warning(f"Seed knowledge ignorÃ© : {e}")


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    """ Flux SSE pour recevoir les Ã©tapes de pensÃ©e et la rÃ©ponse finale. """
    if not request.message.strip() and not request.file_content:
        raise HTTPException(status_code=400, detail="Le message ne peut pas Ãªtre vide.")

    session_id = request.session_id or str(uuid.uuid4())
    user_id, user_email = get_user_identity(authorization)

    # Quota vÃ©rifiÃ© dans supervisor.py (check_quota) â€” pas de double vÃ©rification ici
    orchestrator = _get_agent()
    background_tasks.add_task(_seed_user_knowledge_if_empty, user_id)

    model_override = _select_model_override(request.chat_mode)

    user_message = request.message.strip()
    file_content = request.file_content
    file_type = request.file_type
    file_name = request.file_name

    # Audio transcription (Whisper) - logic shared with classic chat
    if file_type and file_type.startswith("audio/") and file_content:
        transcription = await _transcribe_audio(file_content, file_type, file_name or "audio.webm")
        if transcription:
            user_message = f"{user_message}\n\n[Message vocal] : {transcription}" if user_message else transcription
        file_content, file_type, file_name = None, None, None

    # â”€â”€ Stockage Firebase (Persistence par conversation) â”€â”€
    if file_content and file_name and user_id != "anonymous":
        try:
            # On dÃ©code le base64 pour l'upload
            file_bytes = base64.b64decode(file_content)
            storage_path = f"users/{user_id}/conversations/{session_id}/{file_name}"
            storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path,
                file_bytes=file_bytes,
                content_type=file_type or "application/octet-stream"
            )
            logger.info(f"ðŸ’¾ [Stream] Fichier sauvegardÃ© sur Firebase Storage: {storage_path}")

            # Enregistrement dans la "Base de donnÃ©es fichiers" de la conversation (SQL)
            try:
                from core.memory import SessionMemory
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=file_name,
                    file_url=f"https://storage.googleapis.com/{settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/{storage_path}",
                    file_type="document" if "image" not in (file_type or "") else "image",
                    mime_type=file_type,
                    file_size=len(file_bytes)
                )
            except Exception as sql_err:
                logger.error(f"âš ï¸ Erreur enregistrement SQL upload: {sql_err}")
        except Exception as e:
            logger.warning(f"Ã‰chec sauvegarde storage stream : {e}")

    async def event_generator():
        try:
            gen = orchestrator.chat_stream(
                user_message=user_message,
                session_id=session_id,
                file_content=file_content,
                file_type=file_type,
                file_name=file_name,
                user_id=user_id,
                deep_research=request.deep_research,
                model_override=model_override,
                quality=request.quality or "HD",
            )

            # CRITICAL FIX: asyncio.wait_for() CANCELLE le coroutine sous-jacent
            # aprÃ¨s le timeout â€” ce qui tue les opÃ©rations longues (web search,
            # video generation 60-240s, deep research). On utilise asyncio.shield()
            # + une Task indÃ©pendante pour envoyer des keepalives SANS annuler le travail.
            KEEPALIVE_INTERVAL = 12  # secondes entre keepalives

            async for event in _stream_with_keepalive(gen, KEEPALIVE_INTERVAL):
                if event is None:
                    # Keepalive
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                    continue

                yield f"data: {json.dumps(event)}\n\n"

                # â”€â”€ Persistance des mÃ©dias sur le message assistant en DB â”€â”€
                if isinstance(event, dict) and event.get("type") == "final":
                    images = event.get("images", [])
                    if images:
                        media = images[0]
                        is_ephemeral = media.get("ephemeral", False)
                        is_video = media.get("type", "").startswith("video/")
                        is_doc = "wordprocessingml" in media.get("type", "") or media.get("type", "").endswith("/document")
                        is_sheet = "spreadsheetml" in media.get("type", "") or "excel" in media.get("type", "")
                        media_kind = "sheet" if is_sheet else ("document" if is_doc else ("video" if is_video else "image"))
                        media_name = media.get("name", "gen.xlsx" if is_sheet else ("gen.docx" if is_doc else ("video-generee.mp4" if is_video else "image-generee.jpg")))
                        if not is_ephemeral:
                            try:
                                _db = SessionLocal()
                                last_msg = _db.query(Message).filter(
                                    Message.conversation_id == session_id,
                                    Message.role == "assistant"
                                ).order_by(Message.id.desc()).first()
                                if last_msg:
                                    last_msg.attachment_json = {
                                        "kind": media_kind,
                                        "name": media_name,
                                        "type": media["type"],
                                        "url": media.get("url"),
                                    }
                                    if media_kind in {"document", "sheet"} and media.get("data") and not media.get("url"):
                                        last_msg.attachment_json["data"] = media["data"]
                                    _db.commit()
                                    logger.info(f"ðŸ’¾ [Stream] Attachment persistÃ© sur msg {last_msg.id} ({media_kind})")
                                _db.close()
                            except Exception as _e:
                                logger.warning(f"Ã‰chec persistance media stream: {_e}")
                        else:
                            logger.info(f"ðŸ“¹ [Stream] VidÃ©o Ã©phÃ©mÃ¨re â€” pas de persistance DB")


                            
                        # Normalisation finale : on persiste aussi les medias inline/ephemeres.
                        try:
                            _db_inline = SessionLocal()
                            last_msg_inline = _db_inline.query(Message).filter(
                                Message.conversation_id == session_id,
                                Message.role == "assistant",
                            ).order_by(Message.id.desc()).first()
                            if last_msg_inline:
                                payload = _build_message_attachment_payload(media)
                                if last_msg_inline.attachment_json != payload:
                                    last_msg_inline.attachment_json = payload
                                    _db_inline.commit()
                                    logger.info(f"[Stream] Attachment normalise sur msg {last_msg_inline.id}")
                            _db_inline.close()
                        except Exception as _inline_err:
                            logger.warning(f"Echec normalisation media stream: {_inline_err}")
        except Exception as e:
            logger.error(f"Erreur streaming SSE : {e}", exc_info=True)
            error_str = str(e)
            if "KeyError" in error_str or "format" in error_str:
                user_msg = "Erreur de configuration du prompt systÃ¨me. Contactez l'administrateur."
            elif "API key" in error_str.lower() or "quota" in error_str.lower() or "429" in error_str:
                user_msg = "Quota API dÃ©passÃ© ou clÃ© API invalide. RÃ©essayez dans quelques minutes."
            elif "timeout" in error_str.lower() or "timed out" in error_str.lower():
                user_msg = "Le modÃ¨le IA a mis trop de temps Ã  rÃ©pondre. RÃ©essayez avec un message plus court."
            elif "NOT_FOUND" in error_str or "no longer available" in error_str.lower():
                user_msg = "Le service IA est temporairement indisponible. RÃ©essayez dans quelques instants."
            else:
                user_msg = "Une erreur inattendue s'est produite. RÃ©essayez dans quelques instants."
            yield f"data: {json.dumps({'type': 'error', 'content': user_msg})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    """
    Envoie un message Ã  l'Orchestrateur FLARE AI.
    Supporte : texte, images, fichiers, messages vocaux (transcription Whisper).
    Header : Authorization: Bearer <firebase_id_token>
    """
    if not request.message.strip() and not request.file_content:
        raise HTTPException(status_code=400, detail="Le message ne peut pas Ãªtre vide.")

    session_id = request.session_id or str(uuid.uuid4())
    user_id, user_email = get_user_identity(authorization)

    # Quota vÃ©rifiÃ© dans supervisor.py (check_quota)
    orchestrator = _get_agent()
    background_tasks.add_task(_seed_user_knowledge_if_empty, user_id)
    model_override = _select_model_override(request.chat_mode)

    # â”€â”€ PrÃ©parer message et piÃ¨ce jointe â”€â”€
    user_message = request.message.strip()
    file_content = request.file_content
    file_type = request.file_type
    file_name = request.file_name

    # â”€â”€ Transcription audio (Whisper) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if file_type and file_type.startswith("audio/") and file_content:
        transcription = await _transcribe_audio(file_content, file_type, file_name or "audio.webm")
        if transcription:
            user_message = (
                f"{user_message}\n\n[Message vocal] : {transcription}"
                if user_message else transcription
            )
        else:
            if not user_message:
                user_message = (
                    "L'utilisateur a envoyÃ© un message vocal mais la transcription automatique a Ã©chouÃ©. "
                    "Informe-le poliment que tu n'as pas pu traiter son message vocal et invite-le Ã  rÃ©pÃ©ter par Ã©crit."
                )
        file_content = None
        file_type = None
        file_name = None

    # â”€â”€ Stockage Firebase â”€â”€
    if file_content and file_name and user_id != "anonymous":
        try:
            # On dÃ©code le base64 pour l'upload
            file_bytes = base64.b64decode(file_content)
            storage_path = f"users/{user_id}/conversations/{session_id}/{file_name}"
            storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path,
                file_bytes=file_bytes,
                content_type=file_type or "application/octet-stream"
            )
            logger.info(f"ðŸ’¾ [Chat] Fichier sauvegardÃ© sur Firebase Storage: {storage_path}")
        except Exception as e:
            logger.warning(f"Ã‰chec sauvegarde storage chat : {e}")

    try:
        response_data = await orchestrator.chat(
            user_message=user_message,
            session_id=session_id,
            file_content=file_content,
            file_type=file_type,
            file_name=file_name,
            user_id=user_id,
            deep_research=request.deep_research,
            model_override=model_override,
            quality=request.quality or "HD",
        )
    except Exception as e:
        logger.error(f"Erreur orchestrateur : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"RÃ‰PONSE FINALE ROUTER - Images: {len(response_data.get('images', []))}")

    # Persister l'attachment media (image ou vidÃ©o) sur le message assistant
    if response_data.get("images"):
        media = response_data["images"][0]
        is_video = media.get("type", "").startswith("video/")
        is_doc = "wordprocessingml" in media.get("type", "") or media.get("type", "").endswith("/document")
        is_sheet = "spreadsheetml" in media.get("type", "") or "excel" in media.get("type", "")
        media_kind = "sheet" if is_sheet else ("document" if is_doc else ("video" if is_video else "image"))
        media_name = media.get("name", "gen.xlsx" if is_sheet else ("gen.docx" if is_doc else ("video-generee.mp4" if is_video else "image-generee.jpg")))
        try:
            _db = SessionLocal()
            last_msg = _db.query(Message).filter(
                Message.conversation_id == session_id,
                Message.role == "assistant"
            ).order_by(Message.id.desc()).first()
            if last_msg:
                last_msg.attachment_json = {
                    "kind": media_kind,
                    "name": media_name,
                    "type": media["type"],
                    "url": media.get("url"),
                }
                if media_kind in {"document", "sheet"} and media.get("data") and not media.get("url"):
                    last_msg.attachment_json["data"] = media["data"]
                _db.commit()
            _db.close()
        except Exception as _e:
            logger.warning(f"Ã‰chec sauvegarde media en DB: {_e}")

    if response_data.get("images"):
        media = response_data["images"][0]
        try:
            _db_inline = SessionLocal()
            last_msg_inline = _db_inline.query(Message).filter(
                Message.conversation_id == session_id,
                Message.role == "assistant"
            ).order_by(Message.id.desc()).first()
            if last_msg_inline:
                payload = _build_message_attachment_payload(media)
                if last_msg_inline.attachment_json != payload:
                    last_msg_inline.attachment_json = payload
                    _db_inline.commit()
                    logger.info(f"Ã°Å¸â€™Â¾ [Chat] Attachment normalisÃƒÂ© sur msg {last_msg_inline.id}")
            _db_inline.close()
        except Exception as _inline_err:
            logger.warning(f"Ãƒâ€°chec normalisation media chat: {_inline_err}")

    return ChatResponse(
        response=response_data["response"],
        session_id=session_id,
        images=response_data.get("images", []),
        knowledge_saved=response_data.get("knowledge_saved", []) or None,
        suggestions=response_data.get("suggestions", []) or None,
    )


@router.get("/conversations")
async def list_conversations(authorization: Optional[str] = Header(None), limit: int = 50):
    from sqlalchemy import func
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        # Single query with LEFT JOIN â€” eliminates N+1 problem (50x faster)
        results = (
            db.query(
                Conversation,
                func.count(Message.id).label("msg_count")
            )
            .outerjoin(Message, Message.conversation_id == Conversation.id)
            .filter(Conversation.user_id == user_id)
            .filter(Conversation.status != "deleted")
            .group_by(Conversation.id)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": conv.id, "title": conv.title, "platform": conv.platform,
                "status": conv.status,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
                "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                "message_count": msg_count,
                "folder_id": conv.folder_id,
            }
            for conv, msg_count in results
        ]
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        # On vÃ©rifie que la conversation appartient bien Ã  l'utilisateur
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        ).first()
        if not conv:
            return []
        
        messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.timestamp.asc()).all()
        return [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "attachment": msg.attachment_json,
                "responseTime": msg.response_time,
            }
            for msg in messages
        ]
    finally:
        db.close()


@router.delete("/conversations/{conversation_id}/messages/after/{timestamp}")
async def delete_messages_after(conversation_id: str, timestamp: str, authorization: Optional[str] = Header(None)):
    """Supprime les messages d'une conversation postÃ©rieurs Ã  une certaine date (pour l'Ã©dition)."""
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        # SÃ©curitÃ© : vÃ©rifier que la conversation appartient Ã  l'utilisateur
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        ).first()
        if not conv:
            raise HTTPException(status_code=403, detail="AccÃ¨s refusÃ©.")

        from datetime import datetime
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        deleted = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.timestamp > dt.replace(tzinfo=None)
        ).delete()
        db.commit()
        return {"success": True, "deleted_count": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.patch("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, data: ConversationUpdate, authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation introuvable ou accÃ¨s refusÃ©.")
        
        if data.title is not None:
            conv.title = data.title
        if data.status is not None:
            conv.status = data.status
        if data.folder_id is not None:
            conv.folder_id = data.folder_id if data.folder_id != "" else None
        
        conv.updated_at = datetime.utcnow()
        db.commit()
        return {"success": True, "id": conversation_id}
    finally:
        db.close()


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation introuvable ou accÃ¨s refusÃ©.")
        
        db.query(Message).filter(Message.conversation_id == conversation_id).delete()
        db.delete(conv)
        db.commit()
        return {"success": True}
    finally:
        db.close()


