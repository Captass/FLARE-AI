"""
Connecteur Google Sheets (MCP).
Opérations CRUD sur des classeurs Google Sheets via l'API officielle.

Prérequis : GOOGLE_SERVICE_ACCOUNT_JSON configuré dans .env
"""
import json
from typing import List, Any, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

from core.config import settings

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def _get_service():
    """Crée et retourne un client Google Sheets authentifié."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError(
            "GOOGLE_SERVICE_ACCOUNT_JSON non configuré dans .env\n"
            "Créez un Service Account sur Google Cloud Console et collez le JSON ici."
        )
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    return build("sheets", "v4", credentials=creds)


def read_range(spreadsheet_id: str, range_name: str) -> List[List[Any]]:
    """
    Lit une plage de cellules dans un classeur Google Sheets.

    Args:
        spreadsheet_id: L'ID du classeur (dans l'URL)
        range_name: Plage au format A1 (ex: 'Feuille1!A1:D10')

    Returns:
        Liste de listes représentant les lignes et colonnes
    """
    service = _get_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_name)
        .execute()
    )
    return result.get("values", [])


def write_range(spreadsheet_id: str, range_name: str, values: List[List[Any]]) -> dict:
    """
    Écrit des données dans une plage de cellules.

    Args:
        spreadsheet_id: L'ID du classeur
        range_name: Plage cible (ex: 'Feuille1!A1')
        values: Données à écrire (liste de listes)

    Returns:
        Résultat de l'API
    """
    service = _get_service()
    body = {"values": values}
    result = (
        service.spreadsheets()
        .values()
        .update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption="USER_ENTERED",
            body=body,
        )
        .execute()
    )
    return result


def append_row(spreadsheet_id: str, sheet_name: str, row: List[Any]) -> dict:
    """
    Ajoute une ligne à la fin d'une feuille.

    Args:
        spreadsheet_id: L'ID du classeur
        sheet_name: Nom de la feuille (ex: 'Leads')
        row: La ligne à ajouter (liste de valeurs)

    Returns:
        Résultat de l'API
    """
    service = _get_service()
    body = {"values": [row]}
    result = (
        service.spreadsheets()
        .values()
        .append(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A1",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body=body,
        )
        .execute()
    )
    return result


def format_cells(
    spreadsheet_id: str,
    sheet_id: int,
    start_row: int,
    end_row: int,
    start_col: int,
    end_col: int,
    background_color: Optional[dict] = None,
    bold: bool = False,
) -> dict:
    """
    Formate des cellules (couleur de fond, gras).

    Args:
        spreadsheet_id: L'ID du classeur
        sheet_id: ID numérique de la feuille (0 = première feuille)
        start_row, end_row: Lignes (0-indexées)
        start_col, end_col: Colonnes (0-indexées)
        background_color: Dict RGB ex: {"red": 1.0, "green": 0.5, "blue": 0.0}
        bold: Mettre en gras

    Returns:
        Résultat de l'API
    """
    service = _get_service()

    cell_format = {}
    if background_color:
        cell_format["backgroundColor"] = background_color
    if bold:
        cell_format["textFormat"] = {"bold": True}

    requests = [
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": start_row,
                    "endRowIndex": end_row,
                    "startColumnIndex": start_col,
                    "endColumnIndex": end_col,
                },
                "cell": {"userEnteredFormat": cell_format},
                "fields": "userEnteredFormat",
            }
        }
    ]

    result = (
        service.spreadsheets()
        .batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": requests},
        )
        .execute()
    )
    return result


def create_sheet(spreadsheet_id: str, sheet_title: str) -> dict:
    """Ajoute une nouvelle feuille à un classeur existant."""
    service = _get_service()
    result = (
        service.spreadsheets()
        .batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": [{"addSheet": {"properties": {"title": sheet_title}}}]},
        )
        .execute()
    )
    return result


def create_spreadsheet(title: str, sheet_names: Optional[List[str]] = None) -> dict:
    """
    Crée un nouveau classeur Google Sheets.

    Args:
        title: Titre du classeur
        sheet_names: Noms des feuilles à créer (défaut: ['Feuille1'])

    Returns:
        Dictionnaire avec spreadsheetId, title, spreadsheetUrl
    """
    service = _get_service()
    sheets = [{"properties": {"title": name}} for name in (sheet_names or ["Feuille1"])]
    body = {"properties": {"title": title}, "sheets": sheets}
    result = service.spreadsheets().create(body=body, fields="spreadsheetId,spreadsheetUrl,properties").execute()
    return {
        "spreadsheetId": result.get("spreadsheetId"),
        "title": result.get("properties", {}).get("title"),
        "spreadsheetUrl": result.get("spreadsheetUrl"),
        "status": "créé",
    }


def list_spreadsheets_in_drive(max_results: int = 20) -> List[dict]:
    """
    Liste les classeurs Google Sheets accessibles via Drive.

    Args:
        max_results: Nombre maximum de classeurs à retourner
    """
    from googleapiclient.discovery import build as _build
    from google.oauth2 import service_account as _sa
    import json as _json
    from core.config import settings as _settings

    creds_dict = _json.loads(_settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = _sa.Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    drive = _build("drive", "v3", credentials=creds)
    results = drive.files().list(
        q="mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        pageSize=max_results,
        fields="files(id, name, webViewLink, modifiedTime)",
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


def batch_read(spreadsheet_id: str, ranges: List[str]) -> dict:
    """
    Lit plusieurs plages en une seule requête API.

    Args:
        spreadsheet_id: ID du classeur
        ranges: Liste de plages (ex: ['Feuille1!A1:C10', 'Planning!B2:D20'])

    Returns:
        Dictionnaire {range: values}
    """
    service = _get_service()
    result = service.spreadsheets().values().batchGet(
        spreadsheetId=spreadsheet_id,
        ranges=ranges,
    ).execute()
    output = {}
    for vr in result.get("valueRanges", []):
        output[vr.get("range", "")] = vr.get("values", [])
    return output


def delete_rows(spreadsheet_id: str, sheet_id: int, start_index: int, end_index: int) -> dict:
    """
    Supprime des lignes dans une feuille.

    Args:
        spreadsheet_id: ID du classeur
        sheet_id: ID numérique de la feuille (0 = première feuille)
        start_index: Première ligne à supprimer (0-indexé)
        end_index: Dernière ligne (exclus)
    """
    service = _get_service()
    result = service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": start_index,
                            "endIndex": end_index,
                        }
                    }
                }
            ]
        },
    ).execute()
    return {"status": f"Lignes {start_index}→{end_index} supprimées"}


def get_spreadsheet_info(spreadsheet_id: str) -> dict:
    """
    Retourne les métadonnées d'un classeur (titre, liste des feuilles, etc.).

    Args:
        spreadsheet_id: ID du classeur
    """
    service = _get_service()
    result = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields="properties,sheets.properties",
    ).execute()
    sheets = [
        {
            "sheetId": s["properties"]["sheetId"],
            "title": s["properties"]["title"],
            "rowCount": s["properties"].get("gridProperties", {}).get("rowCount", 0),
            "colCount": s["properties"].get("gridProperties", {}).get("columnCount", 0),
        }
        for s in result.get("sheets", [])
    ]
    return {
        "spreadsheetId": spreadsheet_id,
        "title": result.get("properties", {}).get("title", ""),
        "locale": result.get("properties", {}).get("locale", ""),
        "sheets": sheets,
    }
