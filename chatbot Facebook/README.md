# Chatbot Facebook

Solution de reponse entrante Facebook Messenger pour RAM'S FLARE.

La solution active n'utilise plus n8n ni FLARE AI pour les reponses live.
Elle repose sur un service direct deploye sur Cloud Run, branche a Messenger, Google Gemini, Telegram et un dashboard interne.

## Statut actuel

- webhook Meta valide
- service deploye sur Cloud Run
- reponse IA via `gemini-2.5-flash-lite`
- notifications Telegram conditionnelles
- dashboard web de suivi actif
- base SQLite integree pour journaliser les contacts, events, tokens et couts

## Entrees principales

- [docs/README.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/README.md)
- [direct_service/README.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/README.md)
- [direct_service/DEVELOPER_GUIDE.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/DEVELOPER_GUIDE.md)
- [docs/31-meta-review-kit.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/31-meta-review-kit.md)
- [docs/90-post-review-roadmap.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/90-post-review-roadmap.md)

## Structure

- `docs/` : documentation projet et exploitation
- `direct_service/` : service direct en production
- `output/spreadsheet/` : fichiers Sheets prets a importer
- `templates/` : headers CSV
- `workflows/` : archive de la piste n8n

## URLs utiles

- service : `https://messenger-direct-236458687422.europe-west9.run.app`
- webhook : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- dashboard : `https://messenger-direct-236458687422.europe-west9.run.app/dashboard`

## Note

La solution a relire en priorite est le `direct_service`.
Les vieux prompts et plusieurs docs obsoletes ont ete supprimes pour eviter de gaspiller des tokens au prochain agent.
