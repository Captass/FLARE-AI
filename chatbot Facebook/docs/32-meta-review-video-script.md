# Meta Review Video Script

## Format recommande

- duree cible : 1 a 2 minutes
- langue recommandee : anglais simple
- une seule prise propre si possible

## Script de demonstration

### Scene 1 - Contexte

Montrer :

- l'application Meta Developer
- le produit Messenger configure

Voix off recommandee :

```text
This app is used to handle customer messages sent to our Facebook Page through Messenger.
We request pages_messaging so our app can receive incoming messages and send replies back to those customers.
```

### Scene 2 - Envoi d'un message test

Montrer :

- la Page Facebook ou l'interface Messenger
- un compte de test qui envoie `Bonjour`

Voix off recommandee :

```text
Here I open the Page conversation in Messenger and send a customer message.
```

### Scene 3 - Reception de la reponse

Montrer :

- le message client envoye
- la reponse automatique qui revient dans Messenger

Voix off recommandee :

```text
Our backend receives the incoming Messenger webhook, generates a short reply, and sends the answer back in the same conversation.
```

### Scene 4 - Preuve interne

Montrer :

- [dashboard](https://messenger-direct-236458687422.europe-west9.run.app/dashboard)
- la ligne du contact ou de l'event qui vient d'apparaitre

Voix off recommandee :

```text
The conversation is also logged internally for our team follow-up.
```

### Scene 5 - Conclusion

Voix off recommandee :

```text
The pages_messaging permission is only used to answer user-initiated conversations with our Facebook Page.
```

## Ce qu'il faut eviter dans la video

- montrer des secrets ou tokens
- montrer une ancienne URL n8n
- montrer un scenario non stable
- montrer une fonctionnalite post-review non encore active
