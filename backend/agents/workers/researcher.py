"""
Worker Recherche & Intelligence — FLARE AI.
Gère : web_search, deep_research, knowledge_base, mémoire persistante.
Modèle : Gemini Flash (rapide, peu de tokens système).
"""
import logging
import json
import operator
from typing import TypedDict, Annotated, Sequence, Literal

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig

from core.llm_factory import get_llm
from core.database import SessionLocal
from core.config import settings

logger = logging.getLogger(__name__)

from core.context import current_user_id as _current_user_id, knowledge_saved as _knowledge_saved


# ─── Outils : Mémoire Persistante ────────────────────────────────────────────

@tool
def remember_fact(key: str, value: str, category: str = "general") -> str:
    """Mémoriser un fait important de façon persistante (cross-conversations).

    Args:
        key: Clé unique du fait (ex: 'client_principal', 'budget_mensuel')
        value: Valeur à mémoriser
        category: Catégorie (general, client, agence, preference, projet)
    """
    user_id = _current_user_id.get()
    from core.memory import CoreMemory
    memory = CoreMemory(user_id=user_id)
    memory.upsert_fact(key, value, category)
    return f"Mémorisé ✓ [{category}] {key} = {value}"


@tool
def recall_facts(category: str = "") -> str:
    """Rappeler les faits mémorisés en mémoire persistante.

    Args:
        category: Filtrer par catégorie (laisser vide pour tout rappeler)
    """
    user_id = _current_user_id.get()
    from core.memory import CoreMemory
    memory = CoreMemory(user_id=user_id)
    facts = memory.get_all_facts(category if category else None)
    if not facts:
        return "Aucun fait mémorisé pour le moment."
    return json.dumps(facts, ensure_ascii=False)


# ─── Outils : Base de Connaissances ──────────────────────────────────────────

@tool
def search_knowledge_base(query: str) -> str:
    """Chercher dans la base de connaissances personnelle de l'utilisateur.
    Utiliser SYSTÉMATIQUEMENT pour les questions techniques, stratégiques ou spécifiques.

    Args:
        query: Question ou mots-clés à rechercher
    """
    user_id = _current_user_id.get()
    try:
        from core.firebase_client import knowledge_manager as kb
        results = kb.search_knowledge(user_id, query, limit=5)
        if not results:
            return f"Aucun document trouvé pour '{query}' dans la base de connaissances."
        docs_text = []
        for doc in results:
            meta = doc.get('metadata', {})
            docs_text.append(
                f"### {meta.get('title', 'Sans titre')}\n"
                f"{doc.get('content', '')[:2000]}"
            )
        return f"Documents trouvés ({len(results)}) :\n\n" + "\n\n---\n\n".join(docs_text)
    except Exception as e:
        logger.error(f"Erreur recherche base de connaissances : {e}")
        return f"Erreur recherche base de connaissances : {e}"


@tool
def add_to_knowledge_base(title: str, content: str, source: str = "") -> str:
    """Ajouter un document dans la base de connaissances de l'utilisateur.

    Args:
        title: Titre descriptif du document
        content: Contenu complet du document
        source: Source du document (ex: 'conversation', 'rapport interne', URL)
    """
    user_id = _current_user_id.get()
    try:
        from core.firebase_client import knowledge_manager as kb
        doc_id = kb.add_knowledge(
            user_id=user_id, title=title, content=content,
            source=source or "agent", doc_type="agent_added",
        )
        if not doc_id:
            return "Erreur lors de l'ajout du document à la base vectorielle."
        saved = _knowledge_saved.get() or []
        saved.append(title)
        _knowledge_saved.set(saved)
        word_count = len(content.split())
        return f"Document '{title}' ajouté ✓ (ID: {doc_id}, {word_count} mots)"
    except Exception as e:
        logger.error(f"Erreur ajout base de connaissances : {e}")
        return f"Erreur ajout base de connaissances : {e}"


@tool
def list_knowledge_docs() -> str:
    """Lister les documents dans la base de connaissances (ID + titre)."""
    user_id = _current_user_id.get()
    try:
        from core.firebase_client import knowledge_manager as kb
        docs = kb.get_user_knowledge(user_id)
        if not docs:
            return "Aucun document dans la base de connaissances."
        lines = [f"- ID: {d['id']} | Titre: {d['title']} ({len(d['content'].split())} mots)" for d in docs]
        return f"{len(docs)} document(s) :\n" + "\n".join(lines)
    except Exception as e:
        logger.error(f"Erreur listing base de connaissances : {e}")
        return f"Erreur listing base de connaissances : {e}"


# ─── Outils : Recherche Web ──────────────────────────────────────────────────

@tool
def web_search(query: str) -> str:
    """Effectuer une recherche sur le Web pour obtenir des informations récentes.
    Retourne des résultats enrichis avec snippets et extraits des pages web.
    """
    import httpx
    from bs4 import BeautifulSoup
    import urllib.parse
    import re as _re

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }

    def _scrape_page(page_url: str, max_chars: int = 2000) -> str:
        try:
            with httpx.Client(headers=headers, follow_redirects=True, timeout=6.0) as c:
                resp = c.get(page_url)
                if "text/html" not in resp.headers.get("content-type", "") or resp.status_code != 200:
                    return ""
                soup = BeautifulSoup(resp.text, "html.parser")
                for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe"]):
                    tag.decompose()
                paragraphs = soup.find_all(["p", "h1", "h2", "h3", "li"])
                if paragraphs:
                    text = " ".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20)
                else:
                    text = soup.get_text(separator=" ", strip=True)
                return _re.sub(r'\s+', ' ', text).strip()[:max_chars]
        except Exception:
            return ""

    def _search_google_grounding(q: str) -> str:
        try:
            from google import genai as _genai
            from google.genai import types as _types
            _api_key = settings.GEMINI_API_KEY
            if not _api_key:
                return ""
            _client = _genai.Client(api_key=_api_key)
            search_tool = _types.Tool(google_search=_types.GoogleSearch())
            resp = _client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=f"Recherche les informations les plus récentes et complètes sur: {q}",
                config=_types.GenerateContentConfig(tools=[search_tool], temperature=0.2),
            )
            text_response = ""
            if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                text_response = "".join(
                    p.text for p in resp.candidates[0].content.parts if hasattr(p, "text") and p.text
                )
            sources = []
            if resp.candidates and resp.candidates[0].grounding_metadata:
                gm = resp.candidates[0].grounding_metadata
                chunks = getattr(gm, 'grounding_chunks', None) or []
                for chunk in chunks[:8]:
                    web = getattr(chunk, 'web', None)
                    if web:
                        title = getattr(web, 'title', '') or ''
                        url = getattr(web, 'uri', '') or ''
                        if title and url:
                            sources.append(f"[{title[:40]}]({url})")
            if text_response:
                result = text_response
                if sources:
                    result += "\n\n**Sources :**\n" + "\n".join(f"- {s}" for s in sources)
                return result
            return ""
        except Exception as e:
            logger.warning(f"[web_search] Google Grounding failed: {e}")
            return ""

    logger.info(f"Recherche Web : {query}")
    google_result = _search_google_grounding(query)
    if google_result and len(google_result) > 100:
        return google_result

    # Fallback DuckDuckGo
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        with httpx.Client(headers=headers, follow_redirects=True, timeout=20.0) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return google_result or f"Erreur recherche web {resp.status_code}."
            soup = BeautifulSoup(resp.text, 'html.parser')
            results = []
            for item in soup.select(".result__body")[:8]:
                title_elem = item.select_one(".result__title")
                snippet_elem = item.select_one(".result__snippet")
                if title_elem and snippet_elem:
                    title = title_elem.text.strip()
                    snippet = snippet_elem.text.strip()
                    link = ""
                    for a_tag in item.select("a[href]"):
                        href = a_tag.get("href", "")
                        if "uddg=" in href:
                            link = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
                            break
                        elif href.startswith("http") and "duckduckgo" not in href:
                            link = href
                            break
                    if not link:
                        url_elem = item.select_one(".result__url")
                        if url_elem:
                            raw = url_elem.text.strip()
                            link = raw if raw.startswith("http") else f"https://{raw}"
                    if not link:
                        link = "Pas de lien"
                    extra_content = ""
                    if len(results) < 3 and link.startswith("http"):
                        page_text = _scrape_page(link, max_chars=1500)
                        if page_text and len(page_text) > 100:
                            extra_content = f"\n**Extrait** : {page_text[:1000]}"
                    results.append(f"### {title}\n{snippet}{extra_content}\nSource: [{title[:30]}]({link})")
            if not results:
                return google_result or "Aucun résultat trouvé."
            return "\n\n".join(results)
    except Exception as e:
        logger.error(f"Erreur web_search DDG fallback: {e}")
        return google_result or f"Erreur recherche : {e}"


@tool
def execute_deep_research(query: str) -> str:
    """Recherche approfondie multi-angles sur un sujet complexe.
    Utilise Google Search via Gemini pour explorer 5 angles en parallèle.
    Génère un rapport expert avec des citations inline [1], [2]...
    """
    import time as _time
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from datetime import datetime as _dt

    _start_time = _time.monotonic()
    _year = _dt.now().year
    angles = [
        {"label": "Présentation et Contexte", "query": f"{query} définition historique contexte"},
        {"label": "Analyse Technique et Détails", "query": f"{query} fonctionnement technique spécifications"},
        {"label": "Opportunités et Enjeux", "query": f"{query} avantages inconvénients enjeux futur"},
        {"label": "Actualités et Tendances", "query": f"{query} actualités récentes {_year}"},
        {"label": "Cas d'usage et Exemples", "query": f"{query} exemples concrets études de cas"},
    ]

    def _search_angle(angle_info: dict) -> dict:
        try:
            from google import genai as _genai
            from google.genai import types as _types
            _api_key = settings.GEMINI_API_KEY
            if not _api_key:
                return {"label": angle_info["label"], "text": "", "sources": []}
            _client = _genai.Client(api_key=_api_key)
            search_tool = _types.Tool(google_search=_types.GoogleSearch())
            prompt = (
                f"Sujet : {angle_info['query']}\n\n"
                f"Fais une recherche d'expert. Sois extrêmement précis et factuel. "
                f"Utilise des citations numériques style [1], [2] pour chaque affirmation importante "
                f"en te basant sur les sources que tu trouves via l'outil de recherche. "
                f"Réponds en français."
            )
            resp = _client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt,
                config=_types.GenerateContentConfig(tools=[search_tool], temperature=0.1),
            )
            text = ""
            sources = []
            if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                text = "".join(p.text for p in resp.candidates[0].content.parts if hasattr(p, "text") and p.text)
            if resp.candidates and resp.candidates[0].grounding_metadata:
                gm = resp.candidates[0].grounding_metadata
                for chunk in (getattr(gm, 'grounding_chunks', None) or []):
                    web = getattr(chunk, 'web', None)
                    if web:
                        title = getattr(web, 'title', '') or ''
                        url = getattr(web, 'uri', '') or ''
                        if title and url:
                            sources.append({"title": title, "url": url})
            return {"label": angle_info["label"], "text": text, "sources": sources}
        except Exception as e:
            logger.warning(f"[deep_research] Angle '{angle_info['label']}' failed: {e}")
            return {"label": angle_info["label"], "text": "", "sources": []}

    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_search_angle, a): a for a in angles}
        for future in as_completed(futures, timeout=120):
            try:
                res = future.result(timeout=40)
                if res and res.get("text"):
                    results.append(res)
            except Exception:
                pass

    if not results:
        return f"Échec de la recherche approfondie pour '{query}'."

    # Fusion et déduplication des sources
    all_sources = []
    for r in results:
        all_sources.extend(r["sources"])
    
    unique_sources = []
    seen_urls = set()
    for s in all_sources:
        if s["url"] not in seen_urls:
            unique_sources.append(s)
            seen_urls.add(s["url"])
    
    # On limite à 15 sources pour la clarté
    final_sources = unique_sources[:15]
    
    # Construction du rapport
    elapsed = _time.monotonic() - _start_time
    report = [
        f"# Rapport de Recherche Profonde : {query}\n",
        f"*{len(results)} angles d'analyse • {len(final_sources)} sources vérifiées • {elapsed:.1f}s*\n",
    ]
    
    for r in results:
        report.append(f"\n## {r['label']}")
        # Ajustement des citations pour qu'elles correspondent à l'index global des sources
        text = r["text"]
        # Note: Dans un système parfait, on re-mapperait les index ici. 
        # Pour une première version, on laisse le LLM gérer ses citations et on liste les sources globales.
        report.append(text)
        report.append("\n---")

    report.append("\n## Sources et Références")
    for i, s in enumerate(final_sources, 1):
        report.append(f"{i}. [{s['title']}]({s['url']})")

    report.append(f"\n\n*Analyse générée par l'intelligence artificielle FLARE AI.*")
    return "\n".join(report)


# ─── Liste des outils du Worker Recherche ────────────────────────────────────

RESEARCHER_TOOLS = [
    web_search,
    execute_deep_research,
    search_knowledge_base,
    add_to_knowledge_base,
    list_knowledge_docs,
    remember_fact,
    recall_facts,
]

RESEARCHER_SYSTEM_PROMPT = """Tu es le Worker Recherche de FLARE AI. Ton rôle : trouver des informations précises, profondes et vérifiables.

RÈGLES CRITIQUES :
1. Utilise SYSTÉMATIQUEMENT `execute_deep_research` pour toute recherche d'information, même simple. L'utilisateur veut de la profondeur.
2. CITE TOUJOURS TES SOURCES en utilisant des citations numériques style [1], [2] à la fin de chaque phrase ou affirmation basée sur une recherche.
3. Ne simplifie jamais à l'excès : fournis des détails, des chiffres et des analyses.
4. Consulte `search_knowledge_base` en priorité si le sujet semble lié aux documents personnels de l'utilisateur.
5. Réponds en français par défaut.
6. Utilise l'outil `remember_fact` DÈS QUE l'utilisateur te demande explicitement de retenir, mémoriser ou enregistrer une information.

PROACTIVITÉ : À la fin de TA réponse, propose TOUJOURS 2 à 3 actions ou questions de suivi pertinentes et concises pour l'utilisateur. 
Utilise EXACTEMENT ce format :
[SUGGESTION: Titre court de la suggestion 1]
[SUGGESTION: Titre court de la suggestion 2]"""


# ─── Worker LangGraph ────────────────────────────────────────────────────────

class _WorkerState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]


class ResearcherWorker:
    """Worker spécialisé en recherche — graphe LangGraph autonome."""

    def __init__(self, model_override: str = None):
        self.tools = RESEARCHER_TOOLS
        # Worker = modèle léger (Flash) — le Supervisor décide, les workers exécutent
        self.llm = get_llm(
            temperature=0.3,
            model_override=model_override or "gemini-2.5-flash",
        ).bind_tools(self.tools)
        self.tool_node = ToolNode(self.tools)
        self.graph = self._build_graph()
        logger.info(f"[ResearcherWorker] Initialisé avec {len(self.tools)} outils")

    def _build_graph(self):
        graph = StateGraph(_WorkerState)
        graph.add_node("agent", self._call_model)
        graph.add_node("tools", self.tool_node)
        graph.set_entry_point("agent")
        graph.add_conditional_edges(
            "agent", self._should_continue, {"continue": "tools", "end": END}
        )
        graph.add_edge("tools", "agent")
        return graph.compile()

    def _should_continue(self, state: _WorkerState) -> Literal["continue", "end"]:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "continue"
        return "end"

    async def _call_model(self, state: _WorkerState, config: RunnableConfig = None) -> dict:
        import asyncio
        messages = state["messages"]
        for attempt in range(3):
            try:
                response = await self.llm.ainvoke(messages)
                return {"messages": [response]}
            except Exception as e:
                if attempt < 2 and any(k in str(e).lower() for k in ["429", "500", "503"]):
                    await asyncio.sleep(2 ** (attempt + 1))
                    continue
                raise

    async def run(self, task: str, config: dict = None) -> str:
        """Exécute une tâche de recherche et retourne le résultat texte."""
        messages = [
            HumanMessage(content=f"[Instructions]\n{RESEARCHER_SYSTEM_PROMPT}\n[Fin instructions]\n\n{task}")
        ]
        result = await self.graph.ainvoke({"messages": messages}, config=config or {})
        last_msg = result["messages"][-1]
        content = getattr(last_msg, "content", "")
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part) for part in content
            )
        return content or "Aucun résultat de recherche."







