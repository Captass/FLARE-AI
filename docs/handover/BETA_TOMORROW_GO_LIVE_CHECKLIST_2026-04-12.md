# FLARE AI - Checklist go-live beta demain

Derniere mise a jour : 12 avril 2026

## Objet

Cette checklist sert a une seule chose :

- decider si FLARE AI est assez operationnel pour ouvrir la beta assistee demain

Elle ne cherche pas le parfait.
Elle cherche le `minimum solide` pour vendre, onboarder, activer, et supporter un premier client sans casser le flux.

## Decision cible

Demain, la seule decision autorisable est :

- `GO beta assistee`

La decision non autorisable demain sans nouveaux tests live est :

- `GO beta publique sans reserve`

## Definition du minimum operationnel

Pour etre `op demain`, il faut que FLARE AI sache faire sans improvisation :

1. creer un compte et un espace
2. faire choisir une offre
3. faire payer manuellement
4. recevoir une preuve
5. faire verifier la preuve par FLARE
6. capturer la page Facebook cible et la configuration bot
7. faire reprendre la demande par un operateur FLARE
8. activer le chatbot manuellement
9. tester Messenger
10. laisser le client exploiter le bot actif
11. traiter un signalement ou un blocage

Si un de ces 11 points casse, le lancement beta de demain est fragile.

## Verite produit pour demain

Demain, FLARE AI ne vend pas :

- un self-serve Meta complet
- une activation instantanee sans intervention humaine

Demain, FLARE AI vend :

- un chatbot Facebook FLARE AI
- avec paiement manuel
- activation assistee par FLARE
- support humain pendant l'onboarding

## Checklist go/no-go

### Bloc A - Infra et acces

- [ ] frontend public accessible
- [ ] app connectee accessible
- [ ] backend health OK
- [ ] compte admin FLARE fonctionnel
- [ ] compte client de test fonctionnel
- [ ] variables de paiement manuel configurees
- [ ] variables Facebook/OAuth deja configurees et stables

Si un point est KO :

- pas de lancement client payant le lendemain matin

### Bloc B - Tunnel client

- [ ] creation de compte OK
- [ ] creation d'espace OK
- [ ] espace demarre bien en `free`
- [ ] choix d'offre standard OK
- [ ] preuve de paiement soumise sans erreur
- [ ] formulaire chatbot enregistrable
- [ ] page cible lisible dans le dossier
- [ ] statut client compréhensible apres soumission

Si un point est KO :

- pas de lancement commercial demain

### Bloc C - Operations FLARE

- [ ] l'admin voit bien la queue `Paiements`
- [ ] l'admin peut verifier un paiement
- [ ] l'admin peut rejeter un paiement
- [ ] l'admin voit bien la queue `Activations`
- [ ] l'admin peut assigner un dossier
- [ ] l'admin peut changer les statuts valides
- [ ] l'admin peut ajouter une note
- [ ] l'admin voit bien les contacts client
- [ ] l'admin voit bien la page cible par ID
- [ ] l'admin voit si l'acces FLARE page est confirme
- [ ] l'admin voit bien les `Signalements`

Si un point est KO :

- pas de lancement sans mitigation manuelle ecrite

### Bloc D - Activation manuelle Facebook

- [ ] le compte operateur sait quelle page traiter
- [ ] l'acces page FLARE est effectivement present
- [ ] la page peut etre connectee / verifiee
- [ ] le bot peut etre active
- [ ] le test Messenger passe
- [ ] le dossier peut passer `testing -> active`
- [ ] le client voit ensuite le bot actif

Si un point est KO :

- pas de beta payante demain

### Bloc E - Support et incident

- [ ] un paiement invalide peut etre rejete proprement
- [ ] un acces page manquant peut etre bloque puis repris
- [ ] un signalement client remonte bien a l'admin
- [ ] un dossier peut etre mis `blocked` avec raison
- [ ] l'equipe sait qui traite quoi demain

Si un point est KO :

- le lancement reste possible seulement si le volume client est tres faible et les roles sont attribues explicitement

## Repartition minimale de l'equipe demain

### 1. Operateur principal

Responsable de :

- verifier les paiements
- assigner et suivre les activations
- centraliser les blocages

### 2. Operateur Facebook

Responsable de :

- verifier l'acces page
- connecter/verifier la page cible
- activer le bot
- faire le test Messenger

### 3. Dev de garde

Responsable de :

- corriger un incident critique
- debloquer une incoherence de dossier
- verifier les logs et le backend si un flux casse

Sur petit volume, une meme personne peut cumuler `operateur principal + operateur Facebook + dev`, mais alors il faut assumer un lancement tres controle.

## Ordre exact pour demain matin

### T-90 min

1. verifier frontend public
2. verifier app connectee
3. verifier backend health
4. ouvrir admin FLARE
5. verifier les methodes de paiement affichees
6. verifier la presence de la page Facebook de test et du compte de test

### T-60 min

1. faire un dry-run client complet avec un compte test
2. envoyer une preuve de paiement test
3. verifier qu'elle remonte bien dans l'admin
4. verifier que le dossier d'activation porte la bonne page cible

### T-45 min

1. verifier un paiement test
2. assigner le dossier
3. passer les statuts jusqu'a `testing`
4. verifier que la logique de transitions ne casse pas

### T-30 min

1. faire le test Messenger reel
2. passer a `active`
3. recharger cote client
4. verifier que le client voit bien le bot actif

### T-15 min

1. creer un signalement test
2. verifier qu'il arrive dans l'admin
3. mettre a jour son statut
4. verifier qu'un blocage peut etre documente sans perdre le dossier

### T-0

Si tous les blocs critiques sont OK :

- `GO beta assistee`

Sinon :

- report partiel
- beta reservee a un client pilote encadre

## Seuil minimum de lancement demain

Demain, le lancement est acceptable si :

- 1 parcours client complet de test passe
- 1 verification paiement passe
- 1 activation manuelle passe
- 1 test Messenger reel passe
- 1 signalement test remonte

Sans ces 5 preuves, dire `on est pret` est trop faible.

## Ce qu'il ne faut pas faire demain

- promettre un self-serve complet
- promettre une activation instantanee
- onboarder plusieurs clients en parallele si un seul operateur traite tout
- vendre a grande echelle avant le premier parcours complet reussi
- masquer un blocage au client au lieu de le noter dans le dossier

## Mitigations autorisees pour demain

Si une partie reste fragile mais non bloquante :

- limiter l'ouverture a 1 ou 2 clients pilotes
- annoncer un delai d'activation humain
- faire valider tout paiement par un humain avant promesse de delai
- traiter toutes les activations sur rendez-vous
- garder un dev de garde pendant toute la fenetre de lancement

## Verdict pratique

### GO demain si

- blocs A a D OK
- bloc E au moins exploitable
- une personne claire est designee pour chaque role

### NO GO demain si

- le paiement ne peut pas etre verifie proprement
- la page cible n'est pas fiable
- Messenger ne peut pas etre teste reellement
- l'admin ne peut pas suivre un dossier jusqu'a `active`

## Documents a garder ouverts demain

- [Manuel interne d'exploitation beta assistee](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\INTERNAL_ASSISTED_BETA_OPERATIONS_MANUAL_2026-04-12.md)
- [Acceptance session runbook](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\ACCEPTANCE_SESSION_RUNBOOK_2026-04-09.md)
- [Acceptance tests](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\specs\launch\v1_2026-04-04_assisted_activation\09_ACCEPTANCE_TESTS.md)
- [Beta launch readiness](D:\Travail\RAM'S FLARE\Flare Group\Flare AI\FLARE AI\docs\handover\BETA_LAUNCH_READINESS_2026-04-12.md)
