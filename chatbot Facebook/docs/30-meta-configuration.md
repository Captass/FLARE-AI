# Meta Configuration

## Configuration active

- Callback URL : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- Verify token : `ramsflare_webhook_2026`
- Graph version : `v25.0`

## OAuth FLARE AI

- Redirect URI backend : `https://flare-backend-ynhuvwocwq-ew.a.run.app/api/facebook/callback`
- Redirect URI secondaire acceptee : `https://flare-backend-236458687422.europe-west1.run.app/api/facebook/callback`

Au 31 mars 2026, le dialogue Meta accepte ces redirect URI et ouvre la page de connexion au lieu de renvoyer une erreur de redirect bloque.

## Webhook

Le service supporte :

- verification webhook Meta par challenge
- reception des messages entrants
- reception des postbacks

## Champs recommandés

Au minimum :

- `messages`
- `messaging_postbacks`

## Notes

- l'ancienne URL n8n ne doit plus etre utilisee
- si Meta garde une ancienne config, la supprimer puis reenregistrer la nouvelle
