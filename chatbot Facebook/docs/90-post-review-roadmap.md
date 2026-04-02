# Post Review Roadmap

## Etat actuel

Ce qui est deja en place :

- webhook direct sur Cloud Run
- reponse directe via Gemini
- dashboard web simple
- Telegram conditionnel
- suivi des tokens et couts

## Priorites suivantes

1. dashboard externe pour responsable ou direction
2. dashboard integre FLARE AI
3. dashboard integre agent CM
4. envoi de photos ou documents via Drive
5. envoi de liens video approuves
6. persistence plus robuste que SQLite si necessaire

## Dashboard externe

Le dashboard externe doit montrer surtout :

- conversations recentes
- leads chauds
- demandes de devis
- conversations en attente humaine
- statut de prise en charge
- couts et volume du jour

## Dashboard integre FLARE AI

Le dashboard integre a FLARE AI doit permettre :

- file de conversations
- resume IA
- raison d'escalade
- proposition de reponse
- acces aux assets autorises

## Telegram

La logique conditionnelle est deja en place.
Les futures evolutions doivent seulement l'affiner.

Telegram doit notifier seulement si :

- besoin humain
- devis ou rendez-vous
- commande urgente
- message sensible
- blocage ou fallback IA

## Assets

L'agent doit pouvoir :

- envoyer des photos ou documents approuves
- envoyer des liens video approuves
- tracer ce qui a ete envoye

## Ordre conseille

### Phase 1

- filtres dashboard
- vues conversations a reprendre
- meilleures etiquettes metier

### Phase 2

- dashboard externe manager

### Phase 3

- dashboard integre FLARE AI
- dashboard integre agent CM

### Phase 4

- bibliotheque d'assets approuves
- Drive pour photos et documents
- liens video approuves

### Phase 5

- Google Sheets si encore utile
- stockage distant plus robuste
