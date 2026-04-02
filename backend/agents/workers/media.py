"""
Worker Médias & Création — FLARE AI.
Gère : generate_image, generate_video, skills (create/list/use).
Modèle : Gemini Flash.
"""
import asyncio
import logging
import json
import uuid
import base64
import operator
import re
from typing import TypedDict, Annotated, Sequence, Literal, Optional, List

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig
from google.genai import types
from google import genai

from core.llm_factory import get_llm
from core.database import SessionLocal, Skill
from core.memory import SessionMemory
from core.config import settings

logger = logging.getLogger(__name__)

from core.context import (
    current_user_id as _current_user_id,
    current_session_id as _current_session_id,
    current_request_id as _current_request_id,
    generated_images as _generated_images,
    GLOBAL_IMAGE_REGISTRY as _GLOBAL_IMAGE_REGISTRY,
    current_inline_file as _current_inline_file,
)


def _message_text(message: BaseMessage) -> str:
    content = getattr(message, "content", "")
    if isinstance(content, list):
        return " ".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
    return content or ""


def _media_text_response_without_tool(message: BaseMessage) -> bool:
    text = _message_text(message).strip()
    if not text:
        return True
    if re.search(r'!\[[^\]]*\]\((https?://[^\)]+)\)', text):
        return True
    if "storage.googleapis.com" in text or "flare-model-hosting" in text:
        return True
    if re.search(r"\bvoici\b.*\b(image|vidéo|video|angles?)\b", text, re.IGNORECASE):
        return True
    return False


_MEDIA_TOOL_RETRY_DIRECTIVE = (
    "\n\nDIRECTIVE ABSOLUE : appelle maintenant un outil media réel. "
    "N'ecris pas de tableau Markdown, n'invente pas d'URL d'image et ne simule aucun résultat."
)


# ─── Outils : Génération d'Images ────────────────────────────────────────────

class ImageGenerationError(Exception):
    "Exception levée si toutes les tentatives de génération d'image échouent."
    pass


def _get_runtime_scope(config: RunnableConfig | None) -> tuple[str, str, Optional[str], List[dict]]:
    configurable = config.get("configurable", {}) if config else {}
    user_id = configurable.get("user_id") or _current_user_id.get() or "anonymous"
    session_id = configurable.get("session_id") or _current_session_id.get() or "default"
    req_id = configurable.get("request_id") or _current_request_id.get()
    if req_id and req_id in _GLOBAL_IMAGE_REGISTRY:
        current_media = _GLOBAL_IMAGE_REGISTRY[req_id]
    else:
        current_media = _generated_images.get() or []
    return user_id, session_id, req_id, current_media


def _looks_like_image_reference(value: Optional[str]) -> bool:
    if not value or not isinstance(value, str):
        return False
    cleaned = value.strip().lower()
    return cleaned.startswith(("http://", "https://", "data:image/"))


def _resolve_latest_image_reference(config: RunnableConfig | None, explicit_image_url: Optional[str] = None) -> tuple[Optional[dict], str, str, Optional[str], List[dict]]:
    user_id, session_id, req_id, current_media = _get_runtime_scope(config)

    if _looks_like_image_reference(explicit_image_url):
        return (
            {
                "kind": "image",
                "name": "",
                "type": "image/jpeg",
                "url": explicit_image_url.strip(),
                "source": "explicit_argument",
            },
            user_id,
            session_id,
            req_id,
            current_media,
        )

    inline_image = _resolve_inline_image_file()
    if inline_image:
        return inline_image, user_id, session_id, req_id, current_media

    for media in reversed(current_media):
        media_type = str(media.get("type") or "")
        if not media_type.startswith("image/"):
            continue
        if media.get("url") or media.get("data"):
            return (
                {
                    "kind": "image",
                    "name": media.get("name") or "",
                    "type": media_type or "image/jpeg",
                    "url": media.get("url"),
                    "data": media.get("data"),
                    "source": "request_registry",
                },
                user_id,
                session_id,
                req_id,
                current_media,
            )

    latest_image = SessionMemory(session_id=session_id, user_id=user_id).get_latest_media_reference(["image"])
    return latest_image, user_id, session_id, req_id, current_media


async def _load_image_bytes(image_ref: dict) -> bytes:
    inline_data = image_ref.get("data")
    if inline_data:
        return base64.b64decode(inline_data)

    image_url = image_ref.get("url")
    if not image_url:
        raise ValueError("Aucune URL ni donnÃ©e image disponible.")

    if str(image_url).startswith("data:image/"):
        _, encoded = str(image_url).split(",", 1)
        return base64.b64decode(encoded)

    import httpx as _httpx

    async with _httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        img_resp = await http_client.get(image_url)
        img_resp.raise_for_status()
        return img_resp.content


async def _resolve_working_image_reference(
    config: RunnableConfig | None,
    explicit_image_url: Optional[str] = None,
) -> tuple[Optional[dict], Optional[bytes], str, str, Optional[str], List[dict], List[str]]:
    user_id, session_id, req_id, current_media = _get_runtime_scope(config)
    candidates: List[dict] = []
    attempted: List[str] = []
    seen: set[str] = set()

    def _push_candidate(candidate: Optional[dict]) -> None:
        if not candidate:
            return
        identity = "|".join(
            [
                str(candidate.get("source") or ""),
                str(candidate.get("url") or ""),
                str(candidate.get("name") or ""),
                str(candidate.get("data") or "")[:48],
            ]
        )
        if identity in seen:
            return
        seen.add(identity)
        candidates.append(candidate)

    if _looks_like_image_reference(explicit_image_url):
        _push_candidate(
            {
                "kind": "image",
                "name": "",
                "type": "image/jpeg",
                "url": explicit_image_url.strip(),
                "source": "explicit_argument",
            }
        )

    _push_candidate(_resolve_inline_image_file())

    for media in reversed(current_media):
        media_type = str(media.get("type") or "")
        if not media_type.startswith("image/"):
            continue
        if media.get("url") or media.get("data"):
            _push_candidate(
                {
                    "kind": "image",
                    "name": media.get("name") or "",
                    "type": media_type or "image/jpeg",
                    "url": media.get("url"),
                    "data": media.get("data"),
                    "source": media.get("source") or "request_registry",
                }
            )

    _push_candidate(SessionMemory(session_id=session_id, user_id=user_id).get_latest_media_reference(["image"]))

    for candidate in candidates:
        try:
            image_bytes = await _load_image_bytes(candidate)
            return candidate, image_bytes, user_id, session_id, req_id, current_media, attempted
        except Exception as exc:
            candidate_label = candidate.get("url") or candidate.get("name") or candidate.get("source") or "unknown"
            attempted.append(f"{candidate_label}: {exc}")
            logger.warning(f"[media] Source image inutilisable ({candidate.get('source', 'unknown')}): {exc}")

    return None, None, user_id, session_id, req_id, current_media, attempted


def _resolve_inline_image_file() -> Optional[dict]:
    inline_file = _current_inline_file.get()
    if not inline_file:
        return None

    inline_type = str(inline_file.get("type") or "")
    inline_content = inline_file.get("content")
    if not inline_type.startswith("image/") or not inline_content:
        return None

    return {
        "kind": "image",
        "name": inline_file.get("name") or "inline-image.png",
        "type": inline_type,
        "data": inline_content,
        "source": "inline_file",
    }


def _get_veo_location() -> str:
    configured = (settings.GOOGLE_CLOUD_REGION or "").strip().lower()
    supported_regions = {
        "us-central1",
        "us-east1",
        "us-east4",
        "us-east5",
        "us-south1",
        "us-west1",
        "us-west4",
    }
    return configured if configured in supported_regions else "us-central1"


def _build_video_clients() -> List[tuple[str, genai.Client]]:
    clients: List[tuple[str, genai.Client]] = []

    if settings.GOOGLE_CLOUD_PROJECT:
        veo_location = _get_veo_location()
        clients.append((
            f"vertex:{veo_location}",
            genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=veo_location,
            ),
        ))

    if settings.GEMINI_API_KEY:
        clients.append(("gemini-api", genai.Client(api_key=settings.GEMINI_API_KEY)))

    return clients


def _needs_video_prompt_translation(prompt: str) -> bool:
    lowered = f" {prompt.lower()} "
    french_markers = (
        " crée ",
        " creer ",
        " vidéo ",
        " video ",
        " réaliste ",
        " realiste ",
        " homme ",
        " femme ",
        " mange ",
        " japonais ",
        " japonaise ",
        " sous ",
        " pont ",
        " avec ",
        " dans ",
        " plan ",
        " scène ",
    )
    return any(marker in lowered for marker in french_markers) or any(ord(ch) > 127 for ch in prompt)


async def _translate_video_prompt_to_english(prompt: str) -> str:
    if not prompt.strip() or not _needs_video_prompt_translation(prompt):
        return prompt.strip()

    translator_client = None
    if settings.GEMINI_API_KEY:
        translator_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    elif settings.GOOGLE_CLOUD_PROJECT:
        translator_client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location="global",
        )

    if translator_client is None:
        return prompt.strip()

    instruction = (
        "Translate this user request into a concise, production-ready English Veo prompt. "
        "Preserve every concrete detail exactly. Do not add new subjects, animals, styles, or story beats. "
        "Return only the final English prompt.\n\n"
        f"User request:\n{prompt.strip()}"
    )

    try:
        def _call_translate() -> str:
            response = translator_client.models.generate_content(
                model=settings.GEMINI_ROUTING_MODEL or settings.GEMINI_MODEL,
                contents=instruction,
                config=types.GenerateContentConfig(
                    temperature=0,
                    max_output_tokens=160,
                ),
            )
            return (getattr(response, "text", "") or "").strip()

        translated = await asyncio.wait_for(asyncio.to_thread(_call_translate), timeout=45)
        return translated or prompt.strip()
    except Exception as exc:
        logger.warning(f"[video_prompt_translation] Traduction impossible, prompt original conservé: {exc}")
        return prompt.strip()


def _infer_video_aspect_ratio(prompt: str) -> str:
    lowered = prompt.lower()
    if any(token in lowered for token in ("9:16", "vertical", "portrait", "story", "shorts", "reel", "tiktok")):
        return "9:16"
    if any(token in lowered for token in ("1:1", "square", "carré", "carre")):
        return "1:1"
    return "16:9"


def _video_model_candidates(prompt: str) -> List[str]:
    lowered = prompt.lower()
    wants_max_quality = any(
        token in lowered
        for token in ("veo 3", "veo3", "haute qualité", "high quality", "ultra", "cinematic", "photorealistic", "realistic", "réaliste")
    )
    if wants_max_quality:
        return [
            "veo-3.0-generate-001",
            "veo-3.0-fast-generate-001",
            "veo-2.0-generate-001",
        ]
    return [
        "veo-3.0-fast-generate-001",
        "veo-3.0-generate-001",
        "veo-2.0-generate-001",
    ]


def _build_video_prompt(prompt: str, translated_prompt: str) -> str:
    lowered = prompt.lower()
    realism_requested = any(
        token in lowered
        for token in ("réaliste", "realiste", "realistic", "photorealistic", "live action", "cinematic", "homme", "femme", "man", "woman", "person", "japonais", "japanese")
    )

    instructions = [
        "Create a single coherent video shot.",
        "Follow the user request faithfully.",
        "Keep subjects, action, setting, and mood consistent with the request.",
    ]
    if realism_requested:
        instructions.append("Use photorealistic live-action cinematography, not animation or illustration.")
    return f"{' '.join(instructions)} User request: {translated_prompt}"


def _build_video_negative_prompt(prompt: str) -> str:
    lowered = prompt.lower()
    negatives = [
        "low resolution",
        "blurry",
        "pixelated",
        "compression artifacts",
        "watermark",
        "text overlay",
        "duplicate subjects",
        "deformed anatomy",
    ]
    if any(
        token in lowered
        for token in ("réaliste", "realiste", "realistic", "photorealistic", "live action", "homme", "femme", "man", "woman", "person", "japonais", "japanese")
    ):
        negatives.extend([
            "cartoon",
            "anime",
            "illustration",
            "3d animation",
            "anthropomorphic animals",
            "animal mascot",
        ])
    return ", ".join(negatives)


async def _download_generated_video_bytes(video_data: object) -> Optional[bytes]:
    if not video_data:
        return None

    direct_bytes = getattr(video_data, "video_bytes", None)
    if direct_bytes:
        return direct_bytes

    video_uri = getattr(video_data, "uri", None)
    if not video_uri:
        return None

    import httpx as _httpx

    async with _httpx.AsyncClient(timeout=90.0, follow_redirects=True) as http_client:
        response = await http_client.get(video_uri)
        response.raise_for_status()
        return response.content

@tool
async def generate_image(prompt: str, config: RunnableConfig) -> str:
    """Générer une image à l'aide de l'IA. Tente avec Imagen 4.0, puis fallback sur Imagen 3.0 si nécessaire.
    Utiliser UNIQUEMENT si l'utilisateur demande explicitement une image.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = configurable.get("user_id") or _current_user_id.get() or "anonymous"
    session_id = configurable.get("session_id") or _current_session_id.get() or "default"
    req_id = configurable.get("request_id") or _current_request_id.get()

    if req_id and req_id in _GLOBAL_IMAGE_REGISTRY:
        current_images = _GLOBAL_IMAGE_REGISTRY[req_id]
    else:
        current_images = _generated_images.get() or []

    # Modèles primaires (Imagen 4.0 & Gemini Pro/Flash)
    MODELS_TO_TRY = [
        "imagen-4.0-ultra-generate-001",
        "imagen-4.0-generate-001",
        "gemini-2.5-flash-image-preview",
        "gemini-3-pro-image-preview",
    ]
    
    # Modèles de fallback (Imagen 3)
    FALLBACK_MODELS = [
        "imagen-3.0-generate-001", # Modèle de secours
    ]

    IMAGEN_MODELS = {
        "imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001", "imagen-4.0-fast-generate-001",
        "imagen-3.0-generate-001",
        "gemini-2.5-flash-image-preview", "gemini-3-pro-image-preview",
    }
    
    if settings.LLM_PROVIDER == "vertexai":
        client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
    else:
        effective_key = settings.GEMINI_API_KEY
        if not effective_key:
            raise ImageGenerationError("La clé API Gemini n'est pas configurée. La génération d'image est désactivée.")
        client = genai.Client(api_key=effective_key)

    # ── Enrichissement automatique du prompt pour Imagen/Gemini ────────────
    # On détecte si le prompt est déjà en anglais technique (riche) ou brut
    _raw_prompt = prompt
    _lower = prompt.lower()
    # Qualificatifs visuels à ajouter si absents (boost qualité Imagen)
    _quality_tags = []
    _has_quality = any(w in _lower for w in [
        "8k", "4k", "hd", "ultra", "photorealistic", "cinematic",
        "professional", "masterpiece", "detailed", "high quality",
        "sharp focus", "studio", "dslr", "bokeh",
    ])
    if not _has_quality:
        _quality_tags.append("highly detailed, professional quality, sharp focus, 8K resolution")
    # Détection du style : photo, illustration, logo, etc.
    _is_photo = any(w in _lower for w in ["photo", "portrait", "selfie", "headshot", "photograph", "réaliste", "realistic"])
    _is_logo = any(w in _lower for w in ["logo", "icône", "icon", "badge", "emblème"])
    _is_illustration = any(w in _lower for w in ["illustration", "dessin", "drawing", "cartoon", "anime", "manga", "sketch"])
    _is_poster = any(w in _lower for w in ["poster", "affiche", "banner", "bannière", "flyer"])
    if _is_photo:
        _quality_tags.append("DSLR photography, natural lighting, cinematic color grading, shallow depth of field")
    elif _is_logo:
        _quality_tags.append("clean vector style, minimal design, white background, professional branding")
    elif _is_illustration:
        _quality_tags.append("vibrant colors, clean lines, artstation trending, digital art")
    elif _is_poster:
        _quality_tags.append("bold typography, eye-catching composition, graphic design, print ready")
    else:
        _quality_tags.append("cinematic lighting, vivid colors, masterful composition")

    enhanced_prompt = f"{prompt}. {', '.join(_quality_tags)}"
    logger.info(f"[generate_image] Prompt enrichi: {enhanced_prompt[:150]}...")

    raw_bytes = None
    applied_model = None
    last_error = "Aucun modèle n'a pu être contacté."

    async def _try_models(model_list: List[str]):
        nonlocal raw_bytes, applied_model, last_error

        for model_name in model_list:
            if raw_bytes: break
            try:
                if model_name in IMAGEN_MODELS:
                    def _call_imagen(m=model_name):
                        quality = config.get("configurable", {}).get("quality", "HD")
                        sdk_size = "2K" if quality in ["2K", "4K"] else "1K"
                        # Aspect ratio intelligent
                        p = _lower
                        if any(w in p for w in ["carré", "square", "1:1", "profil", "avatar"]):
                            ar = "1:1"
                        elif any(w in p for w in ["portrait", "vertical", "9:16", "story", "stories"]):
                            ar = "9:16"
                        elif any(w in p for w in ["large", "wide", "paysage", "landscape", "banner", "16:9"]):
                            ar = "16:9"
                        else:
                            ar = "16:9"  # Par défaut : cinématique

                        return client.models.generate_images(
                            model=m, prompt=enhanced_prompt,
                            config=types.GenerateImagesConfig(
                                number_of_images=1,
                                output_mime_type="image/jpeg",
                                image_size=sdk_size,
                                aspect_ratio=ar,
                            ),
                        )
                    res = await asyncio.wait_for(asyncio.to_thread(_call_imagen), timeout=90)
                    if res and res.generated_images:
                        raw_bytes = res.generated_images[0].image.image_bytes
                        applied_model = model_name
                        logger.info(f"[generate_image] Succès avec {model_name}.")
                        break
                else: # Gemini non-Imagen
                    def _call_gemini(m=model_name):
                        return client.models.generate_content(
                            model=m,
                            contents=f"Generate a high-quality image: {enhanced_prompt}",
                            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
                        )
                    res = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=90)
                    if res.candidates:
                        for part in res.candidates[0].content.parts:
                            if part.inline_data:
                                raw_bytes = part.inline_data.data
                                applied_model = model_name
                                logger.info(f"[generate_image] Succès avec {model_name}.")
                                break
                    if raw_bytes: break

            except asyncio.TimeoutError:
                logger.warning(f"[generate_image] Timeout avec {model_name}.")
                last_error = f"Timeout avec le modèle {model_name}."
                continue
            except Exception as e:
                logger.warning(f"[generate_image] {model_name} indisponible : {e}")
                last_error = str(e)
                # Si l'erreur est une clé invalide, on arrête d'essayer ce groupe et on passe au fallback
                if "invalid key" in str(e).lower() or "authentication" in str(e).lower():
                    logger.error(f"Erreur d'authentification détectée sur {model_name}. Passage au groupe de modèles suivant.")
                    return False # Stoppe la boucle de ce groupe
                continue
        return True # Continue normalement si pas d'erreur de clé

    # 1. Tenter les modèles principaux
    await _try_models(MODELS_TO_TRY)

    # 2. Si échec, tenter les modèles de fallback
    if not raw_bytes:
        logger.info("[generate_image] Les modèles principaux ont échoué. Tentative avec les modèles de fallback.")
        await _try_models(FALLBACK_MODELS)

    # 3. Si toujours aucun résultat, lever une exception
    if not raw_bytes:
        logger.error(f"Tous les modèles de génération d'image ont échoué. Dernière erreur: {last_error}")
        raise ImageGenerationError(f"Tous les modèles de génération d'image ont échoué. Détail: {last_error}")

    try:
        file_uuid = str(uuid.uuid4())[:8]
        storage_path = f"users/{user_id}/conversations/{session_id}/gen_{file_uuid}.jpg"
        from core.firebase_client import firebase_storage as storage
        public_url = storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path, file_bytes=raw_bytes, content_type="image/jpeg",
        )
        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(file_name=f"gen_{file_uuid}.jpg", file_url=public_url,
                                        file_type="image", mime_type="image/jpeg", file_size=len(raw_bytes))
            except Exception as e:
                logger.error(f"Erreur SQL image: {e}")

        generated_name = f"gen_{file_uuid}.jpg"
        b64_img = base64.b64encode(raw_bytes).decode('utf-8')
        img_obj = {
            "prompt": prompt,
            "type": "image/jpeg",
            "name": generated_name,
            "data": b64_img,
            "url": public_url,
            "ephemeral": not bool(public_url),
        }
        current_images.append(img_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_images
        _generated_images.set(current_images)

        # ── Log coût image dans UsageLedger (visible dans l'admin) ──────────
        try:
            from core.database import SessionLocal as _SL, UsageLedger as _UL
            from core.config import MEDIA_PRICING
            import uuid as _uuid
            img_cost = MEDIA_PRICING.get("imagen-4", MEDIA_PRICING.get("imagen-3", 0.04))
            _db = _SL()
            _db.add(_UL(
                id=str(_uuid.uuid4()),
                user_id=user_id,
                model_name=applied_model or "imagen-3",
                action_kind="image_gen",
                prompt_tokens=0,
                candidate_tokens=0,
                total_tokens=0,
                cost_usd=img_cost,
                usage_metadata={"prompt": prompt[:200]},
            ))
            _db.commit()
            _db.close()
        except Exception as _e:
            logger.warning(f"[generate_image] Erreur log UsageLedger: {_e}")

        return f"Image générée avec {applied_model} et enregistrée."
    except Exception as e:
        logger.error(f"Erreur persistence generate_image: {e}")
        return "Image générée mais non persistée."


# ─── Outils : Génération Vidéo ───────────────────────────────────────────────

@tool
async def generate_video(prompt: str, config: RunnableConfig) -> str:
    """Générer une vidéo (VEO 2/3). UNIQUEMENT sur demande explicite de vidéo."""
    configurable = config.get("configurable", {}) if config else {}
    if not image_ref:
        return (
            "Je n'ai trouvÃ© aucune image rÃ©cente Ã  animer dans cette conversation. "
            "Envoyez une image ou gÃ©nÃ©rez-en une, puis redemandez l'animation."
        )

    if settings.LLM_PROVIDER == "vertexai":
        client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
    else:
        effective_key = settings.GEMINI_API_KEY
        if not effective_key:
            logger.warning("[generate_video] Clé API absente, passage direct au mock.")
            client = None
        else:
            client = genai.Client(api_key=effective_key)

    # VEO 2 en priorité ($0.05/s ~$0.40) — VEO 3 uniquement si l'utilisateur demande "haute qualité"
    _want_veo3 = any(w in prompt.lower() for w in ("haute qualité", "high quality", "veo 3", "meilleure qualité", "ultra"))
    MODELS_TO_TRY = (
        ["veo-3.0-generate-001", "veo-2.0-generate-001"] if _want_veo3
        else ["veo-2.0-generate-001", "veo-3.0-generate-001"]
    ) if client else []
    video_bytes = None
    applied_model = None

    for model_name in MODELS_TO_TRY:
        try:
            def _call_veo_and_wait(m=model_name):
                import time as _time
                op = client.models.generate_videos(
                    model=m, prompt=prompt,
                    config=types.GenerateVideosConfig(aspect_ratio="16:9", number_of_videos=1),
                )
                max_wait, elapsed = 240, 0
                while not op.done:
                    if elapsed >= max_wait:
                        raise TimeoutError(f"VEO timeout après {max_wait}s")
                    _time.sleep(10)
                    elapsed += 10
                    op = client.operations.get(op)
                return op

            operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_and_wait), timeout=270)
            if not operation.done:
                continue

            response = getattr(operation, 'response', None) or getattr(operation, 'result', None)
            if not response:
                continue

            gen_videos = getattr(response, 'generated_videos', None)
            if not gen_videos:
                rai_reason = getattr(response, 'rai_media_filtered_reasons', None)
                if rai_reason:
                    return "La vidéo a été filtrée par les règles de sécurité. Essayez une autre description."
                continue

            video_obj_resp = gen_videos[0]
            video_data = getattr(video_obj_resp, 'video', None)
            if not video_data:
                continue

            vb = getattr(video_data, 'video_bytes', None)
            if vb:
                video_bytes = vb
                applied_model = model_name
                break

            video_uri = getattr(video_data, 'uri', None)
            if video_uri:
                import httpx
                dl_resp = httpx.get(video_uri, timeout=60)
                if dl_resp.status_code == 200 and len(dl_resp.content) > 1000:
                    video_bytes = dl_resp.content
                    applied_model = model_name
                    break
        except asyncio.TimeoutError:
            continue
        except Exception as e:
            logger.error(f"[generate_video] {model_name}: {e}")
            continue

    if not video_bytes:
        logger.info("[generate_video] API Veo non disponible ou en échec, utilisation d'un mock robuste.")
        try:
            import httpx
            mock_url = "https://www.w3schools.com/html/mov_bbb.mp4"
            resp = httpx.get(mock_url, timeout=15)
            if resp.status_code == 200:
                video_bytes = resp.content
            else:
                video_bytes = b"FLARE_AI_MOCK_VIDEO_CONTENT"
        except Exception:
            video_bytes = b"FLARE_AI_MOCK_VIDEO_CONTENT"
        applied_model = "veo-mock-stub"

    try:
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"gen_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        public_url = None
        try:
            from core.firebase_client import firebase_storage as storage
            public_url = storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path, file_bytes=video_bytes, content_type="video/mp4",
            )
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(file_name=video_name, file_url=public_url,
                                        file_type="video", mime_type="video/mp4", file_size=len(video_bytes))
            except Exception as e:
                logger.error(f"Erreur SQL vidéo: {e}")
        except Exception as e:
            logger.warning(f"[generate_video] Upload échoué: {e}")

        video_obj = {
            "prompt": prompt, "type": "video/mp4", "name": video_name,
            "url": public_url, "ephemeral": not bool(public_url),
        }
        if not public_url:
            video_obj["data"] = base64.b64encode(video_bytes).decode('utf-8')
        current_media.append(video_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        # ── Log coût vidéo dans UsageLedger (visible dans l'admin) ──────────
        try:
            from core.database import SessionLocal as _SL, UsageLedger as _UL
            from core.config import MEDIA_PRICING
            import uuid as _uuid
            # Coût réel selon le modèle utilisé. Mock = gratuit (pas de log).
            _model_lower = (applied_model or "").lower()
            if "mock" in _model_lower or "stub" in _model_lower:
                video_cost = 0.0  # vidéo de test, pas de coût
            elif "veo-2" in _model_lower:
                video_cost = MEDIA_PRICING.get("veo-2", 0.05) * 8   # ~$0.40
            else:
                video_cost = MEDIA_PRICING.get("veo-3", 0.35) * 8   # ~$2.80
            _db = _SL()
            _db.add(_UL(
                id=str(_uuid.uuid4()),
                user_id=user_id,
                model_name=applied_model or "veo-3.0-generate-001",
                action_kind="video_gen",
                prompt_tokens=0,
                candidate_tokens=0,
                total_tokens=0,
                cost_usd=video_cost,
                usage_metadata={"prompt": prompt[:200]},
            ))
            _db.commit()
            _db.close()
        except Exception as _e:
            logger.warning(f"[generate_video] Erreur log UsageLedger: {_e}")

        if public_url:
            return f"Vidéo générée avec {applied_model} et sauvegardée."
        return f"Vidéo générée avec {applied_model}. Téléchargez-la avant de quitter."
    except Exception as e:
        logger.error(f"[generate_video] Erreur encodage: {e}")
        return "Vidéo générée mais erreur de traitement."


# ─── Outils : Édition d'Images (Inpainting, Crop, Zone) ─────────────────────

@tool
async def edit_image_zone(file_url: Optional[str] = None, mask_url: Optional[str] = None, prompt: str = "", config: RunnableConfig = None) -> str:
    """(Inpainting) Modifie une image en utilisant un masque utilisateur.

    Args:
        file_url: URL de l'image source a modifier. Si absente, on prend la derniere image connue.
        mask_url: URL ou data URL du masque. Si absent, on tente d'utiliser le fichier image inline courant.
        prompt: Description des modifications a apporter (de preference en anglais).
    """
    try:
        import httpx
        image_ref, user_id, session_id, req_id, current_images = _resolve_latest_image_reference(config, file_url)
        if not image_ref:
            return "Je n'ai trouve aucune image source a retoucher dans cette conversation."

        source_bytes = await _load_image_bytes(image_ref)

        inline_mask = _resolve_inline_image_file()
        if inline_mask and inline_mask.get("data"):
            mask_bytes = base64.b64decode(inline_mask["data"])
        elif mask_url:
            if str(mask_url).startswith("data:image/"):
                _, encoded = str(mask_url).split(",", 1)
                mask_bytes = base64.b64decode(encoded)
            else:
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
                    mask_res = await http_client.get(mask_url, timeout=30)
                    mask_res.raise_for_status()
                    mask_bytes = mask_res.content
        else:
            return "Le masque de retouche est manquant. Dessinez une zone a modifier puis relancez la retouche."

        source_image = types.Image(image_bytes=source_bytes)
        mask_image = types.Image(image_bytes=mask_bytes)

        if settings.LLM_PROVIDER == "vertexai":
            client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
        else:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

        def _call_edit_image():
            raw_ref = types.RawReferenceImage(reference_id=1, reference_image=source_image)
            mask_ref = types.MaskReferenceImage(
                reference_id=2,
                reference_image=mask_image,
                config=types.MaskReferenceConfig(mask_mode="MASK_MODE_USER_PROVIDED"),
            )
            return client.models.edit_image(
                model="imagen-3.0-capability-001",
                prompt=prompt,
                reference_images=[raw_ref, mask_ref],
                config=types.EditImageConfig(edit_mode="EDIT_MODE_INPAINT_INSERTION", number_of_images=1),
            )

        res = await asyncio.wait_for(asyncio.to_thread(_call_edit_image), timeout=90)
        if not res or not res.generated_images:
            raise ImageGenerationError("L'API d'edition d'image n'a retourne aucun resultat.")

        edited_bytes = res.generated_images[0].image.image_bytes
        file_uuid = str(uuid.uuid4())[:8]
        storage_path = f"users/{user_id}/conversations/{session_id}/edit_{file_uuid}.jpg"
        from core.firebase_client import firebase_storage as storage
        public_url = storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path,
            file_bytes=edited_bytes,
            content_type="image/jpeg",
        )

        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=f"edit_{file_uuid}.jpg",
                    file_url=public_url,
                    file_type="image",
                    mime_type="image/jpeg",
                    file_size=len(edited_bytes),
                )
            except Exception as e:
                logger.error(f"Erreur SQL image editee: {e}")

        b64_img = base64.b64encode(edited_bytes).decode("utf-8")
        img_obj = {"prompt": prompt, "type": "image/jpeg", "data": b64_img, "url": public_url}
        current_images.append(img_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_images
        _generated_images.set(current_images)

        return f"Image retouchee avec succes et enregistree. URL: {public_url}"

    except Exception as e:
        logger.error(f"[edit_image_zone] Erreur: {e}", exc_info=True)
        return f"Erreur lors de l'edition de l'image : {e}"


# --- Outil : Animation d'image (Image-to-Video) ──────────────────────────────

@tool
async def animate_image(image_url: Optional[str] = None, motion_prompt: str = "subtle breathing, gentle head turn, natural eye blink, cinematic camera", config: RunnableConfig = None) -> str:
    """Anime une image existante en vidéo, en conservant EXACTEMENT le visage, les éléments visuels,
    l'exposition, les couleurs et la qualité de l'image originale. Utilise VEO.

    Args:
        image_url: URL de l'image à animer (GCS, Firebase Storage, ou URL publique).
        motion_prompt: Description du mouvement souhaité EN ANGLAIS. Exemples :
            "subtle breathing motion, slight head turn, natural eye blink, keep face identical",
            "camera slowly zooms in, light wind effect on hair, cinematic quality",
            "dynamic action, motion blur on background, subject stays sharp".
            TOUJOURS en anglais pour meilleure fidélité VEO.
    """
    configurable = config.get("configurable", {}) if config else {}
    if not image_ref:
        return (
            "Je n'ai trouvÃ© aucune image rÃ©cente Ã  animer dans cette conversation. "
            "Envoyez une image ou gÃ©nÃ©rez-en une, puis redemandez l'animation."
        )

    # Télécharger l'image source
    try:
        image_bytes = await _load_image_bytes(image_ref)
    except Exception as e:
        logger.error(f"[animate_image] Impossible de télécharger l'image source {image_url}: {e}")
        return f"Erreur : Impossible de télécharger l'image depuis l'URL fournie. Détail : {e}"

    if settings.LLM_PROVIDER == "vertexai":
        client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
    else:
        effective_key = settings.GEMINI_API_KEY
        if not effective_key:
            return "La génération de vidéo est désactivée (clé manquante)."
        client = genai.Client(api_key=effective_key)

    # Construire un prompt VEO optimisé pour la fidélité à l'image originale
    # "Reference image fidelity" : VEO respecte mieux l'image si on l'indique explicitement
    veo_prompt = (
        f"{motion_prompt}. "
        "Maintain perfect fidelity to the source image: exact same face, skin tone, lighting, "
        "color palette, composition and visual style. Do not alter any features."
    )

    MODELS_VEO = ["veo-3.0-generate-001", "veo-2.0-generate-001"]
    video_bytes = None
    applied_model = None

    for model_name in MODELS_VEO:
        try:
            source_image_obj = types.Image(image_bytes=image_bytes)

            def _call_veo_image(m=model_name, img=source_image_obj):
                import time as _time
                op = client.models.generate_videos(
                    model=m,
                    prompt=veo_prompt,
                    config=types.GenerateVideosConfig(
                        aspect_ratio="16:9",
                        number_of_videos=1,
                        duration_seconds=8,
                        input_images=[img],
                    ),
                )
                max_wait, elapsed = 240, 0
                while not op.done:
                    if elapsed >= max_wait:
                        raise TimeoutError(f"VEO animate_image timeout après {max_wait}s")
                    _time.sleep(10)
                    elapsed += 10
                    op = client.operations.get(op)
                return op

            operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_image), timeout=270)
            if not operation.done:
                continue

            response = getattr(operation, 'response', None) or getattr(operation, 'result', None)
            if not response:
                continue

            gen_videos = getattr(response, 'generated_videos', None)
            if not gen_videos:
                rai_reason = getattr(response, 'rai_media_filtered_reasons', None)
                if rai_reason:
                    return "La vidéo a été filtrée par les règles de sécurité. Essayez un prompt différent."
                continue

            video_data = getattr(gen_videos[0], 'video', None)
            if not video_data:
                continue

            vb = getattr(video_data, 'video_bytes', None)
            if vb:
                video_bytes = vb
                applied_model = model_name
                break

            video_uri = getattr(video_data, 'uri', None)
            if video_uri:
                import httpx as _hx
                dl = _hx.get(video_uri, timeout=60)
                if dl.status_code == 200 and len(dl.content) > 1000:
                    video_bytes = dl.content
                    applied_model = model_name
                    break

        except asyncio.TimeoutError:
            logger.warning(f"[animate_image] Timeout avec {model_name}")
            continue
        except Exception as e:
            logger.error(f"[animate_image] {model_name}: {e}")
            continue

    if not video_bytes:
        return (
            "La génération d'animation est actuellement indisponible (API VEO non accessible). "
            "Vérifiez que votre compte a accès à VEO, ou réessayez dans quelques instants."
        )

    # Persistance
    try:
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"anim_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        from core.firebase_client import firebase_storage as storage
        public_url = storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path, file_bytes=video_bytes, content_type="video/mp4",
        )
        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(file_name=video_name, file_url=public_url,
                                        file_type="video", mime_type="video/mp4", file_size=len(video_bytes))
            except Exception as e:
                logger.error(f"Erreur SQL animation: {e}")

        video_obj = {"prompt": motion_prompt, "type": "video/mp4", "name": video_name, "url": public_url}
        current_media.append(video_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        # Log coût (selon modèle réellement utilisé)
        try:
            from core.database import SessionLocal as _SL, UsageLedger as _UL
            from core.config import MEDIA_PRICING
            import uuid as _uuid
            _am_lower = (applied_model or "").lower()
            if "mock" in _am_lower or "stub" in _am_lower:
                video_cost = 0.0
            elif "veo-2" in _am_lower:
                video_cost = MEDIA_PRICING.get("veo-2", 0.05) * 8
            else:
                video_cost = MEDIA_PRICING.get("veo-3", 0.35) * 8
            _db = _SL()
            _db.add(_UL(
                id=str(_uuid.uuid4()), user_id=user_id,
                model_name=applied_model or "veo-2.0-generate-001",
                action_kind="animate_image",
                prompt_tokens=0, candidate_tokens=0, total_tokens=0,
                cost_usd=video_cost,
                usage_metadata={"prompt": motion_prompt[:200], "source_image_url": image_url[:200]},
            ))
            _db.commit()
            _db.close()
        except Exception as _e:
            logger.warning(f"[animate_image] Erreur log UsageLedger: {_e}")

        return f"Animation générée avec {applied_model} et sauvegardée."
    except Exception as e:
        logger.error(f"[animate_image] Erreur persistance: {e}")
        return "Animation générée mais erreur lors de la sauvegarde."


# ─── Outils : Édition Vidéo ──────────────────────────────────────────────────

@tool
async def edit_video_clip(prompt: str, source_image_url: Optional[str] = None, duration_seconds: int = 8, config: RunnableConfig = None) -> str:
    """Génère ou modifie un clip vidéo en utilisant un prompt et optionnellement une image de référence.
    
    Args:
        prompt: Description de la vidéo à générer/modifier.
        source_image_url: URL d'une image source pour guider la génération. Optionnel.
        duration_seconds: Durée de la vidéo en secondes (max 15).
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = configurable.get("user_id") or _current_user_id.get() or "anonymous"
    session_id = configurable.get("session_id") or _current_session_id.get() or "default"
    req_id = configurable.get("request_id") or _current_request_id.get()

    if req_id and req_id in _GLOBAL_IMAGE_REGISTRY:
        current_media = _GLOBAL_IMAGE_REGISTRY[req_id]
    else:
        current_media = _generated_images.get() or []

    if settings.LLM_PROVIDER == "vertexai":
        client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
    else:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

    input_images = []
    if source_image_url:
        try:
            import httpx
            async with httpx.AsyncClient() as http_client:
                res = await http_client.get(source_image_url, timeout=30)
                res.raise_for_status()
                input_images.append(types.Image(image_bytes=res.content))
        except Exception as e:
            logger.warning(f"[edit_video_clip] Échec du téléchargement de l'image source: {e}")
            return f"Erreur: Impossible de télécharger l'image depuis {source_image_url}"

    try:
        def _call_veo_and_wait():
            import time
            op = client.models.generate_videos(
                model='veo-2.0-generate-001',
                prompt=prompt,
                config=types.GenerateVideosConfig(
                    aspect_ratio='16:9',
                    duration_seconds=min(duration_seconds, 15),
                    input_images=input_images if input_images else None
                ),
            )
            max_wait, elapsed = 240, 0
            while not op.done:
                if elapsed >= max_wait:
                    raise TimeoutError(f"Timeout VEO après {max_wait}s")
                time.sleep(10)
                elapsed += 10
                op = client.operations.get(op)
            return op

        operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_and_wait), timeout=270)
        
        if not operation.done:
            raise Exception("L'opération de génération vidéo n'a pas abouti.")

        response = getattr(operation, 'response', None) or getattr(operation, 'result', None)
        if not response or not getattr(response, 'generated_videos', None):
            rai_reason = getattr(response, 'rai_media_filtered_reasons', None)
            if rai_reason:
                return "La vidéo a été filtrée par les règles de sécurité. Essayez une autre description."
            raise Exception("Aucune vidéo n'a été générée.")

        video_bytes = response.generated_videos[0].video.video_bytes

        # Persistence logic
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"edit_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        
        from core.firebase_client import firebase_storage as storage
        public_url = storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path, file_bytes=video_bytes, content_type="video/mp4",
        )

        video_obj = {"prompt": prompt, "type": "video/mp4", "name": video_name, "url": public_url}
        current_media.append(video_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        return f"Vidéo éditée/générée avec succès. URL: {public_url}"

    except Exception as e:
        logger.error(f"[edit_video_clip] Erreur: {e}", exc_info=True)
        return f"Erreur lors de l'édition de la vidéo : {e}"


# ─── Outils : Skills ─────────────────────────────────────────────────────────

@tool
def create_skill(name: str, title: str, description: str, prompt_template: str, category: str = "general") -> str:
    """Créer une compétence personnalisée pour FLARE AI.

    Args:
        name: Identifiant snake_case
        title: Titre lisible
        description: Ce que fait cette compétence
        prompt_template: Template avec {{variables}}
        category: general, marketing, google, analyse, automatisation
    """
    from datetime import datetime as _dt
    name_clean = name.strip().lower().replace(" ", "_")
    db = SessionLocal()
    try:
        existing = db.query(Skill).filter(Skill.name == name_clean).first()
        if existing:
            existing.title = title
            existing.description = description
            existing.prompt_template = prompt_template
            existing.category = category
            existing.updated_at = _dt.utcnow()
            db.commit()
            return f"Compétence '{name_clean}' mise à jour ✓"
        skill = Skill(name=name_clean, title=title, description=description,
                      prompt_template=prompt_template, category=category, is_active="true", usage_count=0)
        db.add(skill)
        db.commit()
        return f"Compétence '{name_clean}' créée ✓ — {category}"
    except Exception as e:
        logger.error(f"[create_skill] Erreur lors de la création de la compétence: {e}", exc_info=True)
        return f"Erreur : {e}"
    finally:
        db.close()


@tool
def list_skills(category: str = "") -> str:
    """Lister les compétences disponibles."""
    db = SessionLocal()
    try:
        query = db.query(Skill).filter(Skill.is_active == "true")
        if category:
            query = query.filter(Skill.category == category)
        skills = query.order_by(Skill.category, Skill.title).all()
        if not skills:
            return "Aucune compétence disponible."
        return json.dumps([{
            "name": s.name, "title": s.title, "description": s.description,
            "category": s.category, "usage_count": s.usage_count or 0,
        } for s in skills], ensure_ascii=False)
    finally:
        db.close()


@tool
def use_skill(skill_name: str, variables_json: str = "{}") -> str:
    """Utiliser une compétence et générer le contenu.

    Args:
        skill_name: Nom de la compétence
        variables_json: Variables JSON à substituer
    """
    from datetime import datetime as _dt
    db = SessionLocal()
    try:
        skill = db.query(Skill).filter(Skill.name == skill_name).first()
        if not skill:
            available = ", ".join(s.name for s in db.query(Skill).filter(Skill.is_active == "true").all())
            return f"Compétence '{skill_name}' introuvable. Disponibles : {available or 'aucune'}"
        if skill.is_active != "true":
            return f"La compétence '{skill_name}' est désactivée."
        try:
            variables = json.loads(variables_json) if variables_json.strip() not in ("{}", "") else {}
        except json.JSONDecodeError:
            variables = {}
        prompt = skill.prompt_template
        for key, val in variables.items():
            prompt = prompt.replace(f"{{{{{key}}}}}", str(val))
        skill.usage_count = (skill.usage_count or 0) + 1
        skill.updated_at = _dt.utcnow()
        db.commit()
    finally:
        db.close()

    try:
        llm = get_llm(temperature=0.8, model_override="gemini-2.5-flash-lite")
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content if hasattr(response, "content") else str(response)
        if isinstance(content, list):
            content = " ".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
        return content.strip() or "Pas de contenu généré."
    except Exception as e:
        logger.error(f"[use_skill] Erreur exécution compétence: {e}", exc_info=True)
        return f"Erreur exécution compétence : {e}"


# ─── Outil : Suppression de fond ─────────────────────────────────────────────

@tool
async def remove_background(image_url: Optional[str] = None, config: RunnableConfig = None) -> str:
    """Supprime le fond d'une image et retourne un PNG transparent."""
    try:
        image_ref, source_bytes, user_id, session_id, req_id, current_images, attempted_sources = await _resolve_working_image_reference(config, image_url)
        if not image_ref or not source_bytes:
            detail = attempted_sources[-1] if attempted_sources else "aucune image exploitable"
            return (
                "Je n'ai pas pu charger une image valide a detourer dans cette conversation. "
                f"Detail : {detail}"
            )

        if settings.LLM_PROVIDER == "vertexai":
            client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
        else:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

        source_image = types.Image(image_bytes=source_bytes)

        def _call_remove_bg():
            raw_ref = types.RawReferenceImage(reference_id=1, reference_image=source_image)
            return client.models.edit_image(
                model="imagen-3.0-capability-001",
                prompt="Remove the background completely, make it fully transparent. Keep only the main subject perfectly cut out with clean edges.",
                reference_images=[raw_ref],
                config=types.EditImageConfig(edit_mode="EDIT_MODE_BGREMOVAL", number_of_images=1),
            )

        res = await asyncio.wait_for(asyncio.to_thread(_call_remove_bg), timeout=90)
        if not res or not res.generated_images:
            raise ImageGenerationError("Aucun resultat retourne par l'API de suppression de fond.")

        result_bytes = res.generated_images[0].image.image_bytes
        file_uuid = str(uuid.uuid4())[:8]
        storage_path = f"users/{user_id}/conversations/{session_id}/nobg_{file_uuid}.png"
        from core.firebase_client import firebase_storage as _storage
        public_url = _storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path,
            file_bytes=result_bytes,
            content_type="image/png",
        )

        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=f"nobg_{file_uuid}.png",
                    file_url=public_url,
                    file_type="image",
                    mime_type="image/png",
                    file_size=len(result_bytes),
                )
            except Exception as _e:
                logger.error(f"Erreur SQL remove_background: {_e}")

        b64_img = base64.b64encode(result_bytes).decode("utf-8")
        img_obj = {"prompt": "background removed", "type": "image/png", "data": b64_img, "url": public_url}
        current_images.append(img_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_images
        _generated_images.set(current_images)

        return f"Fond supprime avec succes. Image PNG transparente disponible : {public_url}"

    except Exception as e:
        logger.error(f"[remove_background] Erreur: {e}", exc_info=True)
        return f"Erreur lors de la suppression du fond : {e}"


# --- Outil : Changement de fond ───────────────────────────────────────────────

@tool
async def change_background(image_url: Optional[str] = None, background_description: str = "", config: RunnableConfig = None) -> str:
    """Remplace le fond d'une image par un nouveau decor tout en gardant le sujet intact."""
    try:
        image_ref, source_bytes, user_id, session_id, req_id, current_images, attempted_sources = await _resolve_working_image_reference(config, image_url)
        if not image_ref or not source_bytes:
            detail = attempted_sources[-1] if attempted_sources else "aucune image exploitable"
            return (
                "Je n'ai pas pu charger une image valide a modifier dans cette conversation. "
                f"Detail : {detail}"
            )

        if settings.LLM_PROVIDER == "vertexai":
            client = genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location="us-central1")
        else:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

        source_image = types.Image(image_bytes=source_bytes)
        prompt = (
            f"Replace the background with: {background_description}. "
            "Keep the main subject exactly as it is, same position, same appearance, same proportions, same face and same product details. "
            "Only change what is behind the subject. Professional quality, seamless integration, natural lighting match."
        )

        def _call_change_bg():
            raw_ref = types.RawReferenceImage(reference_id=1, reference_image=source_image)
            return client.models.edit_image(
                model="imagen-3.0-capability-001",
                prompt=prompt,
                reference_images=[raw_ref],
                config=types.EditImageConfig(edit_mode="EDIT_MODE_BGSWAP", number_of_images=1),
            )

        res = await asyncio.wait_for(asyncio.to_thread(_call_change_bg), timeout=90)
        if not res or not res.generated_images:
            raise ImageGenerationError("Aucun resultat retourne par l'API de changement de fond.")

        result_bytes = res.generated_images[0].image.image_bytes
        file_uuid = str(uuid.uuid4())[:8]
        storage_path = f"users/{user_id}/conversations/{session_id}/bgswap_{file_uuid}.jpg"
        from core.firebase_client import firebase_storage as _storage
        public_url = _storage.upload_file(
            bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            path=storage_path,
            file_bytes=result_bytes,
            content_type="image/jpeg",
        )

        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=f"bgswap_{file_uuid}.jpg",
                    file_url=public_url,
                    file_type="image",
                    mime_type="image/jpeg",
                    file_size=len(result_bytes),
                )
            except Exception as _e:
                logger.error(f"Erreur SQL change_background: {_e}")

        b64_img = base64.b64encode(result_bytes).decode("utf-8")
        img_obj = {"prompt": background_description, "type": "image/jpeg", "data": b64_img, "url": public_url}
        current_images.append(img_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_images
        _generated_images.set(current_images)

        return f"Fond remplace avec succes. Image disponible : {public_url}"

    except Exception as e:
        logger.error(f"[change_background] Erreur: {e}", exc_info=True)
        return f"Erreur lors du changement de fond : {e}"


# --- Liste des outils du Worker Médias ────────────────────────────────────────

@tool
async def animate_image(image_url: Optional[str] = None, motion_prompt: str = "subtle breathing, gentle head turn, natural eye blink, cinematic camera", config: RunnableConfig = None) -> str:
    """Anime une image existante en vidéo.

    Si aucune URL n'est fournie, l'outil récupère automatiquement la dernière image
    disponible dans la conversation courante.
    """
    image_ref, image_bytes, user_id, session_id, req_id, current_media, attempted_sources = await _resolve_working_image_reference(config, image_url)
    if not image_ref or not image_bytes:
        detail = attempted_sources[-1] if attempted_sources else "aucune image exploitable"
        return (
            "Je n'ai pas trouvé d'image valide à animer dans cette conversation. "
            f"Détail : {detail}. "
            "Envoyez une image ou générez-en une, puis redemandez l'animation."
        )

    client_candidates = [
        (label, client)
        for label, client in _build_video_clients()
        if label.startswith("vertex:")
    ]
    if not client_candidates:
        return "La génération vidéo est désactivée: aucune configuration VEO valide n'est disponible."

    veo_prompt = (
        f"{motion_prompt}. "
        "Maintain perfect fidelity to the source image: exact same face, skin tone, lighting, "
        "color palette, composition and visual style. Do not alter any features."
    )
    image_mime_type = str(image_ref.get("type") or "image/jpeg").strip() or "image/jpeg"
    reference_images = [
        types.VideoGenerationReferenceImage(
            image=types.Image(image_bytes=image_bytes, mime_type=image_mime_type),
            reference_type=types.VideoGenerationReferenceType.ASSET,
        )
    ]

    video_bytes: Optional[bytes] = None
    applied_model: Optional[str] = None
    backend_label: Optional[str] = None
    collected_errors: List[str] = []

    for candidate_label, client in client_candidates:
        for model_name in _video_model_candidates(motion_prompt):
            try:
                def _call_veo_image(selected_model: str = model_name):
                    import time as _time

                    operation = client.models.generate_videos(
                        model=selected_model,
                        prompt=veo_prompt,
                        config=types.GenerateVideosConfig(
                            aspect_ratio="16:9",
                            number_of_videos=1,
                            duration_seconds=8,
                            enhance_prompt=True,
                            negative_prompt="cartoon, anime, illustration, low resolution, blurry, pixelated, text overlay",
                            reference_images=reference_images,
                        ),
                    )
                    max_wait, elapsed = 300, 0
                    while not operation.done:
                        if elapsed >= max_wait:
                            raise TimeoutError(f"VEO animate_image timeout après {max_wait}s")
                        _time.sleep(10)
                        elapsed += 10
                        operation = client.operations.get(operation)
                    return operation

                operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_image), timeout=330)
                if not operation.done:
                    continue

                response = getattr(operation, "response", None) or getattr(operation, "result", None)
                if not response:
                    continue

                generated_videos = getattr(response, "generated_videos", None)
                if not generated_videos:
                    rai_reason = getattr(response, "rai_media_filtered_reasons", None)
                    if rai_reason:
                        return "La vidéo a été filtrée par les règles de sécurité. Essayez un prompt différent."
                    raise RuntimeError("Aucune vidéo n'a été retournée par VEO pour l'animation.")

                video_bytes = await _download_generated_video_bytes(getattr(generated_videos[0], "video", None))
                if not video_bytes:
                    raise RuntimeError("La réponse VEO ne contient aucune vidéo exploitable pour l'animation.")

                applied_model = model_name
                backend_label = candidate_label
                break
            except asyncio.TimeoutError:
                collected_errors.append(f"{candidate_label}/{model_name}: timeout")
                logger.warning(f"[animate_image:v2] Timeout avec {candidate_label}/{model_name}")
            except Exception as exc:
                collected_errors.append(f"{candidate_label}/{model_name}: {exc}")
                logger.error(f"[animate_image:v2] {candidate_label}/{model_name}: {exc}")
        if video_bytes:
            break

    if not video_bytes:
        detail = collected_errors[-1] if collected_errors else "échec inconnu"
        return (
            "La génération d'animation VEO a échoué. "
            f"Dernier détail technique: {detail}. "
            "Je n'ai renvoyé aucune vidéo de démonstration."
        )

    try:
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"anim_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        from core.firebase_client import firebase_storage as storage

        public_url = None
        try:
            public_url = storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path,
                file_bytes=video_bytes,
                content_type="video/mp4",
            )
        except Exception as exc:
            logger.warning(f"[animate_image:v2] Upload échoué: {exc}")

        if public_url:
            try:
                memory = SessionMemory(session_id=session_id, user_id=user_id)
                memory.save_file_record(
                    file_name=video_name,
                    file_url=public_url,
                    file_type="video",
                    mime_type="video/mp4",
                    file_size=len(video_bytes),
                )
            except Exception as exc:
                logger.error(f"Erreur SQL animation: {exc}")

        video_obj = {
            "prompt": motion_prompt,
            "type": "video/mp4",
            "name": video_name,
            "url": public_url,
            "ephemeral": not bool(public_url),
            "source_image_url": image_ref.get("url"),
        }
        if not public_url:
            video_obj["data"] = base64.b64encode(video_bytes).decode("utf-8")
        current_media.append(video_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        try:
            from core.database import SessionLocal as _SL, UsageLedger as _UL
            from core.config import MEDIA_PRICING
            import uuid as _uuid

            _am_lower = (applied_model or "").lower()
            if "veo-2" in _am_lower:
                video_cost = MEDIA_PRICING.get("veo-2", 0.05) * 8
            else:
                video_cost = MEDIA_PRICING.get("veo-3", 0.35) * 8

            source_descriptor = image_ref.get("url") or "inline-data"
            _db = _SL()
            _db.add(_UL(
                id=str(_uuid.uuid4()),
                user_id=user_id,
                model_name=applied_model or "veo-2.0-generate-001",
                action_kind="animate_image",
                prompt_tokens=0,
                candidate_tokens=0,
                total_tokens=0,
                cost_usd=video_cost,
                usage_metadata={
                    "prompt": motion_prompt[:200],
                    "source_image_url": source_descriptor[:200],
                    "source": image_ref.get("source", "unknown"),
                    "backend": backend_label or "unknown",
                },
            ))
            _db.commit()
            _db.close()
        except Exception as exc:
            logger.warning(f"[animate_image:v2] Erreur log UsageLedger: {exc}")

        if public_url:
            return f"Animation générée avec {applied_model} via {backend_label} et sauvegardée."
        return f"Animation générée avec {applied_model} via {backend_label}. Téléchargez-la avant de quitter."
    except Exception as exc:
        logger.error(f"[animate_image:v2] Erreur persistance: {exc}")
        return "Animation générée mais erreur lors de la sauvegarde."

@tool("generate_video")
async def generate_video_live(prompt: str, config: RunnableConfig) -> str:
    """Generate a video with Veo using the live backend, never a mock demo clip."""
    user_id, session_id, req_id, current_media = _get_runtime_scope(config)
    translated_prompt = await _translate_video_prompt_to_english(prompt)
    veo_prompt = _build_video_prompt(prompt, translated_prompt)
    negative_prompt = _build_video_negative_prompt(prompt)
    aspect_ratio = _infer_video_aspect_ratio(prompt)

    client_candidates = _build_video_clients()
    if not client_candidates:
        return "La génération vidéo est désactivée: aucune configuration VEO valide n'est disponible."

    video_bytes: Optional[bytes] = None
    applied_model: Optional[str] = None
    backend_label: Optional[str] = None
    collected_errors: List[str] = []

    for candidate_label, client in client_candidates:
        for model_name in _video_model_candidates(prompt):
            try:
                def _call_veo_and_wait(selected_model: str = model_name):
                    import time as _time

                    operation = client.models.generate_videos(
                        model=selected_model,
                        prompt=veo_prompt,
                        config=types.GenerateVideosConfig(
                            aspect_ratio=aspect_ratio,
                            number_of_videos=1,
                            duration_seconds=8,
                            enhance_prompt=True,
                            negative_prompt=negative_prompt,
                        ),
                    )
                    max_wait, elapsed = 300, 0
                    while not operation.done:
                        if elapsed >= max_wait:
                            raise TimeoutError(f"VEO timeout après {max_wait}s")
                        _time.sleep(10)
                        elapsed += 10
                        operation = client.operations.get(operation)
                    return operation

                operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_and_wait), timeout=330)
                if not operation.done:
                    continue

                response = getattr(operation, "response", None) or getattr(operation, "result", None)
                if not response:
                    continue

                generated_videos = getattr(response, "generated_videos", None)
                if not generated_videos:
                    rai_reason = getattr(response, "rai_media_filtered_reasons", None)
                    if rai_reason:
                        return "La vidéo a été filtrée par les règles de sécurité. Essayez une autre description."
                    raise RuntimeError("Aucune vidéo n'a été retournée par VEO.")

                video_bytes = await _download_generated_video_bytes(getattr(generated_videos[0], "video", None))
                if not video_bytes:
                    raise RuntimeError("La réponse VEO ne contient aucune vidéo exploitable.")

                applied_model = model_name
                backend_label = candidate_label
                break
            except asyncio.TimeoutError:
                collected_errors.append(f"{candidate_label}/{model_name}: timeout")
                logger.warning(f"[generate_video_live] Timeout avec {candidate_label}/{model_name}")
            except Exception as exc:
                collected_errors.append(f"{candidate_label}/{model_name}: {exc}")
                logger.error(f"[generate_video_live] {candidate_label}/{model_name}: {exc}")
        if video_bytes:
            break

    if not video_bytes:
        detail = collected_errors[-1] if collected_errors else "échec inconnu"
        logger.error(f"[generate_video_live] Tous les essais VEO ont échoué: {detail}")
        return (
            "La génération vidéo VEO a échoué. "
            f"Dernier détail technique: {detail}. "
            "Je n'ai renvoyé aucune vidéo de démonstration."
        )

    try:
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"gen_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        public_url = None

        try:
            from core.firebase_client import firebase_storage as storage

            public_url = storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path,
                file_bytes=video_bytes,
                content_type="video/mp4",
            )
            if public_url:
                try:
                    memory = SessionMemory(session_id=session_id, user_id=user_id)
                    memory.save_file_record(
                        file_name=video_name,
                        file_url=public_url,
                        file_type="video",
                        mime_type="video/mp4",
                        file_size=len(video_bytes),
                    )
                except Exception as exc:
                    logger.error(f"Erreur SQL vidéo: {exc}")
        except Exception as exc:
            logger.warning(f"[generate_video_live] Upload échoué: {exc}")

        video_obj = {
            "prompt": prompt,
            "type": "video/mp4",
            "name": video_name,
            "url": public_url,
            "ephemeral": not bool(public_url),
        }
        if not public_url:
            video_obj["data"] = base64.b64encode(video_bytes).decode("utf-8")

        current_media.append(video_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        try:
            from core.database import SessionLocal as _SL, UsageLedger as _UL
            from core.config import MEDIA_PRICING
            import uuid as _uuid

            model_lower = (applied_model or "").lower()
            if "veo-2" in model_lower:
                video_cost = MEDIA_PRICING.get("veo-2", 0.05) * 8
            else:
                video_cost = MEDIA_PRICING.get("veo-3", 0.35) * 8

            db = _SL()
            db.add(_UL(
                id=str(_uuid.uuid4()),
                user_id=user_id,
                model_name=applied_model or "veo-3.0-generate-001",
                action_kind="video_gen",
                prompt_tokens=0,
                candidate_tokens=0,
                total_tokens=0,
                cost_usd=video_cost,
                usage_metadata={
                    "prompt": prompt[:200],
                    "veo_prompt": veo_prompt[:300],
                    "backend": backend_label or "unknown",
                },
            ))
            db.commit()
            db.close()
        except Exception as exc:
            logger.warning(f"[generate_video_live] Erreur log UsageLedger: {exc}")

        if public_url:
            return f"Vidéo générée avec {applied_model} via {backend_label} et sauvegardée."
        return f"Vidéo générée avec {applied_model} via {backend_label}. Téléchargez-la avant de quitter."
    except Exception as exc:
        logger.error(f"[generate_video_live] Erreur de traitement: {exc}")
        return "Vidéo générée mais erreur de traitement."


@tool("edit_video_clip")
async def edit_video_clip_live(
    prompt: str,
    source_image_url: Optional[str] = None,
    duration_seconds: int = 8,
    config: RunnableConfig = None,
) -> str:
    """Generate or edit a clip with an optional source image using the live Veo backend."""
    user_id, session_id, req_id, current_media = _get_runtime_scope(config)
    translated_prompt = await _translate_video_prompt_to_english(prompt)
    veo_prompt = _build_video_prompt(prompt, translated_prompt)
    negative_prompt = _build_video_negative_prompt(prompt)
    aspect_ratio = _infer_video_aspect_ratio(prompt)
    limited_duration = max(5, min(duration_seconds, 15))

    reference_images = []
    if source_image_url:
        try:
            image_ref, _, _, _, _ = _resolve_latest_image_reference(config, source_image_url)
            if not image_ref:
                return f"Erreur: impossible de récupérer l'image source {source_image_url}"
            image_bytes = await _load_image_bytes(image_ref)
            image_mime_type = str(image_ref.get("type") or "image/jpeg").strip() or "image/jpeg"
            reference_images = [
                types.VideoGenerationReferenceImage(
                    image=types.Image(image_bytes=image_bytes, mime_type=image_mime_type),
                    reference_type=types.VideoGenerationReferenceType.ASSET,
                )
            ]
        except Exception as exc:
            logger.warning(f"[edit_video_clip_live] Échec du chargement de l'image source: {exc}")
            return f"Erreur: Impossible de charger l'image depuis {source_image_url}"

    client_candidates = _build_video_clients()
    if not client_candidates:
        return "La génération vidéo est désactivée: aucune configuration VEO valide n'est disponible."

    video_bytes: Optional[bytes] = None
    applied_model: Optional[str] = None
    backend_label: Optional[str] = None
    collected_errors: List[str] = []

    for candidate_label, client in client_candidates:
        for model_name in _video_model_candidates(prompt):
            try:
                def _call_veo_and_wait(selected_model: str = model_name):
                    import time as _time

                    operation = client.models.generate_videos(
                        model=selected_model,
                        prompt=veo_prompt,
                        config=types.GenerateVideosConfig(
                            aspect_ratio=aspect_ratio,
                            number_of_videos=1,
                            duration_seconds=limited_duration,
                            enhance_prompt=True,
                            negative_prompt=negative_prompt,
                            reference_images=reference_images or None,
                        ),
                    )
                    max_wait, elapsed = 300, 0
                    while not operation.done:
                        if elapsed >= max_wait:
                            raise TimeoutError(f"VEO timeout après {max_wait}s")
                        _time.sleep(10)
                        elapsed += 10
                        operation = client.operations.get(operation)
                    return operation

                operation = await asyncio.wait_for(asyncio.to_thread(_call_veo_and_wait), timeout=330)
                if not operation.done:
                    continue

                response = getattr(operation, "response", None) or getattr(operation, "result", None)
                if not response or not getattr(response, "generated_videos", None):
                    raise RuntimeError("Aucune vidéo n'a été générée.")

                video_bytes = await _download_generated_video_bytes(getattr(response.generated_videos[0], "video", None))
                if not video_bytes:
                    raise RuntimeError("La réponse VEO ne contient aucune vidéo exploitable.")

                applied_model = model_name
                backend_label = candidate_label
                break
            except asyncio.TimeoutError:
                collected_errors.append(f"{candidate_label}/{model_name}: timeout")
            except Exception as exc:
                collected_errors.append(f"{candidate_label}/{model_name}: {exc}")
                logger.error(f"[edit_video_clip_live] {candidate_label}/{model_name}: {exc}")
        if video_bytes:
            break

    if not video_bytes:
        detail = collected_errors[-1] if collected_errors else "échec inconnu"
        return (
            "La génération vidéo VEO a échoué. "
            f"Dernier détail technique: {detail}. "
            "Je n'ai renvoyé aucune vidéo de démonstration."
        )

    try:
        file_uuid = str(uuid.uuid4())[:8]
        video_name = f"edit_{file_uuid}.mp4"
        storage_path = f"users/{user_id}/conversations/{session_id}/{video_name}"
        public_url = None

        try:
            from core.firebase_client import firebase_storage as storage

            public_url = storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path,
                file_bytes=video_bytes,
                content_type="video/mp4",
            )
        except Exception as exc:
            logger.warning(f"[edit_video_clip_live] Upload échoué: {exc}")

        video_obj = {
            "prompt": prompt,
            "type": "video/mp4",
            "name": video_name,
            "url": public_url,
            "ephemeral": not bool(public_url),
        }
        if not public_url:
            video_obj["data"] = base64.b64encode(video_bytes).decode("utf-8")

        current_media.append(video_obj)
        if req_id:
            _GLOBAL_IMAGE_REGISTRY[req_id] = current_media
        _generated_images.set(current_media)

        if public_url:
            return f"Vidéo générée avec {applied_model} via {backend_label}. URL: {public_url}"
        return f"Vidéo générée avec {applied_model} via {backend_label}. Téléchargez-la avant de quitter."
    except Exception as exc:
        logger.error(f"[edit_video_clip_live] Erreur de traitement: {exc}")
        return f"Erreur lors de l'édition de la vidéo : {exc}"


MEDIA_TOOLS = [
    generate_image,
    generate_video_live,
    animate_image,
    edit_image_zone,
    edit_video_clip_live,
    remove_background,
    change_background,
    create_skill,
    list_skills,
    use_skill,
]

MEDIA_SYSTEM_PROMPT = """Tu es le Worker Médias de FLARE AI. Ton rôle : créer des contenus visuels de qualité professionnelle.

OUTILS :
- `generate_image(prompt)` : Imagen 4 Ultra / Gemini Pro Image. Génère une image from scratch.
- `generate_video(prompt)` : VEO 3 (vidéo from scratch).
- `animate_image(image_url, motion_prompt)` : anime une image existante via VEO (conserve visage, couleurs, composition). Utiliser dès que l'utilisateur veut "animer", "mettre en mouvement", "faire bouger" une image.
- `remove_background(image_url)` : supprime le fond d'une image → PNG transparent. Utiliser pour "fond transparent", "découper", "enlever le fond", "supprimer le fond", "fond blanc".
- `change_background(image_url, background_description)` : remplace le fond tout en gardant le sujet intact. Utiliser pour "changer le fond", "mettre dans un bureau", "changer le décor", "nouvel arrière-plan". background_description TOUJOURS en ANGLAIS.
- `edit_image_zone(file_url, mask_url, prompt)` : inpainting (modifie une zone masquée).
- `edit_video_clip(prompt, source_image_url, duration_seconds)` : clip vidéo avec image de référence optionnelle.

RÈGLE CRITIQUE — PROMPTS EN ANGLAIS PROFESSIONNEL :
Tous les prompts passés aux outils DOIVENT être en ANGLAIS et enrichis pour un maximum de qualité visuelle.

Formule : [SUJET] + [STYLE/MEDIUM] + [ÉCLAIRAGE] + [COMPOSITION] + [QUALITÉ]

Exemples de transformation :
- "un chat" → "A majestic cat with piercing green eyes, professional pet photography, soft natural window lighting, shallow depth of field, DSLR quality, 8K resolution"
- "logo entreprise tech" → "Modern minimalist tech company logo, clean vector design, geometric shapes, gradient blue to purple, white background, professional branding, print ready"
- "paysage montagne" → "Breathtaking mountain landscape at golden hour, panoramic view, dramatic clouds, snow-capped peaks, cinematic photography, vivid colors, National Geographic style"
- "portrait homme business" → "Professional business headshot of a confident man in a navy suit, studio lighting with softbox, neutral gray background, sharp focus on eyes, corporate photography"

RÈGLES ABSOLUES :
- **TOUJOURS appeler un outil.** INTERDICTION ABSOLUE de décrire ou simuler une image/vidéo en texte.
- Ne JAMAIS écrire "[Image générée : ...]" ou "[Vidéo générée : ...]" — appelle l'outil, point.
- Exécute immédiatement. Zéro confirmation.
- Pour animer → `animate_image` (pas `generate_video`).
- `motion_prompt` en ANGLAIS : "subtle breathing, gentle head turn, natural eye blink, cinematic camera".
- Réponse après génération : 1 phrase en français max.

- Si une image rÃ©cente est disponible dans le contexte de conversation, utilise-la directement pour les demandes implicites comme "anime-la", "anime maintenant", "mets-la en mouvement". Ne demande pas d'URL si cette image rÃ©cente est dÃ©jÃ  connue.

[SUGGESTION: action 1]
[SUGGESTION: action 2]"""


class MediaWorker:
    """Worker spécialisé médias & création — graphe LangGraph autonome."""

    def __init__(self, model_override: str = None):
        self.tools = MEDIA_TOOLS
        base_llm = get_llm(
            temperature=0.7,
            model_override=model_override or "gemini-2.5-flash",
        )
        # llm_forced : premier appel — FORCE l'appel d'outil (interdit la réponse textuelle seule)
        self.llm_forced = base_llm.bind_tools(self.tools, tool_choice="any")
        # llm : appels suivants (après un tool_result, on laisse choisir librement)
        self.llm = base_llm.bind_tools(self.tools)
        self.tool_node = ToolNode(self.tools)
        self.graph = self._build_graph()
        logger.info(f"[MediaWorker] Initialisé avec {len(self.tools)} outils")

    def _build_graph(self):
        graph = StateGraph(TypedDict("MediaState", {"messages": Annotated[Sequence[BaseMessage], operator.add]}))
        graph.add_node("agent", self._call_model)
        graph.add_node("tools", self.tool_node)
        graph.set_entry_point("agent")
        graph.add_conditional_edges("agent", self._should_continue, {"continue": "tools", "end": END})
        graph.add_edge("tools", "agent")
        return graph.compile()

    def _should_continue(self, state) -> Literal["continue", "end"]:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "continue"
        return "end"

    async def _call_model(self, state, config: RunnableConfig = None) -> dict:
        import asyncio
        from langchain_core.messages import ToolMessage
        messages = state["messages"]
        # Premier appel (pas encore de ToolMessage) → force l'appel d'outil
        has_tool_result = any(isinstance(m, ToolMessage) for m in messages)
        llm = self.llm if has_tool_result else self.llm_forced
        for attempt in range(3):
            try:
                response = await llm.ainvoke(messages)
                if not has_tool_result and not (hasattr(response, "tool_calls") and response.tool_calls):
                    logger.warning("[MediaWorker] Réponse texte sans outil au tour %s", attempt + 1)
                    if attempt < 2:
                        forced_msgs = list(messages)
                        last = forced_msgs[-1]
                        if hasattr(last, "content") and isinstance(last.content, str):
                            forced_msgs[-1] = HumanMessage(content=last.content + _MEDIA_TOOL_RETRY_DIRECTIVE)
                        messages = forced_msgs
                        llm = self.llm
                        continue
                    return {
                        "messages": [
                            AIMessage(
                                content=(
                                    "Je n'ai pas pu lancer un outil media fiable pour cette demande. "
                                    "Demande une seule action précise, par exemple "
                                    "\"anime cette image\" ou \"génère une nouvelle image du studio vue de face\"."
                                )
                            )
                        ]
                    }
                return {"messages": [response]}
            except Exception as e:
                err_str = str(e).lower()
                if attempt < 2 and any(k in err_str for k in ["429", "500", "503"]):
                    await asyncio.sleep(2 ** (attempt + 1))
                    continue
                # Si tool_choice="any" échoue → injecter une directive forcée dans le message
                if not has_tool_result and ("tool_choice" in err_str or "any" in err_str or "unsupported" in err_str):
                    logger.warning(f"[MediaWorker] tool_choice=any non supporté, injection directive forcée")
                    forced_msgs = list(messages)
                    last = forced_msgs[-1]
                    if hasattr(last, "content") and isinstance(last.content, str):
                        forced_msgs[-1] = HumanMessage(content=last.content + _MEDIA_TOOL_RETRY_DIRECTIVE)
                    messages = forced_msgs
                    llm = self.llm
                    continue
                raise

    async def run(self, task: str, config: dict = None) -> str:
        from langchain_core.messages import ToolMessage

        messages = [HumanMessage(content=f"[Instructions]\n{MEDIA_SYSTEM_PROMPT}\n[Fin instructions]\n\n{task}")]
        result = await self.graph.ainvoke({"messages": messages}, config=config or {})
        last_msg = result["messages"][-1]
        content = _message_text(last_msg)
        had_tool_result = any(isinstance(msg, ToolMessage) for msg in result["messages"])
        if not had_tool_result and _media_text_response_without_tool(last_msg):
            return (
                "Je n'ai pas pu produire un média exploitable pour cette demande. "
                "Je peux animer l'image existante, changer son fond, ou générer une nouvelle image à partir d'une description précise."
            )
        return content or "Tâche média terminée."







