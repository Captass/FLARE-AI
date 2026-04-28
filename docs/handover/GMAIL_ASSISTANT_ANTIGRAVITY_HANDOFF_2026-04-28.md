# FLARE AI Gmail Assistant - Handoff Antigravity - 2026-04-28

## Objectif de reprise

Finaliser l'automatisation Gmail dans `Executive Desk > Assistant Mail` pour en faire une V1 utilisable en demo reelle :

- connexion Gmail OAuth deja fonctionnelle ;
- lecture des 20 derniers mails deja fonctionnelle ;
- triage `Prioritaires / A verifier / Non prioritaires` deja en place ;
- lecture du contenu complet deja en place ;
- generation IA de reponse deja en place ;
- envoi Gmail depuis FLARE AI implemente, mais a tester uniquement avec un mail de test.

Le prochain agent doit stabiliser, tester et polir cette fonctionnalite sans casser le reste de FLARE AI.

## Etat actuel valide

Derniere verification locale :

- Frontend : `http://127.0.0.1:3001/app?view=executive-mail`
- Backend : `http://127.0.0.1:8000`
- Health backend : `http://127.0.0.1:8000/health`

Ce qui a ete observe :

- Gmail se connecte correctement avec `cptskevin@gmail.com`.
- La page Assistant Mail s'ouvre directement avec `?view=executive-mail`.
- Les mails reels Gmail remontent.
- La liste est triee en 3 groupes.
- Le contenu complet d'un mail s'ouvre dans une modale.
- Les textes bruts Gmail sont nettoyes pour retirer les gros blocs de tracking, URLs et contenus encodes.
- La generation IA avec un modele Gemini leger fonctionne.
- Le brouillon de reponse est modifiable avant envoi.
- L'envoi Gmail existe cote backend et frontend, avec confirmation manuelle, mais il ne doit pas etre teste sur un vrai destinataire sans accord explicite.

## Fichiers principaux

Backend :

- `backend/routers/gmail.py`
- `backend/core/gmail_token_store.py`
- `backend/core/config.py`
- `backend/main.py`

Frontend :

- `frontend/src/components/pages/ExecutiveMailPage.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/app/app/page.tsx`
- `frontend/next.config.js`

Documentation :

- `docs/gmail_assistant_v1.md`
- `docs/handover/GMAIL_ASSISTANT_ANTIGRAVITY_HANDOFF_2026-04-28.md`
- `docs/handover/GMAIL_ASSISTANT_ANTIGRAVITY_PROMPT_2026-04-28.md`

## Variables d'environnement necessaires

Ne jamais coller les vraies cles dans un document, une capture, un commit ou un prompt public.

Backend local :

```env
GOOGLE_CLIENT_ID=<configure localement>
GOOGLE_CLIENT_SECRET=<configure localement>
GOOGLE_REDIRECT_URI=http://localhost:8000/api/gmail/callback
GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send
GOOGLE_OAUTH_MASTER_KEY=<cle Fernet en production>
GEMINI_API_KEY_ASSISTANT_FAST=<configure localement>
GEMINI_ROUTING_MODEL=gemini-2.5-flash-lite
```

Google Cloud OAuth doit contenir le redirect URI local :

```text
http://localhost:8000/api/gmail/callback
```

Pour production Render, ajouter aussi le callback backend production dans Google Cloud, par exemple :

```text
https://<backend-render>/api/gmail/callback
```

## Comportement produit actuel

Assistant Mail doit rester simple :

1. L'utilisateur connecte Gmail.
2. FLARE AI lit les 20 derniers mails.
3. FLARE AI classe les mails :
   - `Prioritaires`
   - `A verifier`
   - `Non prioritaires`
4. L'utilisateur ouvre un mail.
5. FLARE AI affiche :
   - objet complet ;
   - expediteur ;
   - date ;
   - resume ;
   - contenu complet nettoye ;
   - pieces jointes si presentes ;
   - score et raisons de classement.
6. L'utilisateur peut demander une reponse IA avec une instruction libre.
7. L'utilisateur modifie la reponse.
8. L'utilisateur peut copier la reponse ou l'envoyer via Gmail apres confirmation.

## Points a corriger / ameliorer en priorite

1. Stabilite de la page

- Verifier que `http://127.0.0.1:3001/app?view=executive-mail` ne reste jamais en ecran blanc.
- Verifier les erreurs console navigateur.
- Verifier les erreurs backend au chargement Gmail.
- Garder un message utilisateur clair si Gmail est connecte mais que les messages ne chargent pas.

2. Triage Gmail

- Continuer a reduire les faux positifs : newsletters, no-reply, notifications, alertes automatiques.
- Eviter le cas `0 / 0 / 0` si Gmail retourne bien des messages.
- Afficher un etat clair si Gmail retourne vraiment zero message.
- Ne pas masquer toutes les informations utiles derriere un filtre trop strict.

3. Lecture du mail complet

- Garder le contenu lisible, pas les blocs encodes ni les trackers.
- Verifier les mails HTML lourds.
- Verifier les mails avec accents, emojis et sujets MIME encodes.
- Verifier les pieces jointes : affichage du nom, taille, type, bouton telechargement.

4. Reponse IA

- Eviter les reponses qui inventent une identite comme "l'equipe FLARE AI" si l'utilisateur n'a pas demande ce ton.
- Ajouter plus tard un profil utilisateur :
  - nom ;
  - signature ;
  - ton ;
  - langue preferee ;
  - contexte professionnel.
- Garder un modele leger et peu couteux.
- Garder un fallback rule-based si Gemini echoue.

5. Envoi Gmail

- Ne jamais envoyer automatiquement.
- Garder une confirmation explicite avant envoi.
- Tester seulement avec un mail de test envoye a soi-meme ou a une adresse jetable.
- Si le token a ete cree avant l'ajout du scope `gmail.send`, demander une deconnexion/reconnexion Gmail.

6. Historique local

L'etat actuel `Vu dans FLARE / Repondu` est local cote frontend. Prochaine amelioration recommandee :

- stocker par `threadId` si disponible, sinon `message.id` ;
- separer par compte Gmail connecte ;
- ajouter une petite timeline locale :
  - ouvert dans FLARE ;
  - reponse IA generee ;
  - copie ;
  - envoi ;
  - erreur d'envoi.

Ne pas ajouter `gmail.modify` maintenant sauf decision produit explicite, car cela augmente le niveau de permission Google.

## Risques connus

- Les scopes Gmail `gmail.readonly` et `gmail.send` sont sensibles/restricted. Une app publique peut demander verification Google.
- Les secrets OAuth et Gemini ne doivent jamais etre commits.
- Les tokens Gmail doivent etre chiffres en production avec `GOOGLE_OAUTH_MASTER_KEY`.
- L'envoi Gmail est une action reelle : toute verification doit utiliser un compte et un destinataire de test.
- Le repo contient deja beaucoup de modifications et fichiers non suivis. Ne pas faire de reset, checkout ou suppression globale.

## Commandes utiles Windows

Verifier backend :

```powershell
python -m compileall backend\routers\gmail.py backend\core\gmail_token_store.py backend\core\config.py
```

Verifier frontend :

```powershell
Set-Location frontend
npm.cmd run build
```

Demarrer backend local depuis la racine repo :

```powershell
Start-Process -WindowStyle Hidden -FilePath python -ArgumentList "-m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
```

Demarrer frontend local :

```powershell
Start-Process -WindowStyle Hidden -FilePath npm.cmd -ArgumentList "run dev -- --port 3001" -WorkingDirectory ".\frontend"
```

URLs de test :

```text
http://127.0.0.1:3001/app?view=executive-mail
http://127.0.0.1:8000/health
```

## Critere de fin pour la prochaine session

La prochaine session est terminee quand :

- la page Assistant Mail ne fait plus d'ecran blanc ;
- Gmail connecte affiche toujours un etat coherent ;
- au moins un mail reel peut etre ouvert avec contenu lisible ;
- une reponse IA peut etre generee et modifiee ;
- l'envoi Gmail est teste uniquement sur un mail de test, ou documente comme non teste volontairement ;
- `python -m compileall ...` passe ;
- `npm.cmd run build` passe ;
- `docs/gmail_assistant_v1.md` est mis a jour si le comportement change.
