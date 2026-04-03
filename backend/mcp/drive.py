"""
Connecteur Google Drive (MCP).
Recherche et récupération de fichiers depuis Google Drive.

Prérequis : GOOGLE_SERVICE_ACCOUNT_JSON configuré dans .env
"""
import json
from typing import List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
]


def _get_service():
    """Crée et retourne un client Google Drive authentifié."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError(
            "GOOGLE_SERVICE_ACCOUNT_JSON non configuré dans .env\n"
            "Créez un Service Account sur Google Cloud Console et collez le JSON ici."
        )
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


def search_files(query: str, folder_id: Optional[str] = None, max_results: int = 10) -> List[dict]:
    """
    Recherche des fichiers sur Google Drive.

    Args:
        query: Terme de recherche (fullText contient le terme)
        folder_id: Limiter la recherche à un dossier spécifique (optionnel)
        max_results: Nombre maximum de résultats

    Returns:
        Liste de fichiers avec id, name, mimeType, webViewLink
    """
    service = _get_service()

    q_parts = [f"fullText contains '{query}'", "trashed = false"]
    if folder_id:
        q_parts.append(f"'{folder_id}' in parents")

    results = (
        service.files()
        .list(
            q=" and ".join(q_parts),
            pageSize=max_results,
            fields="files(id, name, mimeType, webViewLink, size, createdTime, modifiedTime)",
        )
        .execute()
    )
    return results.get("files", [])


def list_folder(folder_id: str, max_results: int = 50) -> List[dict]:
    """
    Liste le contenu d'un dossier Google Drive.

    Args:
        folder_id: L'ID du dossier
        max_results: Nombre maximum de fichiers à retourner

    Returns:
        Liste de fichiers et sous-dossiers
    """
    service = _get_service()
    results = (
        service.files()
        .list(
            q=f"'{folder_id}' in parents and trashed = false",
            pageSize=max_results,
            fields="files(id, name, mimeType, webViewLink, size)",
            orderBy="name",
        )
        .execute()
    )
    return results.get("files", [])


def get_file_metadata(file_id: str) -> dict:
    """
    Récupère les métadonnées d'un fichier.

    Args:
        file_id: L'ID du fichier Drive

    Returns:
        Dictionnaire avec name, mimeType, webViewLink, size, etc.
    """
    service = _get_service()
    return (
        service.files()
        .get(
            fileId=file_id,
            fields="id, name, mimeType, webViewLink, description, size",
        )
        .execute()
    )


def get_file_content(file_id: str) -> bytes:
    """
    Télécharge le contenu binaire d'un fichier.
    Utile pour les images du catalogue FLARE AI.

    Args:
        file_id: L'ID du fichier Drive

    Returns:
        Contenu du fichier en bytes
    """
    service = _get_service()
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return fh.getvalue()


def get_file_web_link(file_id: str) -> str:
    """
    Retourne le lien web public d'un fichier Drive.
    Utile pour envoyer des images via Messenger.
    """
    metadata = get_file_metadata(file_id)
    return metadata.get("webViewLink", "")


def create_folder(name: str, parent_folder_id: Optional[str] = None) -> dict:
    """Crée un dossier sur Google Drive."""
    service = _get_service()
    metadata = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_folder_id:
        metadata["parents"] = [parent_folder_id]
    result = service.files().create(body=metadata, fields="id, name, webViewLink").execute()
    return {"id": result.get("id"), "name": result.get("name"), "webViewLink": result.get("webViewLink", ""), "status": "créé"}


def upload_text_as_file(filename: str, content: str, mimetype: str = "text/plain", folder_id: Optional[str] = None) -> dict:
    """Crée un fichier texte sur Google Drive."""
    from googleapiclient.http import MediaInMemoryUpload
    service = _get_service()
    metadata = {"name": filename}
    if folder_id:
        metadata["parents"] = [folder_id]
    media = MediaInMemoryUpload(content.encode("utf-8"), mimetype=mimetype)
    result = service.files().create(body=metadata, media_body=media, fields="id, name, webViewLink").execute()
    return {"id": result.get("id"), "name": result.get("name"), "webViewLink": result.get("webViewLink", ""), "status": "uploadé"}


def share_file(file_id: str, email: str, role: str = "reader") -> dict:
    """Partage un fichier Drive avec un utilisateur (roles: reader, commenter, writer)."""
    service = _get_service()
    result = service.permissions().create(
        fileId=file_id, body={"type": "user", "role": role, "emailAddress": email}, sendNotificationEmail=True
    ).execute()
    return {"fileId": file_id, "email": email, "role": role, "status": "partagé"}


def move_file(file_id: str, new_folder_id: str) -> dict:
    """Déplace un fichier vers un autre dossier."""
    service = _get_service()
    file = service.files().get(fileId=file_id, fields="parents").execute()
    previous_parents = ",".join(file.get("parents", []))
    result = service.files().update(
        fileId=file_id, addParents=new_folder_id, removeParents=previous_parents, fields="id, name"
    ).execute()
    return {"id": result.get("id"), "name": result.get("name"), "status": "déplacé"}


def copy_file(file_id: str, new_name: str, folder_id: Optional[str] = None) -> dict:
    """Copie un fichier Drive."""
    service = _get_service()
    body = {"name": new_name}
    if folder_id:
        body["parents"] = [folder_id]
    result = service.files().copy(fileId=file_id, body=body, fields="id, name, webViewLink").execute()
    return {"id": result.get("id"), "name": result.get("name"), "webViewLink": result.get("webViewLink", ""), "status": "copié"}


def trash_file(file_id: str) -> dict:
    """Met un fichier à la corbeille."""
    service = _get_service()
    service.files().update(fileId=file_id, body={"trashed": True}).execute()
    return {"id": file_id, "status": "mis à la corbeille"}


def get_storage_quota() -> dict:
    """Retourne les informations de quota de stockage Google Drive."""
    service = _get_service()
    about = service.about().get(fields="storageQuota,user").execute()
    quota = about.get("storageQuota", {})
    user = about.get("user", {})
    def _fmt_gb(val: str) -> str:
        try:
            return f"{int(val) / (1024**3):.2f} Go"
        except Exception:
            return val
    return {
        "user": user.get("emailAddress", ""),
        "limit": _fmt_gb(quota.get("limit", "0")),
        "usage": _fmt_gb(quota.get("usage", "0")),
        "usage_in_drive": _fmt_gb(quota.get("usageInDrive", "0")),
    }
