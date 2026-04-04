# 08 - Wording produit et etats d'ecran

## Wording a supprimer des surfaces client

- "Connectez Facebook en autonomie"
- "Importez vos pages maintenant"
- "Ouvrir Meta et importer mes pages" comme promesse principale client
- tout wording de type "1 clic"
- tout wording suggerant que le client connecte Facebook seul

## Wording de remplacement

- "Activation Facebook assistee par FLARE"
- "Nous activons votre chatbot pour vous apres paiement et validation"
- "Ajoutez le compte FLARE comme admin de votre page, nous faisons le reste"
- "Une fois active, vous pourrez gerer votre chatbot vous-meme"

---

## CTA client

| Contexte | CTA |
|----------|-----|
| Espace a creer | Creer mon espace |
| Offre a choisir | Choisir mon offre |
| Paiement a faire | Payer |
| Preuve a envoyer | Envoyer ma preuve |
| Chatbot a configurer | Configurer mon chatbot |
| Acces page a confirmer | Confirmer l'acces a ma page |
| Activation en cours | Suivre mon activation |
| Chatbot actif | Gerer mon chatbot |
| Paiement refuse | Renvoyer une preuve |

## CTA operateur

| Contexte | CTA |
|----------|-----|
| Paiement a verifier | Valider paiement / Refuser paiement |
| Demande a prendre | Prendre en charge |
| Activation a lancer | Demarrer activation |
| Test a effectuer | Passer en test |
| Activation terminee | Marquer actif |
| Blocage | Bloquer |
| Note | Ajouter une note |

---

## Wording paiement

### Ecran choix de methode
- Titre : "Comment souhaitez-vous payer ?"
- Sous-titre : "Effectuez le paiement via votre methode preferee, puis envoyez-nous la preuve."

### Par methode (exemple MVola)
- Label : "MVola"
- Instruction : "Envoyez {montant} MGA au {numero} ({nom}). Gardez votre recu."
- Champ reference : "Reference de la transaction (ex: MVXXXXXX)"

### Apres soumission
- "Votre preuve de paiement a ete recue. Notre equipe la verifie."
- "Delai habituel : moins de 15 minutes."

### Paiement valide
- "Paiement valide ! Votre plan {plan} est maintenant actif."

### Paiement refuse
- "Paiement refuse : {raison}. Vous pouvez soumettre une nouvelle preuve."

---

## Wording Facebook assiste

### Instruction ajout admin page
- Titre : "Ajoutez FLARE comme administrateur de votre page"
- Etapes :
  1. "Ouvrez votre page Facebook"
  2. "Allez dans Parametres > Acces a la Page"
  3. "Ajoutez {FLARE_FACEBOOK_OPERATOR_NAME} comme administrateur"
  4. "Revenez ici et confirmez"
- Contact : "Besoin d'aide ? Contactez {FLARE_FACEBOOK_OPERATOR_CONTACT}"

### Confirmation
- Case : "J'ai ajoute le compte FLARE comme administrateur de ma page"

### Pendant l'activation
- "Notre equipe active votre chatbot. Vous serez notifie des que c'est pret."

### Chatbot actif
- "Votre chatbot est actif ! Les messages Messenger sont traites automatiquement."

---

## Wording commandes

### Nouvelle commande detectee (client)
- "Nouvelle commande detectee via Messenger"

### Detail commande
- Statuts affiches :
  - `detected` → "Nouvelle"
  - `contacted` → "Contacte"
  - `confirmed` → "Confirmee"
  - `fulfilled` → "Terminee"
  - `canceled` → "Annulee"

---

## Wording conversations

### Mode conversation
- `Bot actif` (remplace "agent")
- `Reprise manuelle` (remplace "human")

### Toggle
- "Passer en reprise manuelle"
- "Reactiver le bot"

---

## Etats vides

| Surface | Message etat vide |
|---------|-------------------|
| Commandes | "Aucune commande pour le moment. Les commandes apparaitront ici quand vos clients passeront commande via Messenger." |
| Conversations | "Aucune conversation. Les conversations apparaitront ici quand des clients vous ecriront sur Messenger." |
| Dashboard (pas actif) | "Activez votre chatbot pour voir les statistiques." |
| Paiements (admin) | "Aucune preuve de paiement en attente." |
| Activations (admin) | "Aucune demande d'activation en cours." |
