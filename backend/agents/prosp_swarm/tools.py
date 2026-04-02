"""
Outils du Groupe de Prosp.
Scraping web, recherche d'entreprises, envoi d'emails SMTP.
"""
import asyncio
import logging
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from core.config import settings

logger = logging.getLogger(__name__)


# ─── Recherche d'entreprises ──────────────────────────────────────────────────

async def search_companies(
    sector: str,
    city: str = "",
    count: int = 10,
) -> list[dict]:
    """
    Recherche des entreprises par secteur et ville.
    Utilise DuckDuckGo (pas de clé API requise).

    Args:
        sector: Secteur d'activité (ex: 'restauration', 'immobilier')
        city: Ville ou région (optionnel)
        count: Nombre de résultats souhaités

    Returns:
        Liste de dicts avec company_name, website, description
    """
    location = f" {city}" if city else " France"
    query = f"entreprises {sector}{location} site officiel"

    results = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # DuckDuckGo HTML search (no API key needed)
            response = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; FlareBot/1.0)"},
            )
            soup = BeautifulSoup(response.text, "html.parser")
            links = soup.select(".result__a")

            for link in links[:count]:
                href = link.get("href", "")
                title = link.get_text(strip=True)
                # Extraction URL réelle depuis les redirects DDG
                url_match = re.search(r"uddg=([^&]+)", href)
                if url_match:
                    from urllib.parse import unquote
                    url = unquote(url_match.group(1))
                    domain = urlparse(url).netloc
                    results.append({
                        "company_name": title,
                        "website": url,
                        "domain": domain,
                        "industry": sector,
                        "city": city,
                    })

    except Exception as e:
        logger.warning(f"Erreur recherche entreprises: {e}")
        # Données de démonstration si la recherche échoue
        for i in range(min(count, 3)):
            results.append({
                "company_name": f"Entreprise {sector.capitalize()} {i+1}",
                "website": f"https://exemple-{sector}-{i+1}.fr",
                "domain": f"exemple-{sector}-{i+1}.fr",
                "industry": sector,
                "city": city,
            })

    return results[:count]


# ─── Analyse de site web ──────────────────────────────────────────────────────

async def scrape_website(url: str) -> dict:
    """
    Analyse un site web et extrait les informations utiles pour la prospection.

    Args:
        url: URL du site à analyser

    Returns:
        Dict avec description, email_found, phone, language, has_social_media
    """
    result = {
        "url": url,
        "description": "",
        "email_found": None,
        "phone": None,
        "has_social_media": False,
        "scraped": False,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; FlareBot/1.0)"},
            )
            if response.status_code != 200:
                return result

            soup = BeautifulSoup(response.text, "html.parser")
            result["scraped"] = True

            # Description (meta ou premier paragraphe)
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and meta_desc.get("content"):
                result["description"] = meta_desc["content"][:500]
            else:
                paragraphs = soup.find_all("p")
                for p in paragraphs[:3]:
                    text = p.get_text(strip=True)
                    if len(text) > 50:
                        result["description"] = text[:500]
                        break

            # Email
            emails = re.findall(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                response.text,
            )
            # Filtrer les emails génériques
            valid_emails = [
                e for e in emails
                if not any(x in e.lower() for x in ["@example", "@test", "@sentry", "@pixel"])
            ]
            if valid_emails:
                result["email_found"] = valid_emails[0]

            # Téléphone
            phone_match = re.search(
                r"(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}", response.text
            )
            if phone_match:
                result["phone"] = phone_match.group(0)

            # Présence réseaux sociaux
            social_keywords = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com"]
            result["has_social_media"] = any(
                kw in response.text.lower() for kw in social_keywords
            )

    except Exception as e:
        logger.warning(f"Erreur scraping {url}: {e}")

    return result


# ─── Envoi d'email ────────────────────────────────────────────────────────────

async def send_cold_email(
    to_email: str,
    to_name: str,
    company_name: str,
    subject: str,
    body_html: str,
    body_text: str,
) -> bool:
    """
    Envoie un email de prospection via SMTP asynchrone.

    Args:
        to_email: Email du destinataire
        to_name: Nom du destinataire
        company_name: Nom de l'entreprise
        subject: Objet de l'email
        body_html: Corps HTML de l'email
        body_text: Corps texte brut de l'email

    Returns:
        True si l'email a été envoyé avec succès
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP non configuré — email simulé (non envoyé)")
        logger.info(f"[SIMULATION] Email vers {to_email} — Objet: {subject}")
        return True  # Simulation en mode dev

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        # Envoi synchrone dans un thread pool (SMTP n'est pas async natif)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp, msg)

        logger.info(f"Email envoyé à {to_email}")
        return True

    except Exception as e:
        logger.error(f"Erreur envoi email {to_email}: {e}")
        return False


def _send_smtp(msg: MIMEMultipart):
    """Envoi SMTP synchrone (appelé depuis executor)."""
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)






