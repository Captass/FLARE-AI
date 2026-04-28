# Prompt Antigravity - Finaliser Gmail Assistant FLARE AI

Tu es l'agent developpeur sur le projet FLARE AI.

Objectif : reprendre et finaliser l'automatisation Gmail de `Executive Desk > Assistant Mail`.

## Lecture obligatoire avant de modifier

Lis d'abord :

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/handover/AI_DEV_HANDOVER.md`
4. `docs/handover/FLARE_APP_STATUS_2026-03-28.md`
5. `docs/gmail_assistant_v1.md`
6. `docs/handover/GMAIL_ASSISTANT_ANTIGRAVITY_HANDOFF_2026-04-28.md`

Ensuite lis les fichiers techniques utiles :

- `backend/routers/gmail.py`
- `backend/core/gmail_token_store.py`
- `backend/core/config.py`
- `frontend/src/components/pages/ExecutiveMailPage.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/app/app/page.tsx`

## Contexte actuel

Gmail OAuth fonctionne deja.
Les vrais mails Gmail remontent deja.
Le triage `Prioritaires / A verifier / Non prioritaires` existe deja.
La lecture du contenu complet existe deja.
La generation IA de reponse existe deja avec un modele Gemini leger.
L'envoi Gmail depuis FLARE AI existe deja avec confirmation, mais il doit etre teste seulement avec un mail de test.

Ne repars pas de zero. Stabilise et ameliore ce qui existe.

## Contraintes importantes

- Ne supprime aucune fonctionnalite existante.
- Ne casse pas Business Desk, Enterprise Desk, Chatbot Facebook, Offre / Activation, Support / Parametres.
- Ne touche pas aux secrets reels.
- Ne colle aucune cle API ou OAuth dans le code, les docs ou les logs.
- Ne modifie pas `.env` sauf demande explicite de l'utilisateur.
- Ne fais pas de `git reset`, `git checkout --`, suppression globale ou nettoyage destructif.
- Ne change pas le scope Gmail sans raison produit claire.
- Garde `gmail.readonly` et `gmail.send`.
- Ne pas utiliser `gmail.modify`, `gmail.compose` ou `https://mail.google.com/` maintenant.
- Ne pas connecter Calendar maintenant.
- Ne jamais envoyer un email sans confirmation utilisateur.

## Mission principale

Finaliser `Gmail Assistant V1.5` :

1. Stabiliser la page Assistant Mail.
2. Corriger les cas d'ecran blanc.
3. Garantir que Gmail connecte affiche toujours un etat coherent.
4. Ameliorer le triage des mails.
5. Ameliorer la lecture du contenu complet.
6. Ameliorer la generation IA de reponse.
7. Garder l'envoi Gmail manuel, modifiable et confirme.
8. Ajouter ou ameliorer un historique local simple des actions.
9. Tester.
10. Mettre a jour la documentation.

## Details attendus

### 1. Stabilite frontend

Verifier :

- `http://127.0.0.1:3001/app?view=executive-mail`
- ouverture directe de la page sans passer par l'accueil ;
- absence d'ecran blanc ;
- absence d'erreurs console critiques ;
- aucun blocage si Firebase token met trop longtemps ;
- aucun blocage si Gmail API echoue.

Si une erreur survient, l'utilisateur doit voir un message clair et pouvoir continuer.

### 2. Triage Gmail

L'utilisateur ne doit jamais voir une page vide si Gmail retourne des mails.

Garder les 3 sections :

- `Prioritaires`
- `A verifier`
- `Non prioritaires`

Regles :

- `Non prioritaires` masque par defaut.
- Si `Prioritaires` est vide mais `A verifier` contient des mails, afficher `Aucun mail urgent` puis afficher `A verifier`.
- Si tout est vide, afficher un message propre :
  `Aucun mail utile trouve dans les 20 derniers mails. Cliquez sur Actualiser ou verifiez plus tard.`

Ameliorer les faux positifs :

- newsletters ;
- no-reply ;
- notifications automatiques ;
- alertes securite ;
- codes de verification ;
- reseaux sociaux ;
- plateformes automatiques.

Mais ne pas filtrer trop strictement les vrais mails pro, client, finance, rendez-vous, partenariat.

### 3. Lecture du mail complet

Quand l'utilisateur clique sur un mail, afficher proprement :

- objet complet ;
- expediteur ;
- date ;
- contenu lisible ;
- pieces jointes s'il y en a ;
- score ;
- raisons du classement.

Nettoyer :

- HTML lourd ;
- URLs de tracking ;
- blocs unsubscribe ;
- gros contenus encodes ;
- quoted-printable/base64 parasites.

Le contenu doit etre lisible par un utilisateur normal.

### 4. Reponse IA

L'utilisateur doit pouvoir :

- choisir un mail ;
- expliquer a l'IA ce qu'il veut repondre ;
- generer une reponse ;
- modifier la reponse ;
- copier la reponse ;
- envoyer la reponse via Gmail apres confirmation.

Ameliorer le prompt IA pour eviter les inventions :

- ne pas dire "l'equipe FLARE AI" sauf si c'est explicitement configure ;
- repondre en francais par defaut si le mail ou l'utilisateur est en francais ;
- garder un ton professionnel, clair et court ;
- ne pas promettre d'action impossible ;
- ne pas inventer de piece jointe, date ou information non presente.

Modele souhaite :

- modele Gemini leger ;
- faible cout ;
- fallback rule-based si erreur API.

### 5. Envoi Gmail

L'envoi doit rester manuel :

- bouton `Envoyer via Gmail` ;
- confirmation explicite avant envoi ;
- pas d'envoi automatique ;
- pas de suppression ;
- pas de modification des mails existants.

Tester seulement avec un mail de test envoye a soi-meme ou une adresse jetable.
Si aucun test d'envoi reel n'est fait, le dire clairement dans le rapport final.

### 6. Historique local

Ajouter ou ameliorer un suivi local cote frontend :

- mail ouvert dans FLARE ;
- reponse IA generee ;
- reponse copiee ;
- reponse envoyee ;
- erreur d'envoi.

Stockage MVP accepte :

- `localStorage`
- separe par compte Gmail connecte ;
- idealement par `threadId` si disponible, sinon `message.id`.

Ne pas utiliser `gmail.modify` maintenant.

## Verification obligatoire

Executer :

```powershell
python -m compileall backend\routers\gmail.py backend\core\gmail_token_store.py backend\core\config.py
```

Puis :

```powershell
Set-Location frontend
npm.cmd run build
```

Tester visuellement :

```text
http://127.0.0.1:3001/app?view=executive-mail
```

Verifier :

- Gmail connecte ;
- mails charges ;
- sections coherentes ;
- ouverture d'un mail ;
- contenu complet lisible ;
- generation IA ;
- modification du brouillon ;
- copie ;
- envoi seulement si test volontaire avec destinataire de test.

## Documentation

Mettre a jour :

- `docs/gmail_assistant_v1.md`

Ajouter une section :

```md
## Gmail Assistant V1.5
```

Inclure :

- ce qui a change ;
- comment tester ;
- limites restantes ;
- risques Gmail/OAuth ;
- statut de l'envoi Gmail.

## Resultat attendu

A la fin, livrer :

1. Resume des changements.
2. Fichiers modifies.
3. Verification effectuee.
4. Risques restants.
5. Ce qui reste a faire ensuite.

Ne pas pretendre qu'un envoi Gmail reel a ete teste si ce n'est pas le cas.
