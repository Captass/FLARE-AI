from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory job store for this PoC. A real system would use Redis or a database.
jobs = {}
_supervisor = None


class TextGenerationRequest(BaseModel):
    project_id: str
    type: str
    platform: str
    tone: str
    brief: str
    brand_context: str | None = None
    language: str


class VisualGenerationRequest(BaseModel):
    project_id: str
    format: str
    brief: str


class ProjectRequest(BaseModel):
    name: str
    description: str | None = None


class VideoEditRequest(BaseModel):
    project_id: str
    source_videos: list[str]
    instructions: str
    target_resolution: str
    export_quality: str = "high"
    fps: int = 30
    output_format: str = "mp4"


class JobResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: dict | None = None
    error: str | None = None


def _get_supervisor():
    global _supervisor
    if _supervisor is not None:
        return _supervisor
    try:
        from agents.content_studio.supervisor import ContentStudioSupervisor
        _supervisor = ContentStudioSupervisor()
        return _supervisor
    except Exception as exc:
        logger.exception("Content Studio indisponible au chargement")
        raise HTTPException(
            status_code=503,
            detail=f"Content Studio indisponible: {exc}",
        ) from exc


async def run_video_edit_job(job_id: str, request: VideoEditRequest):
    """Wrapper to run the video edit task and update job status."""
    try:
        result = await _get_supervisor().edit_video(request)
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["result"] = result
    except Exception as exc:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(exc)


@router.post("/api/content-studio/video/edit", response_model=JobResponse, tags=["Content Studio"])
async def edit_video_content_async(request: VideoEditRequest):
    """Accepts a video editing job and starts it in the background."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing", "result": None, "error": None}
    asyncio.create_task(run_video_edit_job(job_id, request))
    return {"job_id": job_id}


@router.get("/api/content-studio/video/status/{job_id}", response_model=JobStatusResponse, tags=["Content Studio"])
async def get_video_job_status(job_id: str):
    """Retrieves the status of a video editing job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, **job}


@router.post("/api/content-studio/generate/text", tags=["Content Studio"])
async def generate_text_content(request: TextGenerationRequest):
    """Generates text content using the copywriter agent via an SSE stream."""
    supervisor = _get_supervisor()

    async def event_stream():
        try:
            async for chunk in supervisor.generate_text(request):
                yield f"data: {json.dumps({'type': 'delta', 'content': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Erreur Content Studio texte")
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/content-studio/generate/visual", tags=["Content Studio"])
async def generate_visual_content(request: VisualGenerationRequest):
    """Generates visual content using the graphic designer agent."""
    try:
        return await _get_supervisor().generate_visual(request)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erreur Content Studio visuel")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
