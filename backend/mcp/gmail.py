"""
Connecteur Gmail (MCP).
Envoi, lecture et recherche d'emails via l'API Gmail.

Prérequis : GOOGLE_SERVICE_ACCOUNT_JSON configuré dans .env
Note : Nécessite une délégation de domaine (Domain-Wide Delegation) pour
accéder à une boîte mail utilisateur. Sans délégation, seul l'envoi via
un compte de service est possible.
"""
import json
import base64
import email as email_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]


def _get_service(user_email: Optional[str] = None):
    """Crée un client Gmail authentifié. user_email requis pour la délégation."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError(
            "GOOGLE_SERVICE_ACCOUNT_JSON non configuré dans .env"
        )
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    if user_email:
        creds = creds.with_subject(user_email)
    return build("gmail", "v1", credentials=creds)


def send_email(
    to: str,
    subject: str,
    body: str,
    sender_email: str,
    cc: str = "",
    is_html: bool = False,
) -> dict:
    """
    Envoie un email via Gmail API.

    Args:
        to: Destinataire (email)
        subject: Objet du message
        body: Corps de l'email (texte ou HTML)
        sender_email: Email de l'expéditeur (doit avoir délégation)
        cc: Destinataires en copie (séparés par virgule)
        is_html: True pour envoyer en HTML
    """
    service = _get_service(user_email=sender_email)

    msg = MIMEMultipart("alternative") if is_html else MIMEText(body, "plain", "utf-8")

    if is_html:
        msg.attach(MIMEText(body, "html", "utf-8"))

    msg["To"] = to
    msg["From"] = sender_email
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()
    return {"id": result.get("id"), "status": "envoyé", "to": to, "subject": subject}


def read_inbox(user_email: str, max_results: int = 10, unread_only: bool = False) -> List[dict]:
    """
    Lit les emails de la boîte de réception.

    Args:
        user_email: Email de l'utilisateur (délégation requise)
        max_results: Nombre d'emails à retourner
        unread_only: Si True, retourne uniquement les non-lus
    """
    service = _get_service(user_email=user_email)
    query = "is:unread" if unread_only else ""

    messages_list = service.users().messages().list(
        userId="me",
        maxResults=max_results,
        q=query,
        labelIds=["INBOX"],
    ).execute()

    messages = messages_list.get("messages", [])
    result = []
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref["id"],
            format="metadata",
            metadataHeaders=["From", "To", "Subject", "Date"],
        ).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        result.append({
            "id": msg["id"],
            "from": headers.get("From", ""),
            "to": headers.get("To", ""),
            "subject": headers.get("Subject", "(sans objet)"),
            "date": headers.get("Date", ""),
            "snippet": msg.get("snippet", ""),
            "unread": "UNREAD" in msg.get("labelIds", []),
        })
    return result


def search_emails(user_email: str, query: str, max_results: int = 10) -> List[dict]:
    """
    Recherche des emails avec une requête Gmail.

    Args:
        user_email: Email de l'utilisateur
        query: Requête Gmail (ex: 'from:client@example.com', 'subject:devis', 'after:2024/01/01')
        max_results: Nombre maximum de résultats
    """
    service = _get_service(user_email=user_email)
    messages_list = service.users().messages().list(
        userId="me",
        maxResults=max_results,
        q=query,
    ).execute()

    messages = messages_list.get("messages", [])
    result = []
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref["id"],
            format="metadata",
            metadataHeaders=["From", "To", "Subject", "Date"],
        ).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        result.append({
            "id": msg["id"],
            "from": headers.get("From", ""),
            "subject": headers.get("Subject", "(sans objet)"),
            "date": headers.get("Date", ""),
            "snippet": msg.get("snippet", ""),
        })
    return result


def get_email_body(user_email: str, message_id: str) -> str:
    """
    Récupère le corps complet d'un email.

    Args:
        user_email: Email de l'utilisateur
        message_id: ID de l'email (obtenu depuis read_inbox ou search_emails)
    """
    service = _get_service(user_email=user_email)
    msg = service.users().messages().get(
        userId="me",
        id=message_id,
        format="full",
    ).execute()

    payload = msg.get("payload", {})

    def extract_body(part):
        if part.get("mimeType") in ("text/plain", "text/html"):
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        for subpart in part.get("parts", []):
            result = extract_body(subpart)
            if result:
                return result
        return ""

    return extract_body(payload)


def create_draft(
    user_email: str,
    to: str,
    subject: str,
    body: str,
) -> dict:
    """
    Crée un brouillon dans Gmail.

    Args:
        user_email: Email de l'utilisateur
        to: Destinataire
        subject: Objet
        body: Corps du message
    """
    service = _get_service(user_email=user_email)
    msg = MIMEText(body, "plain", "utf-8")
    msg["To"] = to
    msg["From"] = user_email
    msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = service.users().drafts().create(
        userId="me", body={"message": {"raw": raw}}
    ).execute()
    return {"id": result.get("id"), "status": "brouillon_créé"}
