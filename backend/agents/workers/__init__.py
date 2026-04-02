"""
FLARE AI — Workers spécialisés pour l'architecture Supervisor-Worker.
Chaque worker possède ses propres outils et un LLM dédié (modèle léger).
"""
from .researcher import ResearcherWorker, RESEARCHER_TOOLS
from .media import MediaWorker, MEDIA_TOOLS
from .workspace import WorkspaceWorker, WORKSPACE_TOOLS
from .document_worker import DocumentWorker, DOCUMENT_TOOLS
from .spreadsheet_worker import SpreadsheetWorker, SPREADSHEET_TOOLS

__all__ = [
    "ResearcherWorker", "RESEARCHER_TOOLS",
    "MediaWorker", "MEDIA_TOOLS",
    "WorkspaceWorker", "WORKSPACE_TOOLS",
    "DocumentWorker", "DOCUMENT_TOOLS",
    "SpreadsheetWorker", "SPREADSHEET_TOOLS",
]





