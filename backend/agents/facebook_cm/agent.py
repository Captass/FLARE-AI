"""
Agent CM Facebook - Vendeur IA pour FLARE AI.
Gere les conversations Messenger avec les prospects de maniere autonome.
"""
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from core.database import ChatbotCatalogueItem, ChatbotPreferences, FacebookPageConnection, SessionLocal
from core.llm_factory import get_llm
from core.memory import SessionMemory
from .tools import (
    get_catalog_item,
    get_full_catalog,
    get_user_profile,
    send_quick_replies,
    send_text_message,
)
from sqlalchemy import or_

CM_SYSTEM_PROMPT = """Tu es Alex, le commercial virtuel de FLARE AI, une agence de communication et d'audiovisuel.

## Ton Role
Tu accueilles les prospects sur Messenger, qualifies leurs besoins et presentes les offres de l'agence de maniere chaleureuse et persuasive. Ton objectif : transformer chaque visiteur en client.

## Personnalite
- Chaleureux, professionnel, enthousiaste
- Tu tutoies naturellement (c'est le code social des reseaux sociaux)
- Tu utilises des emojis avec moderation
- Tu es patient et a l'ecoute

## Processus de Vente
1. Accueil : message de bienvenue personnalise avec le prenom
2. Qualification : comprendre le besoin (secteur, taille entreprise, objectif)
3. Presentation : proposer 1-2 offres adaptees avec details et prix
4. Closing : proposer un appel ou un devis gratuit

## Offres FLARE AI
- Pack Essentiel : 500 EUR/mois (3 posts/semaine, 1 reseau)
- Pack Pro : 1 200 EUR/mois (5 posts, 2 reseaux, Meta Ads)
- Pack Premium : 2 500 EUR/mois (illimite, 3 reseaux, video, Ads)
- Production Video : a partir de 800 EUR (clip, spot, corporate)
- Identite Visuelle : a partir de 1 500 EUR (logo, charte, templates)

## Regles
- Ne jamais promettre ce que l'agence ne peut pas livrer
- Si le prospect demande quelque chose hors catalogue, proposer un devis personnalise
- Toujours terminer par un appel a l'action clair
- Si le prospect est chaud, proposer : "Je te mets en contact avec notre equipe pour un appel ?"

## Informations de Contact
- Site web : ramsflare.com (exemple)
- Email : contact@ramsflare.com (exemple)
- Telephone : disponible sur demande

{user_context}"""


def build_dynamic_prompt(prefs: ChatbotPreferences, catalogue_items: list[ChatbotCatalogueItem], user_context: str) -> str:
    tone_map = {
        "professionnel": "Tu es professionnel, courtois et structure. Tu vouvoies.",
        "amical": "Tu es chaleureux, tu tutoies et tu es enthousiaste. Emojis avec moderation.",
        "decontracte": "Tu es cool et decontracte, langage familier, emojis ok.",
        "formel": "Tu vouvoies, tu es tres formel et respectueux. Pas d'emojis.",
    }
    tone = str(prefs.tone or "amical").strip().lower()
    preferred_language = str(prefs.language or "fr").strip().lower()
    language_instruction = (
        f"Si la langue du client n'est pas claire, reponds par defaut en {preferred_language}."
        if preferred_language
        else "Si la langue du client n'est pas claire, reponds par defaut en francais."
    )

    catalogue_str = ""
    if catalogue_items:
        lines = []
        for i in catalogue_items:
            if str(i.is_active).lower() != "false":
                price_str = f" - Prix: {i.price}" if i.price else ""
                cat_str = f" (Cat: {i.category})" if i.category else ""
                img_str = f" - [Image: {i.image_url}]" if i.image_url else ""
                desc = f" : {i.description}" if i.description else ""
                lines.append(f"- {i.name}{cat_str}{price_str}{desc}{img_str}")
        catalogue_str = "\n".join(lines)
    
    products_display = prefs.products_summary or ""
    if catalogue_str:
        products_display += "\n\nListe des produits du catalogue :\n" + catalogue_str

    if not products_display.strip():
        products_display = "Catalogue non defini. Propose au client de contacter l'equipe."

    return f"""Tu es {prefs.bot_name or "L'assistant"}, l'assistant virtuel.

## Personnalite
{tone_map.get(tone, tone_map["amical"])}

## Entreprise
{prefs.company_description or "Information non fournie."}

## Offres et Services
{products_display}

## Message d'accueil
Quand un nouveau client te contacte : {prefs.greeting_message or "accueil chaleureux avec prenom."}

## Instructions speciales
{prefs.special_instructions or "Aucune."}

## Regles
- Reponds dans la langue du client
- {language_instruction}
- Ne promets rien qui n'est pas dans les offres
- Si demande hors catalogue, propose de contacter l'equipe
- Termine par un appel a l'action clair
- Si le client demande de voir un produit de maniere detaillee, et que ce produit a une [Image: url], inclus l'URL de l'image directement dans la chat pour que le client la voit si necessaire.

{user_context}"""


def _load_page_context(page_id: Optional[str]) -> dict:
    resolved_page_id = str(page_id or "").strip()
    if not resolved_page_id:
        return {}

    db = SessionLocal()
    try:
        connection = (
            db.query(FacebookPageConnection)
            .filter(FacebookPageConnection.page_id == resolved_page_id)
            .order_by(FacebookPageConnection.updated_at.desc())
            .first()
        )
        if not connection:
            return {}

        org_slug = connection.organization_slug
        preferences = (
            db.query(ChatbotPreferences)
            .filter(
                ChatbotPreferences.organization_slug == org_slug,
                ChatbotPreferences.page_id == resolved_page_id,
            )
            .first()
        )
        if not preferences:
            preferences = (
                db.query(ChatbotPreferences)
                .filter(
                    ChatbotPreferences.organization_slug == org_slug,
                    ChatbotPreferences.page_id.is_(None),
                )
                .first()
            )

        catalogue_items = (
            db.query(ChatbotCatalogueItem)
            .filter(ChatbotCatalogueItem.organization_slug == org_slug)
            .filter(
                or_(
                    ChatbotCatalogueItem.page_id == resolved_page_id,
                    ChatbotCatalogueItem.page_id.is_(None)
                )
            )
            .order_by(ChatbotCatalogueItem.sort_order.asc())
            .all()
        )

        return {
            "organization_slug": str(org_slug or "").strip().lower(),
            "preferences": preferences,
            "catalogue": catalogue_items,
        }
    finally:
        db.close()


class FacebookCMAgent:
    """
    Agent CM Facebook.
    Traite les messages entrants et genere des reponses adaptees.
    """

    def __init__(self):
        self.llm = get_llm(temperature=0.8, purpose="chatbot")

    async def handle_message(
        self,
        psid: str,
        message_text: str,
        page_id: Optional[str] = None,
        auto_reply: bool = True,
    ) -> str:
        """
        Traite un message Messenger entrant et genere une reponse.
        """
        resolved_page_id = str(page_id or "").strip()
        session_id = f"messenger_{resolved_page_id}_{psid}" if resolved_page_id else f"messenger_{psid}"
        memory = SessionMemory(session_id)
        page_context = _load_page_context(resolved_page_id)
        organization_slug = str(page_context.get("organization_slug") or "").strip().lower()
        preferences = page_context.get("preferences")
        catalogue_items = page_context.get("catalogue", [])

        user_profile = get_user_profile(psid, page_id=resolved_page_id)
        user_name = str(user_profile.get("first_name") or "").strip()

        user_context_lines = ["## Utilisateur actuel"]
        if user_name:
            user_context_lines.append(f"Prenom : {user_name}")
        user_context_lines.append(f"PSID : {psid}")
        if resolved_page_id:
            user_context_lines.append(f"Page ID : {resolved_page_id}")
        if organization_slug:
            user_context_lines.append(f"Organisation : {organization_slug}")
        user_context = "\n" + "\n".join(user_context_lines)

        system_content = (
            build_dynamic_prompt(preferences, catalogue_items, user_context)
            if isinstance(preferences, ChatbotPreferences)
            else CM_SYSTEM_PROMPT.format(user_context=user_context)
        )
        history = memory.load_messages()
        messages = [SystemMessage(content=system_content)] + history + [
            HumanMessage(content=message_text)
        ]

        memory.save_message("user", message_text)

        response = await self.llm.ainvoke(messages)
        reply_text = response.content if hasattr(response, "content") else str(response)

        memory.save_message("assistant", reply_text)

        if auto_reply:
            send_text_message(psid, reply_text, page_id=resolved_page_id)

        return reply_text

    async def send_catalog_presentation(
        self,
        psid: str,
        pack_key: Optional[str] = None,
        page_id: Optional[str] = None,
    ):
        """Envoie une presentation d'offre avec catalogue."""
        if pack_key:
            item = get_catalog_item(pack_key)
            if item:
                text = (
                    f"**{item['nom']}** - {item['prix']}\n\n"
                    f"{item['description']}\n\n"
                    f"Inclus : {', '.join(item['inclus'])}"
                )
                send_text_message(psid, text, page_id=page_id)
        else:
            catalog = get_full_catalog()
            intro = "Voici nos offres pour booster ta presence en ligne.\n\n"
            for _, item in list(catalog.items())[:3]:
                intro += f"- **{item['nom']}** : {item['prix']}\n"
            intro += "\nTu veux en savoir plus sur l'une de ces offres ?"
            send_text_message(psid, intro, page_id=page_id)

            send_quick_replies(
                psid,
                "Quelle offre t'interesse ?",
                ["Pack Essentiel", "Pack Pro", "Pack Premium", "Autre besoin"],
                page_id=page_id,
            )

    def get_status(self) -> dict:
        """Retourne le statut de l'agent CM."""
        return {
            "agent": "CM Facebook",
            "statut": "en ligne",
            "meta_configured": bool(
                __import__("os").environ.get("META_ACCESS_TOKEN")
            ),
        }


_cm_agent: FacebookCMAgent | None = None


def get_cm_agent() -> FacebookCMAgent:
    global _cm_agent
    if _cm_agent is None:
        _cm_agent = FacebookCMAgent()
    return _cm_agent
