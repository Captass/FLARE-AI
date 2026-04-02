
from .copywriter_agent import CopywriterAgent
from .graphic_designer_agent import GraphicDesignerAgent
from .video_editor_agent import VideoEditorAgent

class ContentStudioSupervisor:
    def __init__(self):
        self.copywriter = CopywriterAgent()
        self.designer = GraphicDesignerAgent()
        self.video_editor = VideoEditorAgent()

    async def generate_text(self, request):
        """Delegates text generation to the CopywriterAgent."""
        async for chunk in self.copywriter.generate(request):
            yield chunk

    async def generate_visual(self, request):
        """Delegates visual generation to the GraphicDesignerAgent."""
        return await self.designer.generate(request)

    async def edit_video(self, request):
        """Delegates video editing to the VideoEditorAgent."""
        return await self.video_editor.edit(request)






