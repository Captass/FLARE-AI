from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import logging
from core.config import settings
from core.database import (
    get_local_folders,
    create_local_folder,
    update_local_folder,
    delete_local_folder
)

router = APIRouter(prefix="/folders", tags=["Folders"])
logger = logging.getLogger(__name__)

class FolderIn(BaseModel):
    name: str
    color: Optional[str] = "#FF7C1A"

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

from core.auth import get_user_id_from_header

@router.get("")
async def list_folders(authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    return get_local_folders(user_id)

@router.post("")
async def add_folder(folder: FolderIn, authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    folder_id = create_local_folder(user_id, folder.name, folder.color)
    return {"id": folder_id, "name": folder.name, "color": folder.color}

@router.patch("/{folder_id}")
async def edit_folder(folder_id: str, folder: FolderUpdate, authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    ok = update_local_folder(user_id, folder_id, name=folder.name, color=folder.color)
    
    if not ok:
        raise HTTPException(status_code=404, detail="Dossier introuvable.")
    return {"success": True}

@router.delete("/{folder_id}")
async def remove_folder(folder_id: str, authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_header(authorization)
    ok = delete_local_folder(user_id, folder_id)
    
    if not ok:
        raise HTTPException(status_code=404, detail="Dossier introuvable.")
    return {"success": True}
