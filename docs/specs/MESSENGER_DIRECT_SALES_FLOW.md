# Messenger Direct Sales Flow

Last updated: 2026-03-27

## Scope

This document describes the current commercial and conversational behavior of the live RAM'S FLARE Facebook Messenger bot.

## Active scope

The bot currently sells or routes only these services:

- Spot publicitaire
- Film documentaire
- Livestream multicamera

The ad offer gallery is separate from the service list. It represents video advertising packages, not the full RAM'S FLARE activity.

## Social proof

When useful, the bot can mention:

- more than 300 completed projects
- spots publicitaires
- films documentaires
- livestreams
- event organization work

## Proof assets

Available proof formats today:

- Spot publicitaire: video proof available
- Film documentaire: video proof available
- Livestream multicamera: no ready proof video inside Messenger yet

For livestream, the bot must stay honest:

- do not invent a video proof
- explain that RAM'S FLARE has already handled several livestreams
- continue the sales flow with quote or meeting capture

## Required flow

The bot must always follow this order, while staying flexible:

1. Accueillir
2. Comprendre
3. Montrer
4. Proposer
5. Pousser
6. Capturer
7. Confirmer

## Flexibility rule

The flow is mandatory, but the bot must not ignore the user’s actual question.

If the client asks:

- what RAM'S FLARE does
- what is inside an offer
- if a meeting is possible
- for a price
- for examples

The bot must:

1. answer that question first
2. then resume the flow with one useful next step

The bot must never repeat the same offer-confirmation loop if the client is clearly asking for details, a meeting, or next steps.

## Expected behavior by message type

### Greeting

Examples:

- Bonjour
- Salama

Expected behavior:

- no automatic offer gallery
- short greeting
- one question to identify the need

### Company explanation

Examples:

- Que fait RAM'S FLARE ?
- Inona ny atao ny RAM'S FLARE ?

Expected behavior:

- explain RAM'S FLARE in one short sentence
- mention the 3 active services
- mention 300+ projects if useful
- send the ad-offer gallery
- ask which offer or service interests the client

### Spot publicitaire

Examples:

- Je veux un spot pub
- Mila spot pub aho

Expected behavior:

- ask one useful qualification question
- examples or pricing can be shown
- push toward quote or phone capture

### Film documentaire

Examples:

- Je veux un film documentaire
- Mila film documentaire aho

Expected behavior:

- ask one useful qualification question
- examples can be shown
- push toward quote or phone capture

### Livestream multicamera

Examples:

- Je veux un livestream
- Mila livestream multicamera aho

Expected behavior:

- explain that RAM'S FLARE already did several livestreams
- no fake proof video
- ask one useful qualification question
- push toward quote or meeting capture

### Offer selected

Examples:

- Offre 4
- Ilay offre 4 no tiko

Expected behavior:

- confirm the chosen offer only if the client is actually choosing
- if the client asks for details, answer with the offer content
- if the client asks for a meeting, answer that directly
- if the client shares contact details, confirm receipt instead of restarting the tunnel

## Media rules

### Gallery

The offer gallery must be sent when the client asks:

- what RAM'S FLARE does
- what offers are available
- to see the ad offers

### Catalog images

Catalog images should be sent on explicit pricing requests only, not repeatedly during qualification.

### Portfolio videos

Portfolio videos should be sent only when the client explicitly asks for examples or realizations.

## Natural language rule

The client can write naturally in French, Malagasy, or English.
The bot must understand natural intent, not only fixed keywords.

This includes:

- short messages
- informal Malagasy wording
- mixed-language wording
- questions inside offer selection
- contact sharing after confirmation

## Current known limits

- Spot ad proof works inline in Messenger
- Documentary proof depends on file size constraints in Messenger
- Livestream has no ready inline proof video yet
- Conversation memory reset clears backend memory only, not visible Messenger history
