# 02 - Tunnel client complet

## Vue d'ensemble

```
Inscription → Espace → Offre → Paiement → Preuve → Formulaire chatbot → Ajout FLARE admin page → Attente → Actif
```

---

## Etapes detaillees

### 1. Inscription / connexion
- le client cree son compte FLARE (email + mot de passe ou Google)
- il arrive sur la page d'accueil

### 2. Creation d'espace
- le client cree un workspace organisationnel
- l'espace demarre en plan `free`
- il ouvre le module Chatbot Facebook

### 3. Choix de l'offre
- le client voit les plans disponibles avec leurs features
- il selectionne un plan payant (starter, pro, business)
- le plan est enregistre comme `selected_plan_id` dans la demande, mais **pas encore applique**

### 4. Paiement manuel
- le client voit les methodes de paiement disponibles (ex: MVola)
- chaque methode affiche : nom du destinataire, numero, instructions
- le client effectue le paiement hors FLARE (via son app mobile money)
- il revient dans FLARE pour soumettre sa preuve

### 5. Soumission de preuve
- le client remplit :
  - nom complet du payeur
  - telephone du payeur
  - reference de transaction
  - upload du recu/screenshot
  - notes optionnelles
- statut passe a `payment_submitted`

### 6. Formulaire de configuration chatbot
Le client remplit les sections suivantes :

**Contact** : nom complet, email, telephone, WhatsApp

**Entreprise** : nom, secteur, ville, pays, description

**Facebook** : nom de la page, URL de la page, email/admin Facebook de reference

**Chatbot** : nom du bot, langue, ton, message d'accueil

**Vente** : produit/service principal, resume de l'offre, horaires, zones de livraison, moyen de contact

### 7. Ajout du compte FLARE comme admin page
- instruction claire avec :
  - nom du compte Facebook operateur FLARE
  - etapes pour ajouter un admin sur une page Facebook
- le client coche : "Le compte FLARE a bien ete ajoute comme admin/proprietaire"
- timestamp stocke

### 8. Attente d'activation
- le client voit un statut en temps reel :
  - `Preuve recue`
  - `Paiement valide`
  - `Activation en cours`
  - `Test en cours`
- il ne peut rien faire de plus a ce stade

### 9. Chatbot actif
- le client voit son chatbot actif
- il peut maintenant :
  - modifier les preferences (nom, ton, langue, message d'accueil)
  - modifier l'entreprise
  - modifier le catalogue / portfolio / ventes
  - activer / desactiver globalement le chatbot (ON/OFF)
  - passer une conversation en bot actif ou reprise manuelle
  - voir le dashboard et les commandes

---

## Etats d'ecran du Chatbot Home

| Etat | Affichage | CTA |
|------|-----------|-----|
| Pas d'espace | "Creez votre espace" | Creer mon espace |
| Espace free, pas de demande | "Choisissez votre offre" | Voir les offres |
| Offre choisie, pas de paiement | "Envoyez votre paiement" | Payer |
| Paiement soumis | "Preuve recue, verification en cours" | - |
| Paiement valide, acces page non confirme | "Ajoutez FLARE comme admin page" | Confirmer l'acces |
| File d'activation | "Activation en cours" | Suivre mon activation |
| Chatbot actif | Dashboard complet | Gerer |
| Activation bloquee | "Activation bloquee" + raison | Contacter FLARE |
| Paiement refuse | "Paiement refuse" + raison | Renvoyer une preuve |

---

## Erreurs et messages

| Situation | Message |
|-----------|---------|
| Popup Meta bloquee | N/A - pas de popup Meta cote client en v1 |
| Upload trop gros | "Le fichier depasse la taille maximale autorisee (10 Mo)" |
| Reference deja utilisee | "Cette reference de transaction a deja ete soumise" |
| Formulaire incomplet | "Veuillez remplir tous les champs obligatoires" |
| Session expiree | "Session expiree. Reconnectez-vous a FLARE." |
| Acces non autorise | "Seuls le proprietaire ou un admin de cet espace peuvent effectuer cette action" |
