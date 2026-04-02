"""
Connecteur Google Calendar (MCP).
Lecture et gestion des événements via l'API Google Calendar.

Prérequis : GOOGLE_SERVICE_ACCOUNT_JSON configuré dans .env
Note : Le calendrier doit être partagé avec l'email du Service Account,
OU configurer une délégation de domaine (user_email).
"""
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

from core.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_service(user_email: Optional[str] = None):
    """Crée un client Google Calendar authentifié."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON non configuré dans .env")
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    if user_email:
        creds = creds.with_subject(user_email)
    return build("calendar", "v3", credentials=creds)


def list_events(
    calendar_id: str = "primary",
    user_email: Optional[str] = None,
    days_ahead: int = 7,
    max_results: int = 20,
) -> List[dict]:
    """
    Liste les prochains événements d'un calendrier.

    Args:
        calendar_id: ID du calendrier ('primary' ou email/ID spécifique)
        user_email: Email pour délégation (optionnel)
        days_ahead: Nombre de jours à regarder en avant
        max_results: Nombre maximum d'événements
    """
    service = _get_service(user_email=user_email)
    now = datetime.now(timezone.utc)
    time_max = now + timedelta(days=days_ahead)

    events_result = service.events().list(
        calendarId=calendar_id,
        timeMin=now.isoformat(),
        timeMax=time_max.isoformat(),
        maxResults=max_results,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = events_result.get("items", [])
    result = []
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date", ""))
        end = event["end"].get("dateTime", event["end"].get("date", ""))
        result.append({
            "id": event["id"],
            "summary": event.get("summary", "(sans titre)"),
            "start": start,
            "end": end,
            "location": event.get("location", ""),
            "description": event.get("description", ""),
            "attendees": [a.get("email") for a in event.get("attendees", [])],
            "status": event.get("status", "confirmed"),
        })
    return result


def create_event(
    summary: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    location: str = "",
    attendees: Optional[List[str]] = None,
    calendar_id: str = "primary",
    user_email: Optional[str] = None,
) -> dict:
    """
    Crée un événement dans Google Calendar.

    Args:
        summary: Titre de l'événement
        start_datetime: Début au format ISO 8601 (ex: '2024-12-25T10:00:00+01:00')
        end_datetime: Fin au format ISO 8601
        description: Description de l'événement
        location: Lieu de l'événement
        attendees: Liste d'emails des participants
        calendar_id: ID du calendrier ('primary' par défaut)
        user_email: Email pour délégation
    """
    service = _get_service(user_email=user_email)
    event_body = {
        "summary": summary,
        "start": {"dateTime": start_datetime},
        "end": {"dateTime": end_datetime},
    }
    if description:
        event_body["description"] = description
    if location:
        event_body["location"] = location
    if attendees:
        event_body["attendees"] = [{"email": e} for e in attendees]

    result = service.events().insert(
        calendarId=calendar_id,
        body=event_body,
        sendUpdates="all" if attendees else "none",
    ).execute()
    return {
        "id": result.get("id"),
        "summary": result.get("summary"),
        "start": result["start"].get("dateTime"),
        "link": result.get("htmlLink"),
        "status": "créé",
    }


def update_event(
    event_id: str,
    summary: Optional[str] = None,
    start_datetime: Optional[str] = None,
    end_datetime: Optional[str] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
    calendar_id: str = "primary",
    user_email: Optional[str] = None,
) -> dict:
    """
    Modifie un événement existant.

    Args:
        event_id: ID de l'événement à modifier
        summary: Nouveau titre (optionnel)
        start_datetime: Nouveau début ISO 8601 (optionnel)
        end_datetime: Nouvelle fin ISO 8601 (optionnel)
        description: Nouvelle description (optionnel)
        location: Nouveau lieu (optionnel)
        calendar_id: ID du calendrier
        user_email: Email pour délégation
    """
    service = _get_service(user_email=user_email)
    event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()

    if summary:
        event["summary"] = summary
    if start_datetime:
        event["start"] = {"dateTime": start_datetime}
    if end_datetime:
        event["end"] = {"dateTime": end_datetime}
    if description is not None:
        event["description"] = description
    if location is not None:
        event["location"] = location

    result = service.events().update(
        calendarId=calendar_id,
        eventId=event_id,
        body=event,
    ).execute()
    return {"id": result.get("id"), "summary": result.get("summary"), "status": "modifié"}


def delete_event(
    event_id: str,
    calendar_id: str = "primary",
    user_email: Optional[str] = None,
) -> dict:
    """
    Supprime un événement du calendrier.

    Args:
        event_id: ID de l'événement à supprimer
        calendar_id: ID du calendrier
        user_email: Email pour délégation
    """
    service = _get_service(user_email=user_email)
    service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
    return {"id": event_id, "status": "supprimé"}


def list_calendars(user_email: Optional[str] = None) -> List[dict]:
    """
    Liste tous les calendriers accessibles.

    Args:
        user_email: Email pour délégation
    """
    service = _get_service(user_email=user_email)
    result = service.calendarList().list().execute()
    return [
        {
            "id": cal["id"],
            "summary": cal.get("summary", ""),
            "primary": cal.get("primary", False),
            "access_role": cal.get("accessRole", ""),
        }
        for cal in result.get("items", [])
    ]
