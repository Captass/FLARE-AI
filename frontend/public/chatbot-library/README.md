# Catalog Media

Ce dossier contient les medias publics que le bot Messenger peut envoyer automatiquement.

## Regle importante

- Place toujours les fichiers ici, dans `direct_service/catalog_media/`
- Ne mets pas les catalogues dans `../assets/`
- Le backend choisit les medias via `catalog_manifest.json`
- Le modele ne choisit pas librement les fichiers

## Structure a remplir

- `catalog_media/service_choice/catalog_images/`
- `catalog_media/spot_publicitaire/catalog_images/`
- `catalog_media/spot_publicitaire/portfolio_videos/`
- `catalog_media/spot_publicitaire/portfolio_images/`
- `catalog_media/video_documentaire/catalog_images/`
- `catalog_media/video_documentaire/portfolio_videos/`
- `catalog_media/video_documentaire/portfolio_images/`
- `catalog_media/captation_evenementielle/catalog_images/`
- `catalog_media/captation_evenementielle/portfolio_videos/`
- `catalog_media/captation_evenementielle/portfolio_images/`
- `catalog_media/regie_multicamera/catalog_images/`
- `catalog_media/regie_multicamera/portfolio_videos/`
- `catalog_media/regie_multicamera/portfolio_images/`
- `catalog_media/livestreaming/catalog_images/`
- `catalog_media/livestreaming/portfolio_videos/`
- `catalog_media/livestreaming/portfolio_images/`
- `catalog_media/shooting_photo/catalog_images/`
- `catalog_media/shooting_photo/portfolio_videos/`
- `catalog_media/shooting_photo/portfolio_images/`
- `catalog_media/location_studio/catalog_images/`
- `catalog_media/location_studio/portfolio_videos/`
- `catalog_media/location_studio/portfolio_images/`

## Galerie d'offres a envoyer en premier

Dans `service_choice/catalog_images/`, depose ces fichiers:

- `offer-1-flash-video-express.jpg`
- `offer-2-pack-boost-business.jpg`
- `offer-3-story-pro-impact.jpg`
- `offer-4-sur-mesure-pro.jpg`
- `offer-5-gold-sur-mesure-pro.jpg`

Optionnel:

- `catalogue-services.jpg`

Le bot enverra d'abord les 5 offres, puis il demandera au prospect quelle offre il veut choisir ou confirmer.

## Ce que chaque dossier signifie

- `service_choice/catalog_images/`
  - catalogue global pour aider le prospect a choisir un service
- `catalog_images/`
  - image catalogue a envoyer pour prix, tarif ou devis
- `portfolio_videos/`
  - video exemple a envoyer pour prouver la qualite ou montrer une realisation
- `portfolio_images/`
  - image exemple si tu veux montrer un rendu photo ou si tu n'as pas de video

## Comment le bot choisit

- si le prospect demande un prix ou un devis -> il envoie un fichier de `catalog_images`
- si le prospect demande des realisations -> il envoie en priorite un fichier de `portfolio_videos`
- s'il n'y a pas de video, il prend `portfolio_images`
- si le prospect demande le catalogue global ou ne sait pas quoi choisir, il peut envoyer `service_choice/catalog_images/catalogue-services.jpg`

## Option Google Drive

Oui, tu peux utiliser un lien Google Drive public au lieu de deposer le fichier localement.

Regles:

- le fichier Drive doit etre partage en `Anyone with the link`
- il faut mettre le lien dans `catalog_manifest.json`
- pour un media Drive, tu peux utiliser `drive_url`, `google_drive_url` ou `drive_file_id`
- si tu as deja une URL directe, tu peux aussi utiliser `external_url`

Exemple pour une video portfolio:

```json
{
  "id": "doc_portfolio_01",
  "label": "Portfolio video documentaire",
  "description": "Video exemple documentaire",
  "attachment_type": "video",
  "drive_url": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "trigger_keywords": ["portfolio", "documentaire", "realisations"]
}
```

Exemple pour une image catalogue:

```json
{
  "id": "spot_catalog_main",
  "label": "Catalogue prix spot publicitaire",
  "description": "Catalogue spot pub",
  "attachment_type": "image",
  "drive_url": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "trigger_keywords": ["prix", "devis", "spot publicitaire"]
}
```

Le backend convertit automatiquement le lien Drive en URL exploitable pour Messenger.

## Comment eviter les erreurs

- un service = un dossier dedie
- chaque media doit etre decrit dans `catalog_manifest.json`
- les chemins dans le manifeste doivent correspondre exactement aux noms des fichiers
- les descriptions servent au bot pour comprendre a quoi sert chaque media

## Exemple simple

Pour une demande `prix video documentaire`:

- image a deposer:
  - `catalog_media/video_documentaire/catalog_images/catalogue-prix.jpg`
- entree correspondante dans le manifeste:
  - service `video_documentaire`
  - bloc `catalog_images`

Pour une demande `montrez-moi vos realisations documentaires`:

- video a deposer:
  - `catalog_media/video_documentaire/portfolio_videos/portfolio-01.mp4`
- entree correspondante dans le manifeste:
  - service `video_documentaire`
  - bloc `portfolio_videos`

## Format conseille

- images: `.jpg`, `.jpeg`, `.png`
- videos: `.mp4`
- noms simples, sans espaces si possible
- garde un seul catalogue principal par service pour commencer
- garde 1 ou 2 portfolios max par service au debut
