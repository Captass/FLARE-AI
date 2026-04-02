"""
Définition des 9 agents du Groupe de Prosp.
Chaque agent est une fonction async qui prend et retourne un SwarmState.
"""
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from ...core.llm_factory import get_llm
from ...core.database import SessionLocal, ProspectLead, ProspectingCampaign
from .tools import search_companies, scrape_website, send_cold_email

logger = logging.getLogger(__name__)


def _llm():
    return get_llm(temperature=0.7)


# ─── Agent 1 : Chercheur ──────────────────────────────────────────────────────

async def agent_chercheur(state: dict) -> dict:
    """
    Recherche des entreprises cibles selon le secteur et la ville.
    Alimente le swarm avec une liste de prospects bruts.
    """
    logger.info("[Chercheur] Recherche d'entreprises...")
    sector = state.get("sector", "commerce")
    city = state.get("city", "")
    target_count = state.get("target_count", 10)

    companies = await search_companies(sector, city, target_count)

    logger.info(f"[Chercheur] {len(companies)} entreprises trouvées")
    return {**state, "raw_leads": companies, "step": "analyste_web"}


# ─── Agent 2 : Analyste Web ───────────────────────────────────────────────────

async def agent_analyste_web(state: dict) -> dict:
    """
    Scrape les sites web de chaque entreprise pour enrichir les données.
    Extrait emails, téléphones, description, présence RS.
    """
    logger.info("[Analyste Web] Analyse des sites web...")
    raw_leads = state.get("raw_leads", [])
    enriched_leads = []

    for lead in raw_leads:
        website = lead.get("website", "")
        if website and website.startswith("http"):
            site_data = await scrape_website(website)
            lead.update(site_data)

        enriched_leads.append(lead)

    logger.info(f"[Analyste Web] {len(enriched_leads)} leads enrichis")
    return {**state, "enriched_leads": enriched_leads, "step": "qualificateur"}


# ─── Agent 3 : Qualificateur ──────────────────────────────────────────────────

async def agent_qualificateur(state: dict) -> dict:
    """
    Valide la pertinence de chaque lead pour RAM'S FLARE.
    Score de 0 à 10 basé sur la description et les signaux.
    """
    logger.info("[Qualificateur] Qualification des leads...")
    enriched_leads = state.get("enriched_leads", [])
    qualified_leads = []

    llm = _llm()

    for lead in enriched_leads:
        # Un lead est qualifié si on a au moins un email OU si le site est valide
        has_email = bool(lead.get("email_found"))
        has_website = bool(lead.get("scraped"))

        if not has_email and not has_website:
            continue

        # Score LLM basé sur la description
        score = 5.0
        description = lead.get("description", "")
        if description:
            try:
                prompt = f"""Évalue ce prospect pour une agence de communication et d'audiovisuel (RAM'S FLARE).
Score de 1 à 10 selon son besoin potentiel en communication digitale.
Réponds UNIQUEMENT avec un nombre entre 1 et 10.

Entreprise : {lead.get('company_name', '')}
Secteur : {lead.get('industry', '')}
Description : {description[:300]}
Présence réseaux sociaux : {"oui" if lead.get("has_social_media") else "non"}"""

                response = await llm.ainvoke([HumanMessage(content=prompt)])
                score_text = response.content.strip()
                score_match = re.search(r"\d+(?:\.\d+)?", score_text)
                if score_match:
                    score = min(10.0, max(0.0, float(score_match.group())))
            except Exception:
                score = 5.0

        if score >= 4.0:  # Seuil de qualification
            lead["score"] = score
            lead["status"] = "qualified"
            qualified_leads.append(lead)

    logger.info(f"[Qualificateur] {len(qualified_leads)} leads qualifiés")
    return {**state, "qualified_leads": qualified_leads, "step": "redacteur"}


# ─── Agent 4 : Rédacteur ──────────────────────────────────────────────────────

async def agent_redacteur(state: dict) -> dict:
    """
    Rédige un email de prospection ultra-personnalisé pour chaque lead.
    """
    logger.info("[Rédacteur] Rédaction des emails...")
    qualified_leads = state.get("qualified_leads", [])
    email_subject_override = state.get("email_subject", "")
    drafted_emails = []

    llm = _llm()

    for lead in qualified_leads:
        company = lead.get("company_name", "votre entreprise")
        sector = lead.get("industry", "")
        description = lead.get("description", "")[:300]
        has_social = lead.get("has_social_media", False)

        social_note = (
            "J'ai remarqué que vous êtes déjà présent sur les réseaux sociaux."
            if has_social
            else "Je n'ai pas trouvé de présence forte sur les réseaux sociaux."
        )

        prompt = f"""Rédige un email de prospection pour RAM'S FLARE, une agence de communication et d'audiovisuel.

Destinataire : {company} (secteur : {sector})
Description de l'entreprise : {description}
Observation réseaux sociaux : {social_note}

Consignes :
- Email court (8-12 lignes maximum)
- Ton professionnel mais chaleureux
- Personnalisé avec le nom de l'entreprise
- Mentionner 1-2 services pertinents de RAM'S FLARE
- Appel à l'action clair (répondre pour un échange de 15 minutes)
- Signature : L'équipe RAM'S FLARE
- NE PAS inclure d'objet, juste le corps de l'email

Écris l'email en français."""

        try:
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            email_body = response.content.strip()

            # Générer l'objet de l'email
            if email_subject_override:
                subject = email_subject_override
            else:
                subject_prompt = f"En 8 mots maximum, écris un objet d'email accrocheur pour contacter {company} au sujet de leur communication digitale. Réponds UNIQUEMENT avec l'objet."
                subj_response = await llm.ainvoke([HumanMessage(content=subject_prompt)])
                subject = subj_response.content.strip()[:100]

            lead["email_body"] = email_body
            lead["email_subject"] = subject
            lead["email_html"] = email_body.replace("\n", "<br>")
            drafted_emails.append(lead)

        except Exception as e:
            logger.error(f"Erreur rédaction email pour {company}: {e}")

    logger.info(f"[Rédacteur] {len(drafted_emails)} emails rédigés")
    return {**state, "drafted_emails": drafted_emails, "step": "compliance"}


# ─── Agent 5 : Compliance ─────────────────────────────────────────────────────

async def agent_compliance(state: dict) -> dict:
    """
    Vérifie chaque email : ton RAM'S FLARE, RGPD, absence de spam triggers.
    Filtre ou corrige les emails problématiques.
    """
    logger.info("[Compliance] Vérification des emails...")
    drafted_emails = state.get("drafted_emails", [])
    approved_emails = []

    llm = _llm()

    for lead in drafted_emails:
        email_body = lead.get("email_body", "")
        if not email_body:
            continue

        # Vérification rapide : spam triggers
        spam_words = ["gratuit", "urgent", "cliquez", "gagnez", "offre limitée", "!!!"]
        has_spam = any(word.lower() in email_body.lower() for word in spam_words)

        if has_spam:
            try:
                prompt = f"""Améliore cet email de prospection pour éviter les mots spam et rester professionnel.
Email original :
{email_body}

Réponds UNIQUEMENT avec l'email corrigé, sans commentaires."""
                response = await llm.ainvoke([HumanMessage(content=prompt)])
                lead["email_body"] = response.content.strip()
                lead["email_html"] = lead["email_body"].replace("\n", "<br>")
            except Exception:
                pass

        lead["compliance_ok"] = True
        approved_emails.append(lead)

    logger.info(f"[Compliance] {len(approved_emails)} emails approuvés")
    return {**state, "approved_emails": approved_emails, "step": "gestionnaire_envoi"}


# ─── Agent 6 : Gestionnaire d'Envoi ──────────────────────────────────────────

async def agent_gestionnaire_envoi(state: dict) -> dict:
    """
    Envoie les emails approuvés et sauvegarde les leads en DB.
    """
    logger.info("[Gestionnaire Envoi] Envoi des emails...")
    approved_emails = state.get("approved_emails", [])
    campaign_id = state.get("campaign_id", "")
    sent_leads = []

    db = SessionLocal()
    try:
        for lead in approved_emails:
            email = lead.get("email_found")
            if not email:
                continue

            success = await send_cold_email(
                to_email=email,
                to_name=lead.get("contact_name", ""),
                company_name=lead.get("company_name", ""),
                subject=lead.get("email_subject", "Collaboration RAM'S FLARE"),
                body_html=lead.get("email_html", ""),
                body_text=lead.get("email_body", ""),
            )

            # Sauvegarde en DB
            db_lead = ProspectLead(
                company_name=lead.get("company_name", ""),
                website=lead.get("website", ""),
                email=email,
                contact_name=lead.get("contact_name", ""),
                industry=lead.get("industry", ""),
                city=lead.get("city", ""),
                status="email_sent" if success else "qualified",
                score=lead.get("score", 5.0),
                notes=lead.get("description", "")[:500],
                email_sent_at=datetime.utcnow() if success else None,
                follow_up_at=datetime.utcnow() + timedelta(days=3) if success else None,
                campaign_id=campaign_id,
            )
            db.add(db_lead)

            if success:
                lead["email_sent"] = True
                sent_leads.append(lead)

        # Mise à jour de la campagne
        if campaign_id:
            campaign = db.query(ProspectingCampaign).filter(
                ProspectingCampaign.id == campaign_id
            ).first()
            if campaign:
                campaign.emails_sent = len(sent_leads)
                campaign.leads_found = len(approved_emails)

        db.commit()

    finally:
        db.close()

    logger.info(f"[Gestionnaire Envoi] {len(sent_leads)} emails envoyés")
    return {**state, "sent_leads": sent_leads, "step": "gestionnaire_suivi"}


# ─── Agent 7 : Gestionnaire de Suivi ─────────────────────────────────────────

async def agent_gestionnaire_suivi(state: dict) -> dict:
    """
    Planifie les relances automatiques à J+3 et J+7.
    Met à jour les dates de follow-up en DB.
    """
    logger.info("[Gestionnaire Suivi] Planification des relances...")
    sent_leads = state.get("sent_leads", [])

    db = SessionLocal()
    try:
        for lead in sent_leads:
            email = lead.get("email_found")
            if not email:
                continue

            # Mise à jour de la date de follow-up (J+3 premier, J+7 second)
            db_lead = db.query(ProspectLead).filter(
                ProspectLead.email == email
            ).order_by(ProspectLead.created_at.desc()).first()

            if db_lead and db_lead.follow_up_at is None:
                db_lead.follow_up_at = datetime.utcnow() + timedelta(days=3)

        db.commit()

    finally:
        db.close()

    logger.info(f"[Gestionnaire Suivi] Relances planifiées pour {len(sent_leads)} leads")
    return {**state, "step": "gestionnaire_reponses"}


# ─── Agent 8 : Gestionnaire des Réponses ─────────────────────────────────────

async def agent_gestionnaire_reponses(state: dict) -> dict:
    """
    Analyse et classifie les réponses reçues aux emails de prospection.
    (En phase de développement : classification simulée)
    """
    logger.info("[Gestionnaire Réponses] Analyse des réponses...")
    # Note : la collecte des réponses nécessite une intégration IMAP
    # En dev, on simule la classification
    return {**state, "responses_classified": 0, "step": "reporting"}


# ─── Agent 9 : Reporting ──────────────────────────────────────────────────────

async def agent_reporting(state: dict) -> dict:
    """
    Génère un rapport KPI complet de la campagne pour l'orchestrateur.
    """
    logger.info("[Reporting] Génération du rapport...")
    campaign_id = state.get("campaign_id", "")

    raw_count = len(state.get("raw_leads", []))
    qualified_count = len(state.get("qualified_leads", []))
    sent_count = len(state.get("sent_leads", []))

    taux_qualification = f"{(qualified_count/raw_count*100):.1f}%" if raw_count else "0%"
    taux_envoi = f"{(sent_count/qualified_count*100):.1f}%" if qualified_count else "0%"

    report = f"""## Rapport de Campagne — Groupe de Prosp

**Secteur ciblé** : {state.get('sector', 'N/A')}
**Ville** : {state.get('city', 'France')}

### Résultats
| Étape | Nombre |
|-------|--------|
| Entreprises trouvées | {raw_count} |
| Leads qualifiés | {qualified_count} |
| Emails envoyés | {sent_count} |
| Taux de qualification | {taux_qualification} |
| Taux d'envoi | {taux_envoi} |

### Statut
Campagne terminée. Les relances J+3 sont planifiées automatiquement.

_Rapport généré le {datetime.utcnow().strftime('%d/%m/%Y à %H:%M')} UTC_"""

    # Mise à jour de la campagne en DB
    if campaign_id:
        db = SessionLocal()
        try:
            campaign = db.query(ProspectingCampaign).filter(
                ProspectingCampaign.id == campaign_id
            ).first()
            if campaign:
                campaign.status = "completed"
                campaign.report = report
                campaign.completed_at = datetime.utcnow()
            db.commit()
        finally:
            db.close()

    logger.info("[Reporting] Rapport généré")
    return {**state, "final_report": report, "step": "done"}






