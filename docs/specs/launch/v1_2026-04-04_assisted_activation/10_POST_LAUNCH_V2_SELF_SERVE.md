# 10 - Post-lancement : roadmap v2 self-serve

## Ce qui est volontairement repousse apres lundi

### Self-serve Meta public
- le client connecte Facebook seul via OAuth
- necessite : app Meta validee publiquement, scopes approuves
- pre-requis : validation Meta Business Verification
- la v1 contourne ce blocage via l'activation assistee

### Vraie integration mobile money
- API MVola / Orange Money / Airtel Money
- validation automatique de paiement
- webhook de confirmation
- reconciliation automatique
- pre-requis : accords commerciaux avec les operateurs

### Automatisation complete du workflow
- passage automatique de `payment_submitted` a `payment_verified` via webhook mobile money
- declenchement automatique de l'activation Facebook apres validation paiement
- test Messenger automatise
- notification automatique de livraison
- SLA = 0 minutes (instantane)

### CRM complet des commandes
- suivi detaille des commandes avec pipeline
- historique client
- relance automatique
- tableaux de bord avances
- export CSV/Excel

### Multi-pages par organisation
- plusieurs pages Facebook actives simultanement
- routage des conversations par page
- dashboard par page

### Automatisations avancees
- workflows personnalises par le client
- declencheurs conditionnels
- actions automatiques (email, SMS, etc.)

### Analytics avances
- entonnoir de conversion Messenger
- ROI par campagne
- segmentation contacts
- A/B testing messages

---

## Ordre de priorite suggere pour la v2

1. Self-serve Meta (debloque la scalabilite)
2. Integration mobile money (debloque le paiement autonome)
3. Automatisation workflow (reduit la charge operateur)
4. Multi-pages (debloque les clients multi-marques)
5. CRM commandes (ameliore le suivi)
6. Analytics avances (ameliore la visibilite)
7. Automatisations client (valeur ajoutee premium)

---

## Criteres de passage en v2

- v1 stable depuis au moins 1 semaine
- 5+ clients actifs
- workflow operateur rode
- pas de bug critique en production
- feedback clients recueillis et priorises
