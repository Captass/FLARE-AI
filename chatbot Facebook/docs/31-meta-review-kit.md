# Meta Review Kit

## Objectif

Soumettre `pages_messaging` a Meta sans casser le flux deja valide en production.

## Statut reel au 26 mars 2026

La preparation de review est terminee.

- `App settings` complete
- `Allowed usage` complete
- `Data handling` complete
- `Reviewer instructions` complete
- business verification Meta envoyee et en review

Tant que Meta n'a pas termine la verification business, la validation finale reste en attente.

## Permission demandee

- `pages_messaging`

## Configuration reviewer a garder stable

- `Callback URL` : `https://messenger-direct-236458687422.europe-west9.run.app/webhook/facebook`
- `Verify token` : `ramsflare_webhook_2026`

## Texte recommande pour la soumission

### App Review Notes

```text
Our app is used by RAM'S FLARE to manage incoming customer conversations from our Facebook Page through Messenger.

When a customer sends a message to the Page, our backend receives the webhook event, generates a short automated reply through our internal assistant, and sends the answer back in Messenger.

The permission pages_messaging is required so our business Page can receive customer messages and respond to them in Messenger.

This permission is not used to send spam or promotional outreach. It is only used to respond to user-initiated conversations with our Page.
```

### Detailed reviewer scenario

```text
1. Open the Facebook Page Messenger entry point.
2. Send a simple message such as "Bonjour" or "Hello".
3. The backend receives the message through the Messenger webhook.
4. The app generates a short customer support reply.
5. The reply is sent back to the same Messenger conversation.
6. Internal follow-up is logged in our dashboard for our team.
```

## Ce qu'il faut montrer dans la video

- la Page Facebook ou l'entree Messenger
- un message entrant envoye par un compte de test
- la reponse automatique dans Messenger
- le dashboard interne qui confirme la reception du message

Le script detaille est dans [32-meta-review-video-script.md](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/docs/32-meta-review-video-script.md).

## Perimetre a geler pendant la review

Ne pas changer pendant la review :

- `Callback URL`
- `Verify token`
- permission demandee
- Page connectee
- logique visible du scenario filme
- texte des etapes donnees au reviewer

## Changements acceptables pendant la review

Ces changements sont possibles tant qu'ils ne modifient pas le scenario reviewer :

- documentation
- logs
- dashboard interne
- structure de base de donnees
- refactor interne
- fonctionnalites futures desactivees derriere un flag

## Changements a reporter apres la review

- nouvelle logique d'escalade humaine visible par le reviewer
- nouvelle interface conversationnelle
- changement de ton majeur des reponses
- nouvelle logique d'envoi d'assets
- nouvelle politique Telegram si elle change le comportement visible dans la demo

## Checklist juste avant soumission

- le webhook Meta est valide
- le test Messenger fonctionne en vrai
- la Page et le token utilises sont les bons
- la video de demo est enregistree
- le texte de soumission est colle en anglais
- aucun changement critique n'est en cours sur le flux Messenger

## Checklist pendant l'attente Meta

- ne pas toucher au flux reviewer
- surveiller les emails Meta
- garder le service live accessible
- conserver la video et les textes de soumission
