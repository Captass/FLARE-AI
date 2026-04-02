
import os
import google.generativeai as genai

# Based on SPEC.md, GEMINI_API_KEY is available.
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
genai.configure(api_key=API_KEY)

class CopywriterAgent:
    def __init__(self, model_name="gemini-2.5-flash-latest"): 
        self.model = genai.GenerativeModel(model_name)

    def _create_prompt(self, request):
        return f"""Act as a professional copywriter.

        **Platform:** {request.platform}
        **Tone:** {request.tone}
        **Objective:** {request.type}
        **Language:** {request.language}
        **Brand Context:** {request.brand_context or 'Not specified'}

        **Brief:**
        {request.brief}

        Generate the content based on the brief. The output should be in Markdown.
        """

    async def generate(self, request):
        """Generates and streams text content based on the provided brief."""
        prompt = self._create_prompt(request)
        try:
            # Using stream=True for SSE (Server-Sent Events)
            response_stream = await self.model.generate_content_async(prompt, stream=True)
            async for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            print(f"[CopywriterAgent] Error during text generation: {e}")
            # The error will be caught and handled by the router's SSE stream
            raise






