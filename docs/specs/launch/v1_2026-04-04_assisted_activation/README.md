# FLARE AI - v1 Lancement stable - Activation assistee

**Date de version** : 4 avril 2026
**Statut** : en cours d'implementation

---

## Promesse client lundi

1. Le client cree son compte et son espace
2. Le client choisit une offre
3. Le client paie par methode locale manuelle (MVola ou autre methode configuree)
4. Le client envoie sa preuve de paiement
5. Le client remplit son formulaire de configuration chatbot
6. Le client ajoute le compte Facebook operateur FLARE comme admin de sa page
7. FLARE valide le paiement, connecte la page, active le chatbot, teste Messenger
8. Le client voit son chatbot actif et peut modifier ses preferences, son catalogue, le ON/OFF global, le mode bot/humain par conversation

## Promesse operateur FLARE

1. Queue d'activations avec filtres et statuts
2. Verification rapide des preuves de paiement
3. Activation Facebook pour le compte du client via endpoints internes
4. Checklist de livraison complete
5. Suivi des commandes issues des chatbots
6. SLA cible : 15 minutes

## Ce qui n'est PAS dans cette version

- Self-serve Meta public (le client ne connecte pas Facebook seul)
- Integration API MVola / Orange Money / Airtel Money
- Validation automatique de paiement
- Automatisation complete du workflow

## Fichiers de reference

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [FINAL_ARCHITECTURE.md](01_FINAL_ARCHITECTURE.md) | Architecture business et technique |
| 02 | [CLIENT_FLOW.md](02_CLIENT_FLOW.md) | Tunnel client complet |
| 03 | [OPERATOR_FLOW.md](03_OPERATOR_FLOW.md) | Queue et workflow operateur |
| 04 | [MANUAL_PAYMENTS.md](04_MANUAL_PAYMENTS.md) | Paiement manuel local |
| 05 | [CHATBOT_SETUP_AND_HANDOFF.md](05_CHATBOT_SETUP_AND_HANDOFF.md) | Configuration chatbot et handoff |
| 06 | [ORDERS_AND_DASHBOARD.md](06_ORDERS_AND_DASHBOARD.md) | Commandes et tableaux de bord |
| 07 | [API_DATA_MODELS.md](07_API_DATA_MODELS.md) | Endpoints, modeles, permissions |
| 08 | [UI_WORDING_AND_STATES.md](08_UI_WORDING_AND_STATES.md) | Textes, CTA et etats d'ecran |
| 09 | [ACCEPTANCE_TESTS.md](09_ACCEPTANCE_TESTS.md) | Cas de test complets |
| 10 | [POST_LAUNCH_V2_SELF_SERVE.md](10_POST_LAUNCH_V2_SELF_SERVE.md) | Roadmap post-lundi |

## Regle

Ce dossier fait foi pour la version vendue lundi. En cas de doute, ce dossier prime sur toute autre documentation.
