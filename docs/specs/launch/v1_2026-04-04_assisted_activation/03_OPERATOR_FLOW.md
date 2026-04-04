# 03 - Workflow operateur FLARE

## Queue operateur

L'equipe FLARE dispose d'un hub `Operations` dans le panneau admin avec trois vues :
- **Activations** : demandes d'activation en cours
- **Paiements** : preuves de paiement a verifier
- **Commandes** : commandes issues des chatbots

---

## Vue Activations

### Liste

Colonnes :
- entreprise
- organisation (slug)
- contact (nom + email)
- plan selectionne
- statut demande
- statut paiement
- acces page confirme (oui/non)
- age de la demande
- operateur assigne
- derniere mise a jour

Filtres :
- tous
- nouveaux (`draft`, `awaiting_payment`)
- paiement a verifier (`payment_submitted`)
- attente acces page (`awaiting_flare_page_admin_access`)
- pret a activer (`queued_for_activation`)
- en cours (`activation_in_progress`)
- test (`testing`)
- actifs (`active`)
- bloques (`blocked`)

### Detail

Affiche :
- toutes les infos du formulaire client
- preuve de paiement (lien direct vers le fichier)
- notes internes
- historique audit (timeline des evenements)
- checklist operateur

Actions disponibles :
- `Assigner a moi`
- `Valider paiement`
- `Refuser paiement` (avec raison obligatoire)
- `Confirmer acces page`
- `Passer en file d'activation`
- `Demarrer activation`
- `Passer en test`
- `Marquer actif`
- `Bloquer` (avec raison obligatoire)
- `Ajouter une note`

### Checklist de livraison

1. [ ] Paiement verifie
2. [ ] Acces admin page confirme
3. [ ] Page Facebook importee
4. [ ] Page activee
5. [ ] Bot ON
6. [ ] Message test envoye
7. [ ] Reponse Messenger recue
8. [ ] Client notifie

---

## Vue Paiements

But : verifier rapidement les preuves de paiement.

Colonnes :
- methode (MVola, etc.)
- reference transaction
- payeur (nom + telephone)
- montant
- organisation
- plan
- preuve (lien)
- statut
- date de soumission

Actions :
- `Valider`
- `Refuser` (raison obligatoire)
- `Ouvrir la demande` (lien vers le detail activation)

---

## Vue Commandes

But : surveiller les commandes remontees par les chatbots clients.

Filtres :
- nouvelles (`detected`)
- a traiter (`contacted`)
- confirmees (`confirmed`)
- terminees (`fulfilled`)
- annulees (`canceled`)

---

## Statuts internes et transitions

### Demande d'activation

```
draft
  → awaiting_payment
    → payment_submitted
      → payment_verified
        → awaiting_flare_page_admin_access
          → queued_for_activation
            → activation_in_progress
              → testing
                → active

Depuis n'importe quel etat non terminal :
  → blocked (avec raison)
  → rejected
  → canceled

payment_submitted → payment_verified (validation OK)
payment_submitted → rejected (paiement refuse)
```

### Regles de transition

- `payment_verified` requiert une soumission de paiement existante avec statut `verified`
- `queued_for_activation` requiert paiement valide ET acces page confirme
- `active` requiert un test Messenger valide
- `blocked` peut arriver depuis n'importe quel etat non terminal

---

## SLA cible

- objectif : 15 minutes entre `queued_for_activation` et `active`
- l'age de la demande est visible dans la liste pour detecter les retards

---

## Gestion des blocages

Si un blocage survient :
1. l'operateur passe la demande en `blocked` avec une raison
2. le client voit "Activation bloquee" + la raison
3. l'operateur peut debloquer et reprendre le flux normal
4. toute action de blocage/deblocage est journalisee

---

## Notifications

### Vers l'equipe FLARE
- a chaque `payment_submitted` : entree dans la queue + email aux `ADMIN_EMAILS`

### Vers le client
- `preuve recue` (in-app obligatoire, email recommande)
- `paiement valide` (in-app + email)
- `paiement refuse` (in-app + email avec raison)
- `activation en cours` (in-app)
- `chatbot actif` (in-app + email)
- `activation bloquee` (in-app + email avec raison)
