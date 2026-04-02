
import asyncio
import logging
import json
import uuid
import os
import base64
import httpx
import aiofiles
import tempfile

import google.generativeai as genai
from moviepy.editor import (
    VideoFileClip, concatenate_videoclips, CompositeVideoClip, TextClip
)

from core.config import settings
from core.firebase_client import firebase_storage

logger = logging.getLogger(__name__)

class VideoEditingError(Exception):
    """Custom exception for video editing failures."""
    pass

class VideoEditorAgent:
    def __init__(self):
        parser_model_name = getattr(settings, "GEMINI_PRO_MODEL", None) or getattr(settings, "GEMINI_MODEL", None) or "gemini-2.5-pro"
        self.parser_model = genai.GenerativeModel(parser_model_name)
        # MoviePy will use ffmpeg, path is assumed to be in ENV

    async def _parse_instructions_to_edl(self, instructions: str, num_sources: int, resolution: str) -> dict:
        prompt = f"""
        You are a Motion Designer AI. Convert the user's video editing instructions into a structured JSON timeline suitable for MoviePy. This is a high-level Edit Decision List (EDL).

        **Inputs**:
        - Instructions: "{instructions}"
        - Number of source videos: {num_sources}
        - Target resolution: {resolution}

        **JSON Output Specification**:
        You MUST only output a valid JSON object with the following structure:
        - `resolution`: An array `[width, height]`.
        - `timeline`: A list of clip objects. Each object represents a segment of the final video.
            - `source_index`: The index of the source video (from 0 to {num_sources - 1}).
            - `start_time`: The start time of the clip within the source video (in seconds).
            - `end_time`: The end time of the clip within the source video.
            - `transition`: (Optional) A transition object. e.g., `{{"type": "crossfade_in", "duration": 0.5}}`.
        - `overlays`: A list of text or image layers to be composited over the video.
            - `type`: "text" or "image".
            - `content`: The text string or URL for an image.
            - `start`: The time in the final timeline when the overlay appears.
            - `duration`: How long the overlay stays on screen.
            - `font_size`: (for text) Integer.
            - `font_color`: (for text) String (e.g., "white").
            - `position`: A tuple `(x, y)` or a string like `("center", "top")`.

        **Example Instructions**: "Start with the first 5 seconds of video 0. Then, cut to video 1 from 10s to 15s. Add a title 'My Trip' at the top center, from 0 to 3 seconds."

        **Example JSON Output**:
        ```json
        {{
          "resolution": [1920, 1080],
          "timeline": [
            {{"source_index": 0, "start_time": 0, "end_time": 5}},
            {{"source_index": 1, "start_time": 10, "end_time": 15}}
          ],
          "overlays": [
            {{"type": "text", "content": "My Trip", "start": 0, "duration": 3, "font_size": 70, "font_color": "white", "position": ["center", "top"]}}
          ]
        }}
        ```
        Now, generate the JSON for the user's instructions.
        """
        response = await self.parser_model.generate_content_async(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        try:
            return json.loads(response.text)
        except Exception as e:
            error_text = getattr(response, "text", "No text available")
            logger.error(f"""Failed to parse EDL JSON from LLM: {e}
LLM Response: {error_text}""")
            raise VideoEditingError("Failed to understand the editing instructions.")

    async def _download_source_videos(self, source_urls: list) -> list:
        temp_files = []
        MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB

        async with httpx.AsyncClient() as client:
            for i, url in enumerate(source_urls):
                try:
                    if isinstance(url, str) and url.startswith("data:video/"):
                        try:
                            header, raw_b64 = url.split(",", 1)
                            mime = header.split(";")[0].split(":", 1)[1]
                            extension = mime.split("/")[-1] or "mp4"
                            video_bytes = base64.b64decode(raw_b64)
                        except Exception as exc:
                            raise VideoEditingError("Source video inline invalide.") from exc

                        if len(video_bytes) > MAX_FILE_SIZE:
                            raise VideoEditingError("Une video source depasse la limite de 100MB.")

                        temp_path = os.path.join(tempfile.gettempdir(), f"source_{uuid.uuid4()}_{i}.{extension}")
                        async with aiofiles.open(temp_path, "wb") as f:
                            await f.write(video_bytes)
                        temp_files.append(temp_path)
                        continue

                    # First, send a HEAD request to check the file size
                    head_response = await client.head(url, follow_redirects=True, timeout=30)
                    head_response.raise_for_status()
                    
                    content_length = head_response.headers.get('content-length')
                    if not content_length or not content_length.isdigit():
                        raise VideoEditingError(f"Could not determine file size for: {url}")

                    if int(content_length) > MAX_FILE_SIZE:
                        raise VideoEditingError(f"File size for {url} exceeds the 100MB limit.")

                    # If size is acceptable, download the file
                    response = await client.get(url, follow_redirects=True, timeout=300) # Longer timeout for download
                    response.raise_for_status()
                    
                    temp_path = os.path.join(tempfile.gettempdir(), f"source_{uuid.uuid4()}_{i}.mp4")
                    async with aiofiles.open(temp_path, 'wb') as f:
                        await f.write(response.content)
                    temp_files.append(temp_path)

                except httpx.RequestError as e:
                    raise VideoEditingError(f"Failed to download or validate source video: {url}. Error: {e}")
        return temp_files

    def _build_export_settings(self, request) -> dict:
        quality = str(getattr(request, "export_quality", "high") or "high").lower()
        fps = int(getattr(request, "fps", 30) or 30)
        output_format = str(getattr(request, "output_format", "mp4") or "mp4").lower()

        quality_map = {
            "preview": {"bitrate": "3500k", "preset": "veryfast"},
            "standard": {"bitrate": "5500k", "preset": "medium"},
            "high": {"bitrate": "9000k", "preset": "slow"},
            "master": {"bitrate": "14000k", "preset": "slow"},
        }

        if output_format not in {"mp4", "mov"}:
            output_format = "mp4"

        return {
            "fps": 60 if fps >= 60 else 30 if fps >= 30 else 24,
            "format": output_format,
            **quality_map.get(quality, quality_map["high"]),
        }

    def _render_video_with_moviepy(self, edl: dict, local_paths: list, export_settings: dict) -> str:
        all_clips_to_close = []
        try:
            # 1. Bounds check and create VideoFileClip objects
            timeline_clips = []
            num_local_paths = len(local_paths)
            for segment in edl.get("timeline", []):
                source_index = segment.get("source_index")
                if not (isinstance(source_index, int) and 0 <= source_index < num_local_paths):
                    raise VideoEditingError(f"LLM provided an invalid source_index: {source_index}. Please check your brief.")

                path = local_paths[source_index]
                clip = VideoFileClip(path).subclip(segment["start_time"], segment["end_time"])
                all_clips_to_close.append(clip)
                timeline_clips.append(clip)
            
            if not timeline_clips:
                raise VideoEditingError("No valid video clips could be created from the editing instructions.")

            # 2. Concatenate the main timeline
            final_timeline = concatenate_videoclips(timeline_clips)
            all_clips_to_close.append(final_timeline)

            # 3. Create and position overlays
            overlay_clips = [final_timeline]
            for overlay in edl.get("overlays", []):
                if overlay.get("type") == "text":
                    txt_clip = TextClip(overlay["content"], fontsize=overlay.get("font_size", 70), color=overlay.get("font_color", 'white'))
                    txt_clip = txt_clip.set_pos(overlay.get("position", ("center", "center"))).set_duration(overlay["duration"]).set_start(overlay["start"])
                    all_clips_to_close.append(txt_clip)
                    overlay_clips.append(txt_clip)
            
            # 4. Composite final video
            output_resolution = edl.get("resolution", [1920, 1080])
            final_video = CompositeVideoClip(overlay_clips, size=output_resolution)
            all_clips_to_close.append(final_video)

            # 5. Write to file
            output_format = export_settings.get("format", "mp4")
            output_filename = os.path.join(tempfile.gettempdir(), f"final_{uuid.uuid4()}.{output_format}")
            final_video.write_videofile(
                output_filename, 
                codec="libx264", 
                audio_codec="aac", 
                bitrate=export_settings.get("bitrate", "9000k"),
                preset=export_settings.get("preset", "slow"),
                fps=export_settings.get("fps", 30),
                threads=4, 
                logger=None # Suppress verbose ffmpeg output
            )
            
            return output_filename
        except Exception as e:
            logger.error(f"[MoviePy] Error during rendering: {e}")
            raise VideoEditingError(f"Failed to render video. Details: {e}")
        finally:
            # 6. CRITICAL: Close all clip objects to release file handles
            for clip in all_clips_to_close:
                try:
                    clip.close()
                except Exception as e:
                    logger.warning(f"[MoviePy] Failed to close a clip resource: {e}")

    async def edit(self, request) -> dict:
        local_video_paths = []
        output_filepath = None
        try:
            # 1. Download source videos locally
            local_video_paths = await self._download_source_videos(request.source_videos)
            export_settings = self._build_export_settings(request)

            # 2. Parse instructions into EDL
            edl = await self._parse_instructions_to_edl(
                request.instructions, len(local_video_paths), request.target_resolution
            )

            # 3. Execute EDL with MoviePy (synchronous, run in thread)
            loop = asyncio.get_running_loop()
            output_filepath = await loop.run_in_executor(
                None, self._render_video_with_moviepy, edl, local_video_paths, export_settings
            )

            # 4. Upload result to storage
            with open(output_filepath, "rb") as f:
                video_bytes = f.read()
            
            user_id = "user_placeholder"
            project_id = request.project_id
            file_uuid = str(uuid.uuid4())[:8]
            output_format = export_settings.get("format", "mp4")
            content_type = "video/quicktime" if output_format == "mov" else "video/mp4"
            storage_path = f"users/{user_id}/content_studio/{project_id}/vid_{file_uuid}.{output_format}"
            
            public_url = firebase_storage.upload_file(
                bucket_name=settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                path=storage_path, 
                file_bytes=video_bytes, 
                content_type=content_type,
            )
            
            return {"video_url": public_url, "status": "done", "export": export_settings}

        finally:
            # 5. Cleanup local files
            all_files_to_clean = local_video_paths + ([output_filepath] if output_filepath else [])
            for path in all_files_to_clean:
                if path and os.path.exists(path):
                    try:
                        os.remove(path)
                    except OSError as e:
                        logger.warning(f"Failed to clean up temp file {path}: {e}")






