# FLARE AI - Launch Gates Status - 2026-04-09

## Objet

Etat reel des gates avant de parler de lancement public payant.

Ce document ne remplace pas `09_ACCEPTANCE_TESTS.md`.
Il sert a separer clairement :

- ce qui est corrige techniquement
- ce qui est deployee
- ce qui reste seulement "a tester"
- ce qui bloque encore un go-live public

## Resume executif

Le produit n'est pas encore "vendable publiquement sans reserve".

En revanche, plusieurs prealables techniques importants sont maintenant en place :

- Assistant IA stabilise
- navigation Assistant unifiee
- flux SSE frontend durci
- dette TypeScript frontend nettoyee
- frontend Render deploye sur le commit `d85cd9b`
- backend assisted activation/cataloque deploye sur le commit `27ffb47`

Les blocages restants ne sont plus principalement du code frontend de base.
Les blocages restants sont surtout :

- acceptance reelle non executee bout en bout
- ops/admin non prouvees en run operateur complet
- test live Messenger / activation / paiement manuel non clotures
- build local Windows encore instable selon le chemin workspace (`RAM'S FLARE`) et le manifest RSC Next export

## Gate 1 - Produit coherent

### Etat

Partiellement valide.

### Ce qui est OK

- branding produit et navigation globale mieux cadres
- `logo -> Accueil`
- `Retour` plus coherent
- Assistant IA :
  - un seul menu gauche
  - sous-navigation Assistant dans la sidebar globale
  - zone de saisie recentree
  - flux de reponse frontend plus robuste
- `npx tsc --noEmit` frontend : OK
- deploy frontend Render du fix type-safety : `live`

### Ce qui reste a valider reellement

- QA visuelle desktop/mobile sur tous les ecrans critiques
- verification live des derniers modals, overlays et contrastes
- verification live du comportement Assistant avec vrai compte et vrai token

## Gate 2 - Metier coherent

### Etat

Partiellement valide.

### Ce qui est corrige techniquement

- activation request avec verite de demande plus stable
- page cible et contexte d'activation mieux captures
- catalogue produit enrichi
- signalement branche vers admin

### Ce qui reste a prouver

- flow complet :
  - offre
  - paiement manuel
  - preuve
  - validation admin
  - activation
  - bot actif
- verification live que client et admin lisent exactement la meme demande
- verification live que la page Facebook cible reste correcte dans toutes les reprises

## Gate 3 - Ops pretes

### Etat

Non prouve.

### Ce qui manque

- un dry-run operateur complet chronometre
- verification des transitions de statut en conditions reelles
- verification de la gestion des blocages / reprises
- verification des notifications admin a chaque evenement critique
- verification du traitement signalement -> inbox admin -> resolution

## Gate 4 - Acceptance reelle

### Etat

Non cloturee.

La specification [09_ACCEPTANCE_TESTS.md](../specs/launch/v1_2026-04-04_assisted_activation/09_ACCEPTANCE_TESTS.md)
contient encore majoritairement des statuts `a tester`.

### Minimum a executer avant go-live public

1. Connexion et selection d'espace
2. Hub chatbot sans wizard parasite
3. OAuth Facebook reelle
4. Import page
5. Toggle ON / OFF global
6. Test Messenger reel
7. Personnalisation chatbot sauvegardee puis relue
8. Paiement manuel + preuve
9. Validation admin
10. Activation page par operateur
11. Bot actif et visible cote client
12. Signalement utilisateur visible et traitable cote admin

## Gate 5 - Pre-lancement public

### Etat

Non demarre.

### Condition recommandee

Au moins 3 a 5 parcours clients pilotes reussis sans assistance de developpement.

## Build / Deploy

### Frontend

- `npx tsc --noEmit` : OK au 2026-04-09
- Render frontend :
  - commit `d85cd9b`
  - statut : `live`

### Backend

- Render backend :
  - commit `27ffb47`
  - statut : `live`

### Limite connue locale

Le build local Windows reste susceptible d'echouer a cause :

- du chemin workspace avec apostrophe
- d'un probleme de manifest RSC / export Next sur `src/app/page.tsx`

Ce point ne bloque pas le deploy Render actuel, mais il empeche encore de declarer l'environnement local Windows "fiabilise sans reserve".

## Decision franche a date

### Pas encore acceptable pour :

- lancement public large
- vente sans accompagnement operateur
- communication commerciale "produit pret"

### Potentiellement acceptable apres acceptance reelle pour :

- beta payante assistee
- lancement Madagascar d'abord
- operation manuelle forte par FLARE

## Prochaine sequence recommandee

1. Executer la checklist d'acceptance reelle et marquer chaque cas `OK / KO / bloque`
2. Faire un dry-run operateur complet `paiement -> admin -> activation -> bot actif`
3. Revalider les roles et l'isolation multi-tenant sur les ecrans admin/chatbot
4. Decider explicitement :
   - `beta vendable assistee`
   - ou `pas encore`
