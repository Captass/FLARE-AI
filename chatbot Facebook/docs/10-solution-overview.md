# Solution Overview

## Objectif

Recevoir les messages Facebook Messenger, repondre vite comme un agent commercial RAM'S FLARE, notifier un responsable seulement quand il le faut, et garder une trace exploitable.

## Solution retenue

La solution active est un service direct sur Cloud Run qui :

1. recoit les webhooks Messenger
2. classe rapidement le type de demande
3. appelle Google Gemini `gemini-2.5-flash-lite` directement
4. repond au client sur Messenger
5. enregistre les messages, tokens, couts et latence en SQLite
6. alimente le dashboard
7. notifie Telegram seulement en cas d'escalade utile

FLARE AI n'est plus dans le flux live de reponse.

## Avantages

- reponse rapide
- cout bas
- architecture plus simple
- dashboard et couts visibles
- moins de risque de casser FLARE AI

## Limites actuelles

- Google Sheets n'est pas encore branche en ecriture automatique
- la persistence est encore locale au service
- le dashboard n'est pas une vraie base centralisee
