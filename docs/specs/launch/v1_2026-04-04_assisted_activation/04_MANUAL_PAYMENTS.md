# 04 - Paiement manuel local

## Decision produit

Lundi = paiement manuel uniquement.

Pas de :
- Stripe checkout mis en avant
- API mobile money
- validation automatique

---

## Methodes de paiement

### Configuration

Les methodes de paiement sont configurees cote backend via une variable d'environnement :

```
MANUAL_PAYMENT_METHODS_JSON='[
  {
    "code": "mvola",
    "label": "MVola",
    "enabled": true,
    "recipient_name": "FLARE Group",
    "recipient_number": "034 XX XXX XX",
    "instructions": "Envoyez le montant via MVola au numero indique. Gardez votre recu.",
    "currency": "MGA",
    "sort_order": 1
  }
]'
```

Champs par methode :
- `code` : identifiant unique (ex: `mvola`, `orange_money`, `airtel_money`)
- `label` : nom affiche
- `enabled` : visible ou non
- `recipient_name` : nom du destinataire
- `recipient_number` : numero de reception
- `instructions` : texte d'aide
- `currency` : devise
- `sort_order` : ordre d'affichage

### Regle metier imperative

- si seul un compte MVola est reellement disponible, **n'afficher que MVola**
- ne jamais afficher Orange Money ou Airtel Money si aucun compte de reception reel n'est configure
- ne jamais tenter de "rediriger Orange/Airtel vers MVola"
- chaque wallet reste independant
- seules les methodes avec `enabled: true` sont retournees par l'API

---

## Preuve de paiement

### Entite `manual_payment_submission`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| organization_slug | string | Organisation concernee |
| organization_scope_id | string | `org:{slug}` |
| activation_request_id | UUID FK | Demande liee |
| selected_plan_id | string | Plan choisi |
| method_code | string | Code methode (ex: `mvola`) |
| amount | decimal | Montant |
| currency | string | Devise (ex: `MGA`) |
| payer_full_name | string | Nom du payeur |
| payer_phone | string | Telephone du payeur |
| transaction_reference | string | Reference unique |
| proof_file_url | string | URL du fichier preuve |
| proof_file_name | string | Nom du fichier |
| proof_file_size | integer | Taille en octets |
| notes | text | Notes optionnelles |
| status | enum | `draft` / `submitted` / `verified` / `rejected` |
| submitted_at | datetime | Date de soumission |
| verified_at | datetime | Date de verification |
| verified_by | string | Email de l'admin verificateur |
| rejection_reason | text | Raison du refus |

### Statuts

```
draft → submitted → verified
                  → rejected
```

### Upload

Reutiliser Firebase Storage existant.

Chemin : `manual-payments/{organization_slug}/{submission_id}/proof-{uuid}.{ext}`

### Validation

- `transaction_reference` doit etre unique au moins par `method_code`
- une meme preuve ne doit pas permettre deux activations
- apres `verified`, la soumission devient immuable sauf note admin
- toute validation / rejection doit creer un evenement d'audit

---

## Effet sur le plan

1. Client soumet la preuve → statut `submitted`, plan reste `free`
2. Admin valide → statut `verified`
3. La validation declenche le passage du plan de l'organisation au `selected_plan_id`
4. Les features du plan deviennent disponibles
5. La connexion Facebook n'est PAS declenchee automatiquement

---

## Idempotence et anti-fraude

- une reference de transaction ne peut etre validee qu'une seule fois par methode
- si le meme `transaction_reference` + `method_code` est soumis deux fois, la deuxieme est rejetee
- chaque validation/rejet ecrit dans `activation_request_events`
- le fichier preuve reste accessible en lecture seule apres verification
