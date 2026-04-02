"""
Groupe de Prosp — Coordinateur d'Essaim (9 agents).

Architecture LangGraph avec traitement asynchrone séquentiel conditionnel :
Chercheur → Analyste Web → Qualificateur → Rédacteur → Compliance
→ Gestionnaire Envoi → Gestionnaire Suivi → Gestionnaire Réponses → Reporting
"""
import logging
from typing import Literal

from langgraph.graph import StateGraph, END

from .agents_def import (
    agent_chercheur,
    agent_analyste_web,
    agent_qualificateur,
    agent_redacteur,
    agent_compliance,
    agent_gestionnaire_envoi,
    agent_gestionnaire_suivi,
    agent_gestionnaire_reponses,
    agent_reporting,
)

logger = logging.getLogger(__name__)


def _router(state: dict) -> str:
    """Routeur conditionnel basé sur l'étape courante du swarm."""
    step = state.get("step", "chercheur")

    routing = {
        "analyste_web": "analyste_web",
        "qualificateur": "qualificateur",
        "redacteur": "redacteur",
        "compliance": "compliance",
        "gestionnaire_envoi": "gestionnaire_envoi",
        "gestionnaire_suivi": "gestionnaire_suivi",
        "gestionnaire_reponses": "gestionnaire_reponses",
        "reporting": "reporting",
        "done": END,
    }

    # Arrêt anticipé si aucun lead qualifié
    if step == "redacteur" and not state.get("qualified_leads"):
        logger.warning("[Swarm] Aucun lead qualifié — arrêt de la campagne")
        return "reporting"

    # Arrêt anticipé si aucun email à envoyer
    if step == "gestionnaire_envoi" and not state.get("approved_emails"):
        logger.warning("[Swarm] Aucun email approuvé — arrêt")
        return "reporting"

    return routing.get(step, END)


def _build_swarm_graph():
    """Construit et compile le graphe LangGraph du swarm."""
    graph = StateGraph(dict)

    # Ajout des 9 nœuds agents
    graph.add_node("chercheur", agent_chercheur)
    graph.add_node("analyste_web", agent_analyste_web)
    graph.add_node("qualificateur", agent_qualificateur)
    graph.add_node("redacteur", agent_redacteur)
    graph.add_node("compliance", agent_compliance)
    graph.add_node("gestionnaire_envoi", agent_gestionnaire_envoi)
    graph.add_node("gestionnaire_suivi", agent_gestionnaire_suivi)
    graph.add_node("gestionnaire_reponses", agent_gestionnaire_reponses)
    graph.add_node("reporting", agent_reporting)

    # Point d'entrée
    graph.set_entry_point("chercheur")

    # Edges conditionnels après chaque nœud
    for node in [
        "chercheur",
        "analyste_web",
        "qualificateur",
        "redacteur",
        "compliance",
        "gestionnaire_envoi",
        "gestionnaire_suivi",
        "gestionnaire_reponses",
    ]:
        graph.add_conditional_edges(
            node,
            _router,
            {
                "analyste_web": "analyste_web",
                "qualificateur": "qualificateur",
                "redacteur": "redacteur",
                "compliance": "compliance",
                "gestionnaire_envoi": "gestionnaire_envoi",
                "gestionnaire_suivi": "gestionnaire_suivi",
                "gestionnaire_reponses": "gestionnaire_reponses",
                "reporting": "reporting",
                END: END,
            },
        )

    graph.add_edge("reporting", END)

    return graph.compile()


class ProspSwarm:
    """
    Gestionnaire du Groupe de Prosp.
    Lance et supervise l'essaim de 9 agents en mode asynchrone.
    """

    def __init__(self):
        self.graph = _build_swarm_graph()

    async def run_campaign(
        self,
        campaign_id: str,
        sector: str,
        city: str = "",
        target_count: int = 10,
        email_subject: str = "",
    ) -> dict:
        """
        Exécute une campagne de prospection complète.

        Args:
            campaign_id: ID de la campagne en DB
            sector: Secteur d'activité cible
            city: Ville ou région (optionnel)
            target_count: Nombre d'entreprises à cibler
            email_subject: Objet d'email personnalisé (auto-généré si vide)

        Returns:
            État final du swarm avec le rapport
        """
        initial_state = {
            "campaign_id": campaign_id,
            "sector": sector,
            "city": city,
            "target_count": target_count,
            "email_subject": email_subject,
            "step": "analyste_web",  # Sera mis à jour par agent_chercheur
            "raw_leads": [],
            "enriched_leads": [],
            "qualified_leads": [],
            "drafted_emails": [],
            "approved_emails": [],
            "sent_leads": [],
        }

        logger.info(f"[Swarm] Démarrage campagne {campaign_id} — {sector} / {city}")

        try:
            final_state = await self.graph.ainvoke(initial_state)
            logger.info(f"[Swarm] Campagne {campaign_id} terminée")
            return final_state
        except Exception as e:
            logger.error(f"[Swarm] Erreur campagne {campaign_id}: {e}")
            raise






