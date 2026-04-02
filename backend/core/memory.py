"""
Système de mémoire pour FLARE AI.

- SessionMemory : Données "chaudes" (Historique dynamique via SQLAlchemy)
- CoreMemory    : Données "chaudes" (Faits évolutifs, préférences via SQLAlchemy)
"""
import json
import logging
import re
from typing import Dict, List, Optional
from datetime import datetime, timezone

from langchain_core.messages import (
    HumanMessage, AIMessage, SystemMessage, BaseMessage
)
from sqlalchemy.orm import Session

from .database import SessionLocal, Conversation, Message, CoreMemoryFact, ConversationFile

logger = logging.getLogger(__name__)


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _normalize_memory_key(key: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_ -]+", "", (key or "").strip().lower())
    cleaned = re.sub(r"[\s-]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned[:80]


def _normalize_memory_category(category: str) -> str:
    normalized = (category or "general").strip().lower()
    allowed = {"general", "client", "agence", "preference", "projet"}
    return normalized if normalized in allowed else "general"


def _clean_fact_value(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).strip(" ,.;:-")


def _normalize_fact_value_for_key(key: str, value: str) -> str:
    normalized_key = _normalize_memory_key(key)
    cleaned_value = _clean_fact_value(value)
    if normalized_key == "user_age":
        age_match = re.fullmatch(r"(\d{1,3})(?:\s*ans?)?", cleaned_value, re.IGNORECASE)
        if age_match:
            return f"{age_match.group(1)} ans"
    return cleaned_value


def _extract_deterministic_facts_from_text(text: str) -> List[dict]:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if not cleaned:
        return []
    extracted: Dict[str, dict] = {}

    def add_fact(key: str, value: str, category: str = "general"):
        normalized_key = _normalize_memory_key(key)
        normalized_value = _normalize_fact_value_for_key(normalized_key, value)
        if not normalized_key or not normalized_value:
            return
        extracted[normalized_key] = {
            "key": normalized_key,
            "value": normalized_value[:300],
            "category": _normalize_memory_category(category),
        }

    name_patterns = [
        r"\b(?:je m'appelle|mon nom est|appelle[- ]?moi)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40})",
    ]
    for pattern in name_patterns:
        match = re.search(pattern, cleaned, re.IGNORECASE)
        if match:
            add_fact("user_name", match.group(1).strip().title())
            break

    age_match = re.search(r"\bj[’']?\s*ai\s+(\d{1,3})\s+ans\b", cleaned, re.IGNORECASE)
    if age_match:
        add_fact("user_age", f"{age_match.group(1)} ans")

    location_match = re.search(
        r"\b(?:je vis|j'habite|j’habite|je réside|je reside|je suis basé|je suis base|je suis basée|je suis basee)\s+[àa]\s+([^.,;\n]{2,80})",
        cleaned,
        re.IGNORECASE,
    )
    if not location_match:
        location_match = re.search(r"\bje viens de\s+([^.,;\n]{2,80})", cleaned, re.IGNORECASE)
    if location_match:
        location_value = location_match.group(1)
        for stopper in (" et je ", " et j'", " et j’", " mais je "):
            pos = location_value.lower().find(stopper)
            if pos != -1:
                location_value = location_value[:pos]
                break
        add_fact("user_location", location_value)

    role_match = re.search(
        r"\b(?:je suis|mon rôle est|mon role est)\s+([^.\n]{3,120})",
        cleaned,
        re.IGNORECASE,
    )
    if role_match:
        role_value = _clean_fact_value(role_match.group(1))
        role_keywords = (
            "entrepreneur", "développeur", "developpeur", "developer", "étudiant",
            "etudiant", "marketeur", "marketing", "designer", "freelance",
            "fondateur", "founder", "créateur", "createur", "ceo", "manager",
            "leader", "consultant", "ingénieur", "ingenieur",
        )
        if any(keyword in role_value.lower() for keyword in role_keywords):
            add_fact("user_role", role_value)

    objective_patterns = [
        r"\b(?:mon objectif(?: principal)? est|mes objectifs sont)\s+([^.\n]{3,160})",
        r"\b(?:je veux|je souhaite|j'ai pour objectif|j’ai pour objectif)\s+([^.\n]{3,160})",
    ]
    for pattern in objective_patterns:
        match = re.search(pattern, cleaned, re.IGNORECASE)
        if match:
            add_fact("user_objective", match.group(1))
            break

    language_match = re.search(
        r"\b(?:parle(?:-moi)?|réponds|reponds)\s+en\s+([^.,;\n]{2,40})",
        cleaned,
        re.IGNORECASE,
    )
    if language_match:
        add_fact("preferred_language", language_match.group(1), "preference")

    return list(extracted.values())


def _extract_profile_facts_from_text(text: str) -> List[dict]:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if not cleaned:
        return []

    extracted: Dict[str, dict] = {}

    def add_fact(key: str, value: str, category: str = "general"):
        normalized_key = _normalize_memory_key(key)
        value = _normalize_fact_value_for_key(normalized_key, value)
        if not normalized_key or not value:
            return
        extracted[normalized_key] = {
            "key": normalized_key,
            "value": value[:300],
            "category": _normalize_memory_category(category),
        }

    age_match = re.search(r"\bj[’']?\s*ai\s+(\d{1,3})\s+ans\b", cleaned, re.IGNORECASE)
    if age_match:
        add_fact("user_age", f"{age_match.group(1)} ans")

    location_match = re.search(
        r"\b(?:je vis|j'habite|j’habite|je réside|je reside)\s+[àa]\s+([^.,;\n]{2,80})",
        cleaned,
        re.IGNORECASE,
    )
    if location_match:
        location_value = location_match.group(1)
        for stopper in (" et je ", " et j'", " et j’", " mais je "):
            pos = location_value.lower().find(stopper)
            if pos != -1:
                location_value = location_value[:pos]
                break
        add_fact("user_location", location_value)

    role_match = re.search(r"\bje suis\s+([^.\n]{3,120})", cleaned, re.IGNORECASE)
    if role_match:
        role_value = _clean_fact_value(role_match.group(1))
        if any(token in role_value.lower() for token in (
            "entrepreneur", "développeur", "developpeur", "developer", "étudiant",
            "etudiant", "designer", "marketeur", "marketing", "consultant",
            "freelance", "fondateur", "founder", "ceo", "manager", "leader",
        )):
            add_fact("user_role", role_value)

    name_match = re.search(r"\b(?:je m'appelle|mon nom est|appelle[- ]?moi)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40})", cleaned, re.IGNORECASE)
    if name_match:
        add_fact("user_name", name_match.group(1).title())

    objective_match = re.search(r"\b(?:mon objectif(?: principal)? est|mes objectifs sont|je veux|je souhaite)\s+([^.\n]{3,160})", cleaned, re.IGNORECASE)
    if objective_match:
        add_fact("user_objective", objective_match.group(1))

    return list(extracted.values())


def _estimate_tokens(text: str) -> int:
    """Estimation rapide du nombre de tokens (~4 caractères par token)."""
    return len(text) // 4


class SessionMemory:
    """
    Gère l'historique conversationnel d'une session via SQLAlchemy (PostgreSQL/Cloud SQL).
    """

    MAX_TOKEN_BUDGET = 50_000   # Budget token réduit pour stabilité avec Gemini 3 Flash
    SUMMARY_THRESHOLD = 20     # Résumé plus tôt pour garder le contexte manageable
    MAX_MSG_CHARS = 3000       # Troncature par message (évite qu'un deep research monopolise le budget)

    def __init__(self, session_id: str, max_messages: int = 30, user_id: str = "anonymous"):
        self.session_id = session_id
        self.max_messages = max_messages
        self.user_id = user_id

    def _get_or_create_conversation(self, db: Session) -> Conversation:
        conv = db.query(Conversation).filter(Conversation.id == self.session_id).first()
        if not conv:
            conv = Conversation(
                id=self.session_id,
                title="Nouvelle conversation",
                platform="web",
                user_id=self.user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)
        return conv

    def load_messages(self, limit: Optional[int] = None) -> List[BaseMessage]:
        """Charge l'historique de conversation avec gestion du budget tokens."""
        db = SessionLocal()
        try:
            conv = self._get_or_create_conversation(db)
            message_limit = limit or self.max_messages
            rows = (
                db.query(Message)
                .filter(Message.conversation_id == self.session_id)
                .order_by(Message.timestamp.desc())
                .limit(message_limit)
                .all()
            )
            # Sélectionner les messages récents qui tiennent dans le budget token
            result: List[BaseMessage] = []
            token_count = 0
            for row in rows:
                content = row.content or ""
                # Tronquer les messages individuels trop longs (ex: résultats deep research)
                if len(content) > self.MAX_MSG_CHARS:
                    content = content[:self.MAX_MSG_CHARS] + "\n\n[... contenu tronqué pour l'historique]"
                msg_tokens = _estimate_tokens(content)
                if token_count + msg_tokens > self.MAX_TOKEN_BUDGET:
                    break
                token_count += msg_tokens
                if row.role == "user":
                    result.append(HumanMessage(content=content))
                elif row.role == "assistant":
                    result.append(AIMessage(content=content))
                elif row.role == "system":
                    result.append(SystemMessage(content=content))

            result.reverse()  # Remettre en ordre chronologique

            # Injecter le résumé des anciens messages si disponible
            if conv.summary:
                result.insert(0, SystemMessage(content=f"Résumé de la conversation précédente :\n{conv.summary}"))

            return result
        finally:
            db.close()

    async def summarize_if_needed(self, llm) -> bool:
        """Résume les anciens messages si le seuil est dépassé. Retourne True si un résumé a été créé."""
        db = SessionLocal()
        try:
            total = db.query(Message).filter(Message.conversation_id == self.session_id).count()
            if total < self.SUMMARY_THRESHOLD:
                return False

            # Charger les messages les plus anciens (ceux qui seront résumés)
            oldest = (
                db.query(Message)
                .filter(Message.conversation_id == self.session_id)
                .order_by(Message.timestamp.asc())
                .limit(total - 20)  # Garder les 20 plus récents intacts
                .all()
            )
            if len(oldest) < 10:
                return False

            conversation_text = "\n".join(
                f"{'Utilisateur' if r.role == 'user' else 'Assistant'}: {r.content[:500]}"
                for r in oldest if r.role in ("user", "assistant")
            )

            prompt = f"""Résume cette conversation en gardant les informations essentielles (demandes, décisions, résultats importants). Maximum 500 mots.

{conversation_text}

Résumé concis :"""

            response = await llm.ainvoke([HumanMessage(content=prompt)])
            summary = response.content.strip()

            if summary:
                conv = db.query(Conversation).filter(Conversation.id == self.session_id).first()
                if conv:
                    conv.summary = summary
                    db.commit()
                    logger.info(f"📝 Résumé créé pour conversation {self.session_id} ({len(oldest)} messages résumés)")
                    return True
            return False
        except Exception as e:
            logger.error(f"Erreur lors du résumé : {e}")
            return False
        finally:
            db.close()

    def save_message(self, role: str, content: str, attachment: dict = None, response_time: float = None):
        """Sauvegarde un message et met à jour le titre de la conversation."""
        db = SessionLocal()
        try:
            conv = self._get_or_create_conversation(db)
            if conv.title == "Nouvelle conversation" and role == "user":
                conv.title = content[:60] + ("..." if len(content) > 60 else "")
            conv.updated_at = datetime.utcnow()
            msg = Message(
                conversation_id=self.session_id,
                role=role,
                content=content,
                timestamp=datetime.utcnow(),
                attachment_json=attachment,
                response_time=response_time
            )
            db.add(msg)
            db.commit()
        finally:
            db.close()

        if role == "user" and self.user_id != "anonymous" and content:
            try:
                core = CoreMemory(self.user_id)
                immediate_facts: Dict[str, dict] = {}
                for item in _extract_profile_facts_from_text(content):
                    immediate_facts[item["key"]] = item
                for item in _extract_deterministic_facts_from_text(content):
                    immediate_facts[item["key"]] = item
                for item in immediate_facts.values():
                    core.upsert_fact(item["key"], item["value"], item["category"])
                if immediate_facts:
                    logger.info(
                        "🧠 [memory] %s fait(s) profil enregistrés immédiatement pour %s",
                        len(immediate_facts),
                        self.user_id,
                    )
            except Exception as e:
                logger.warning(f"[memory] Échec extraction immédiate des faits: {e}")

    def save_file_record(self, file_name: str, file_url: str, file_type: str = "image", mime_type: str = None, file_size: int = None):
        """Enregistre un fichier dans la base de données de la conversation."""
        db = SessionLocal()
        try:
            # S'assurer que la conversation existe
            self._get_or_create_conversation(db)
            
            f = ConversationFile(
                conversation_id=self.session_id,
                user_id=self.user_id,
                file_name=file_name,
                file_url=file_url,
                file_type=file_type,
                mime_type=mime_type,
                file_size=file_size,
                created_at=datetime.utcnow()
            )
            db.add(f)
            db.commit()
            logger.info(f"💾 [SQL] Fichier enregistré pour conv {self.session_id} (user_id={self.user_id}): {file_name}")
        finally:
            db.close()

    def get_latest_media_reference(self, kinds: Optional[List[str]] = None) -> Optional[Dict[str, str]]:
        """Retourne le dernier média exploitable de la conversation.

        Priorité :
        1. Attachment du dernier message assistant (image/vidéo/document généré)
        2. Dernier fichier enregistré dans la conversation
        """
        wanted = {kind.lower() for kind in kinds} if kinds else None
        db = SessionLocal()
        try:
            recent_messages = (
                db.query(Message)
                .filter(
                    Message.conversation_id == self.session_id,
                    Message.role == "assistant",
                )
                .order_by(Message.timestamp.desc(), Message.id.desc())
                .limit(20)
                .all()
            )

            for row in recent_messages:
                attachment = row.attachment_json
                if not isinstance(attachment, dict):
                    continue
                kind = str(attachment.get("kind") or "").lower()
                url = attachment.get("url")
                data = attachment.get("data")
                if not url and not data:
                    continue
                if wanted and kind not in wanted:
                    continue
                payload = {
                    "kind": kind,
                    "name": attachment.get("name") or "",
                    "type": attachment.get("type") or "",
                    "url": url,
                    "source": "assistant_attachment",
                }
                if data:
                    payload["data"] = data
                return payload

            recent_files = (
                db.query(ConversationFile)
                .filter(ConversationFile.conversation_id == self.session_id)
                .order_by(ConversationFile.created_at.desc())
                .limit(20)
                .all()
            )

            for row in recent_files:
                kind = str(row.file_type or "").lower()
                if wanted and kind not in wanted:
                    continue
                if not row.file_url:
                    continue
                return {
                    "kind": kind,
                    "name": row.file_name or "",
                    "type": row.mime_type or "",
                    "url": row.file_url,
                    "source": "conversation_file",
                }

            return None
        finally:
            db.close()

    def clear(self):
        """Supprime tous les messages de la session."""
        db = SessionLocal()
        try:
            db.query(Message).filter(
                Message.conversation_id == self.session_id
            ).delete()
            db.commit()
        finally:
            db.close()


class CoreMemory:
    """
    Mémoire globale persistante via SQLAlchemy (PostgreSQL/Cloud SQL).
    Stocke des faits clés sur l'utilisateur, l'agence et les préférences.
    """

    def __init__(self, user_id: str = "anonymous"):
        self._user_id = user_id

    def set_user_id(self, user_id: str):
        """Met à jour l'utilisateur courant."""
        self._user_id = user_id

    def upsert_fact(self, key: str, value: str, category: str = "general"):
        normalized_key = _normalize_memory_key(key)
        normalized_value = _normalize_fact_value_for_key(normalized_key, value)
        normalized_category = _normalize_memory_category(category)
        if not normalized_key or not normalized_value:
            return
        db = SessionLocal()
        try:
            # On filtre par user_id pour que chaque utilisateur ait son propre Core Memory
            fact = db.query(CoreMemoryFact).filter(
                CoreMemoryFact.key == normalized_key, 
                CoreMemoryFact.user_id == self._user_id
            ).first()
            
            if fact:
                fact.value = normalized_value
                fact.category = normalized_category
                fact.updated_at = datetime.utcnow()
            else:
                fact = CoreMemoryFact(
                    key=normalized_key, value=normalized_value, category=normalized_category,
                    user_id=self._user_id,
                    created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
                )
                db.add(fact)
            db.commit()
        finally:
            db.close()

    def get_fact(self, key: str) -> Optional[str]:
        normalized_key = _normalize_memory_key(key)
        db = SessionLocal()
        try:
            fact = db.query(CoreMemoryFact).filter(
                CoreMemoryFact.key == normalized_key,
                CoreMemoryFact.user_id == self._user_id
            ).first()
            return fact.value if fact else None
        finally:
            db.close()

    def delete_fact(self, key: str):
        normalized_key = _normalize_memory_key(key)
        db = SessionLocal()
        try:
            db.query(CoreMemoryFact).filter(
                CoreMemoryFact.key == normalized_key,
                CoreMemoryFact.user_id == self._user_id
            ).delete()
            db.commit()
        finally:
            db.close()

    def get_all_facts(self, category: Optional[str] = None) -> List[dict]:
        db = SessionLocal()
        try:
            query = db.query(CoreMemoryFact).filter(CoreMemoryFact.user_id == self._user_id)
            if category:
                query = query.filter(CoreMemoryFact.category == category)
            facts = query.order_by(CoreMemoryFact.category, CoreMemoryFact.key).all()
            return [
                {
                    "id": f.id, "key": f.key, "value": f.value,
                    "category": f.category,
                    "created_at": _utc_iso(f.created_at),
                    "updated_at": _utc_iso(f.updated_at),
                }
                for f in facts
            ]
        finally:
            db.close()

    async def auto_extract_facts(self, messages: List[BaseMessage], llm) -> List[dict]:
        """
        Extrait automatiquement les faits importants depuis l'historique de conversation.
        """
        if not messages:
            return []

        recent = messages[-10:]
        conversation_text = "\n".join(
            f"{'Utilisateur' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}"
            for m in recent
            if isinstance(m, (HumanMessage, AIMessage))
        )
        if not conversation_text.strip():
            return []

        extraction_prompt = f"""Analyse cette conversation et extrais les informations importantes et durables sur l'utilisateur, l'agence ou les projets.

Conversation :
{conversation_text}

Retourne UNIQUEMENT un tableau JSON valide (pas de texte avant ou après).
Format : [{{"key": "cle_unique", "value": "valeur", "category": "categorie"}}]
Catégories disponibles : general, client, agence, preference, projet
Si aucune information importante à mémoriser, retourne : []

Exemples de clés : user_name, user_age, user_location, user_role, user_objective, client_principal, preference_communication, projet_en_cours
Priorité aux faits durables et utiles plus tard : identité, âge, pays/ville, activité, rôle, objectifs, préférences explicites.
Ne mémorise pas les questions génériques ni les réponses de routine."""

        try:
            deterministic_facts: List[dict] = []
            for message in recent:
                if isinstance(message, HumanMessage) and isinstance(message.content, str):
                    cleaned_message = re.sub(r"\s+", " ", message.content.strip())
                    lower_message = cleaned_message.lower()
                    age_match = re.search(r"\bj[’']?\s*ai\s+(\d{1,3})\s+ans\b", cleaned_message, re.IGNORECASE)
                    if age_match:
                        deterministic_facts.append({"key": "user_age", "value": f"{age_match.group(1)} ans", "category": "general"})

                    for prefix in ("je vis à ", "je vis a ", "j'habite à ", "j'habite a ", "j’habite à ", "j’habite a ", "je réside à ", "je réside a ", "je reside à ", "je reside a "):
                        start = lower_message.find(prefix)
                        if start != -1:
                            location_value = cleaned_message[start + len(prefix):]
                            for stopper in (" et je ", " et j'", " et j’", " mais je ", ",", ".", ";"):
                                pos = location_value.lower().find(stopper) if len(stopper) > 1 else location_value.find(stopper)
                                if pos != -1:
                                    location_value = location_value[:pos]
                                    break
                            deterministic_facts.append({"key": "user_location", "value": location_value, "category": "general"})
                            break

                    role_match = re.search(r"\bje suis\s+([^.\n]{3,120})", cleaned_message, re.IGNORECASE)
                    if role_match:
                        role_value = _clean_fact_value(role_match.group(1))
                        if any(token in role_value.lower() for token in (
                            "entrepreneur", "développeur", "developpeur", "developer", "étudiant",
                            "etudiant", "designer", "marketeur", "marketing", "consultant",
                            "freelance", "fondateur", "founder", "ceo", "manager", "leader",
                        )):
                            deterministic_facts.append({"key": "user_role", "value": role_value, "category": "general"})

                    name_match = re.search(r"\b(?:je m'appelle|mon nom est|appelle[- ]?moi)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40})", cleaned_message, re.IGNORECASE)
                    if name_match:
                        deterministic_facts.append({"key": "user_name", "value": name_match.group(1).title(), "category": "general"})

                    deterministic_facts.extend(_extract_profile_facts_from_text(message.content))
                    deterministic_facts.extend(_extract_deterministic_facts_from_text(message.content))

            extracted_map: Dict[str, dict] = {}
            for item in deterministic_facts:
                self.upsert_fact(item["key"], item["value"], item["category"])
                extracted_map[item["key"]] = item

            response = await llm.ainvoke([HumanMessage(content=extraction_prompt)])
            content = response.content.strip()

            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if not json_match:
                if extracted_map:
                    logger.info(f"auto_extract_facts : {len(extracted_map)} fait(s) extraits par heuristique")
                return list(extracted_map.values())

            facts_data = json.loads(json_match.group())
            if not isinstance(facts_data, list):
                if extracted_map:
                    logger.info(f"auto_extract_facts : {len(extracted_map)} fait(s) extraits par heuristique")
                return list(extracted_map.values())

            for item in facts_data:
                if isinstance(item, dict) and "key" in item and "value" in item:
                    key = _normalize_memory_key(str(item["key"]))
                    value = _clean_fact_value(str(item["value"]))
                    category = _normalize_memory_category(str(item.get("category", "general")))
                    if key and value and len(value) < 500:
                        self.upsert_fact(key, value, category)
                        extracted_map[key] = {"key": key, "value": value, "category": category}

            if extracted_map:
                logger.info(f"auto_extract_facts : {len(extracted_map)} fait(s) extraits")
            return list(extracted_map.values())

        except Exception as e:
            logger.debug(f"auto_extract_facts : aucun fait extrait ({e})")
            fallback_facts: Dict[str, dict] = {}
            for message in recent:
                if isinstance(message, HumanMessage) and isinstance(message.content, str):
                    for item in _extract_profile_facts_from_text(message.content):
                        self.upsert_fact(item["key"], item["value"], item["category"])
                        fallback_facts[item["key"]] = item
                    for item in _extract_deterministic_facts_from_text(message.content):
                        self.upsert_fact(item["key"], item["value"], item["category"])
                        fallback_facts[item["key"]] = item
            return list(fallback_facts.values())

    def format_for_prompt(self) -> str:
        """Formate les faits mémorisés pour injection dans le prompt système."""
        facts = self.get_all_facts()
        if not facts:
            return ""

        lines = ["\n## Mémoire Persistante (Core Memory) :"]
        current_category = None
        for fact in facts:
            if fact.get("category") != current_category:
                current_category = fact.get("category", "general")
                lines.append(f"\n### {current_category.capitalize()}")
            lines.append(f"- **{fact.get('key', '?')}** : {fact.get('value', '')}")

        return "\n".join(lines)






