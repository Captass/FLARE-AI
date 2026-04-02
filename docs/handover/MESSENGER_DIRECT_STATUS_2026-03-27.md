# Messenger Direct Status - 2026-03-27

## Live status

- Service: `messenger-direct`
- Region: `europe-west9`
- Live revision: `messenger-direct-00047-kcp`
- URL: `https://messenger-direct-236458687422.europe-west9.run.app`

## Current product state

The Facebook Messenger sales bot is now aligned with the RAM'S FLARE commercial scope:

- Spot publicitaire
- Film documentaire
- Livestream multicamera

The bot no longer exposes `conseiller` as a user-facing role.
Human escalation is phrased as `l'equipe RAM'S FLARE`.

## What was fixed

- Greeting no longer auto-sends the offer gallery
- RAM'S FLARE explanation is now aligned with the 3 real services
- Social proof `300+ projects` is available in the messaging
- Offer carousel remains for ad offers only
- Spot proof video works
- Livestream no longer invents proof videos
- Client memory now keeps known name and phone number in backend contact state
- The bot now asks for `numero de telephone`, never `WhatsApp`
- The bot no longer re-asks for contact details when they are already known
- Short Malagasy confirmation `Ie` is now correctly understood as offer confirmation
- Short neutral replies like `Ie` or a phone number now keep the conversation language memory
- Offer selection is more flexible:
  - can answer a detail question
  - can answer a meeting request
  - can confirm contact receipt after phone sharing

## Files updated

- `chatbot Facebook/direct_service/app.py`
- `chatbot Facebook/direct_service/catalog_media/catalog_manifest.json`
- `docs/prompts/MESSENGER_DIRECT_SYSTEM_PROMPT.md`
- `docs/specs/MESSENGER_DIRECT_SALES_FLOW.md`
- `docs/handover/MESSENGER_DIRECT_STATUS_2026-03-27.md`

## Test status

Validated locally with simulated Messenger sends:

- `Bonjour`
- `Salama`
- `Que fait RAM'S FLARE ?`
- `Inona ny atao ny RAM'S FLARE ?`
- `prix spot pub`
- `Asehoy ahy ny ohatra spot pub`
- `Asehoy ahy ny ohatra livestream`
- `Ilay offre 4 no tiko. Afaka manao rendez vous ve azafady ?`
- `0340210731, Kévin`
- `Inona tsara zany ny ao anatiny io offre 4 io ?`

- `Ilay offre 4 no tiko -> Ie -> 0340210731 -> Offre 4 -> Ie`
- `Salama` does not auto-send offers
- `Inona ny atao ny RAM'S FLARE ?` sends the 5-offer gallery
- `Asehoy ahy ny ohatra spot pub` sends the spot proof video
- `Ohatrinona ny spot pub ?` now stays in Malagasy
- `Mila spot pub aho -> Ho an'ny entreprise` now keeps the qualification flow instead of drifting
- `Ilay offre 4 no tiko. Afaka manao rendez vous ve azafady ?` now answers the rendez-vous request first

## Current known limits

- Documentary inline proof may still be limited by Messenger file size
- Livestream still has no ready proof video asset
- Memory reset only clears backend context, not the visible chat history in Messenger

## Recommended next step

Use the current live revision for another round of real Messenger testing with natural user phrasing, then freeze the sales wording and update the final public launch checklist.
