"""
Connecteur Google Docs (MCP).
Création, lecture et modification de documents Google Docs.

Prérequis : GOOGLE_SERVICE_ACCOUNT_JSON configuré dans .env
Le Service Account peut créer des documents et lire ceux partagés avec lui.
"""
import json
from typing import List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]


def _get_docs_service():
    """Crée un client Google Docs authentifié."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON non configuré dans .env")
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    return build("docs", "v1", credentials=creds)


def _get_drive_service():
    """Client Drive pour gérer les fichiers Docs."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON non configuré dans .env")
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


def create_document(title: str, content: str = "") -> dict:
    """
    Crée un nouveau document Google Docs.

    Args:
        title: Titre du document
        content: Contenu initial du document (texte brut)

    Returns:
        Dictionnaire avec documentId, title, webViewLink
    """
    service = _get_docs_service()
    drive = _get_drive_service()

    doc = service.documents().create(body={"title": title}).execute()
    doc_id = doc["documentId"]

    if content:
        service.documents().batchUpdate(
            documentId=doc_id,
            body={
                "requests": [
                    {
                        "insertText": {
                            "location": {"index": 1},
                            "text": content,
                        }
                    }
                ]
            },
        ).execute()

    file_meta = drive.files().get(
        fileId=doc_id, fields="webViewLink"
    ).execute()

    return {
        "documentId": doc_id,
        "title": title,
        "webViewLink": file_meta.get("webViewLink", ""),
        "status": "créé",
    }


def read_document(document_id: str) -> dict:
    """
    Lit le contenu d'un Google Doc.

    Args:
        document_id: L'ID du document (dans l'URL)

    Returns:
        Dictionnaire avec title et le texte extrait
    """
    service = _get_docs_service()
    doc = service.documents().get(documentId=document_id).execute()
    title = doc.get("title", "Sans titre")

    text_parts = []
    for element in doc.get("body", {}).get("content", []):
        paragraph = element.get("paragraph")
        if paragraph:
            for pe in paragraph.get("elements", []):
                text_run = pe.get("textRun")
                if text_run:
                    text_parts.append(text_run.get("content", ""))

    return {
        "documentId": document_id,
        "title": title,
        "content": "".join(text_parts),
        "revision": doc.get("revisionId", ""),
    }


def append_to_document(document_id: str, text: str, add_newline: bool = True) -> dict:
    """
    Ajoute du texte à la fin d'un Google Doc.

    Args:
        document_id: ID du document
        text: Texte à ajouter
        add_newline: Ajouter un saut de ligne avant le texte
    """
    service = _get_docs_service()
    doc = service.documents().get(documentId=document_id).execute()
    end_index = doc["body"]["content"][-1]["endIndex"] - 1

    content = ("\n" + text) if add_newline else text
    service.documents().batchUpdate(
        documentId=document_id,
        body={
            "requests": [
                {
                    "insertText": {
                        "location": {"index": end_index},
                        "text": content,
                    }
                }
            ]
        },
    ).execute()
    return {"documentId": document_id, "status": "texte ajouté", "characters_added": len(content)}


def list_documents(max_results: int = 20) -> List[dict]:
    """
    Liste les Google Docs récents accessibles par le Service Account.

    Args:
        max_results: Nombre maximum de documents à retourner
    """
    drive = _get_drive_service()
    results = drive.files().list(
        q="mimeType='application/vnd.google-apps.document' and trashed=false",
        pageSize=max_results,
        fields="files(id, name, webViewLink, createdTime, modifiedTime)",
        orderBy="modifiedTime desc",
    ).execute()
    return [
        {
            "id": f["id"],
            "name": f["name"],
            "webViewLink": f.get("webViewLink", ""),
            "modified": f.get("modifiedTime", ""),
        }
        for f in results.get("files", [])
    ]


def replace_text_in_document(document_id: str, old_text: str, new_text: str) -> dict:
    """
    Remplace toutes les occurrences d'un texte dans un document.

    Args:
        document_id: ID du document
        old_text: Texte à remplacer
        new_text: Nouveau texte
    """
    service = _get_docs_service()
    result = service.documents().batchUpdate(
        documentId=document_id,
        body={
            "requests": [
                {
                    "replaceAllText": {
                        "containsText": {"text": old_text, "matchCase": False},
                        "replaceText": new_text,
                    }
                }
            ]
        },
    ).execute()
    replacements = result.get("replies", [{}])[0].get("replaceAllText", {}).get("occurrencesChanged", 0)
    return {
        "documentId": document_id,
        "status": "texte remplacé",
        "occurrences_changed": replacements,
    }
