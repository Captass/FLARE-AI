# FLARE AI — Agent Création de Contenu : Architecture Complète

> Document de spécification technique pour l'implémentation de l'Agent Création de Contenu.
> Date : 22 mars 2026 — Auteur : Claude (Architecte) + Kévin (Direction produit)
> **Ce document fait autorité** pour toute implémentation liée au Content Creator.

---

## VISION PRODUIT

L'Agent Création de Contenu est un **studio créatif IA autonome** accessible depuis la page Agents (`AgentsPanel.tsx`). Ce n'est PAS un sous-agent du chat — c'est un **module indépendant** avec sa propre interface, son propre flux, et ses propres sous-agents.

L'utilisateur clique sur "Agent Création de Contenu" dans le panel Agents → il entre dans un **workspace créatif** dédié, séparé du chat principal.

---

## ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js)                      │
│                                                          │
│  AgentsPanel.tsx → ContentStudioPage.tsx (nouveau)       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Barre latérale    │   Zone de travail           │    │
│  │  ─────────────     │   ────────────────          │    │
│  │  📁 Projets        │   Canvas / Preview          │    │
│  │  🎨 Design         │   Timeline (vidéo)          │    │
│  │  📝 Textes         │   Éditeur de texte          │    │
│  │  🎬 Vidéo          │   Paramètres export         │    │
│  │  📤 Exports        │                             │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │ API REST + SSE
┌──────────────────────▼──────────────────────────────────┐
│                  BACKEND (FastAPI)                        │
│                                                          │
│  routers/content_studio.py (nouveau router)              │
│       │                                                  │
│       ▼                                                  │
│  ContentCreatorSupervisor (orchestrateur LangGraph)      │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │Copywriter│ Graphic  │  Video   │  Video   │          │
│  │  Agent   │ Designer │Generator │  Editor  │          │
│  └──────────┴──────────┴──────────┴──────────┘          │
│       │           │          │          │                │
│       ▼           ▼          ▼          ▼                │
│    Gemini      Pillow     Veo 2.0    FFmpeg              │
│    Pro       + Imagen    (Vertex)   + MoviePy            │
│             + Playwright                                 │
└─────────────────────────────────────────────────────────┘
```

---

## PHASES D'IMPLÉMENTATION

| Phase | Contenu | Responsable | Dépendances |
|-------|---------|-------------|-------------|
| **Phase 1** | Copywriter Agent | Équipe dev IA | Aucune |
| **Phase 2** | Graphic Designer Agent | Équipe dev IA | Phase 1 (textes) |
| **Phase 3** | Video Generator Agent | Équipe dev IA | Veo 2.0 (déjà câblé) |
| **Phase 4** | Video Editor Agent | **Gemini 3.1 Pro** | Phase 3 + FFmpeg |

---

## PHASE 1 — Copywriter Agent (Équipe dev)

### Objectif
Agent rédactionnel qui génère tout le contenu textuel : captions, scripts vidéo, headlines, articles, emails.

### Fichiers à créer

```
backend/agents/content_studio/
├── __init__.py
├── supervisor.py              ← ContentCreatorSupervisor
├── copywriter_agent.py        ← Phase 1
├── graphic_designer_agent.py  ← Phase 2
├── video_generator_agent.py   ← Phase 3
└── video_editor_agent.py      ← Phase 4

backend/routers/
└── content_studio.py          ← Nouveau router API
```

### `copywriter_agent.py` — Spécifications

```python
class CopywriterAgent:
    """
    Agent rédactionnel spécialisé en création de contenu marketing.
    Utilise Gemini Pro pour une qualité rédactionnelle maximale.
    """

    # Modèle : GEMINI_PRO_MODEL (gemini-3.1-pro-preview)
    # Temperature : 0.7 (créatif mais cohérent)

    # CAPACITÉS :
    # 1. Posts réseaux sociaux (LinkedIn, Facebook, Instagram, X)
    #    - Plusieurs variations de ton : professionnel, viral, storytelling, décontracté
    #    - Hashtags pertinents générés automatiquement
    #    - Respect des limites de caractères par plateforme
    #
    # 2. Articles de blog
    #    - Structure SEO : H1, H2, intro, corps, conclusion, CTA
    #    - Méta-description et title tag générés
    #    - Mots-clés intégrés naturellement
    #
    # 3. Scripts vidéo
    #    - Découpage en scènes avec timing
    #    - Indications visuelles pour chaque scène
    #    - Voix-off / textes à l'écran séparés
    #    - Format : [SCÈNE 1 | 0:00-0:05] Description visuelle + Texte voix-off
    #
    # 4. Emails marketing
    #    - Objet + pré-header + corps + CTA
    #    - Version texte brut incluse
    #    - A/B testing : 2 variations d'objet
    #
    # 5. Copywriting publicitaire
    #    - Headlines (3 variations)
    #    - Sous-titres
    #    - Argumentaires de vente structurés (AIDA, PAS, BAB)

    # OUTPUT FORMAT :
    # Le contenu est retourné en Markdown structuré avec des sections claires.
    # Chaque output inclut un bloc métadonnées :
    # { "platform": "instagram", "tone": "viral", "word_count": 150, "hashtags": [...] }
```

### `content_studio.py` (router) — Endpoints

```
POST /api/content-studio/generate
  Body: { "type": "post|article|script|email|copy",
          "platform": "linkedin|facebook|instagram|x|blog|email",
          "tone": "pro|viral|storytelling|casual",
          "brief": "Description libre de l'utilisateur",
          "brand_context": "Infos sur la marque (optionnel)",
          "language": "fr|en|mg" }
  Response: SSE stream du contenu généré

POST /api/content-studio/projects
  Body: { "name": "Campagne lancement FLARE AI", "description": "..." }
  → Crée un projet qui regroupe tous les contenus

GET  /api/content-studio/projects/{project_id}
  → Liste tous les contenus d'un projet

POST /api/content-studio/export
  Body: { "content_id": "...", "format": "docx|pdf|txt" }
  → Export via document_worker existant
```

### Frontend — `ContentStudioPage.tsx` (nouveau composant)

L'interface se compose de :

```
┌──────────────────────────────────────────────────────┐
│  ← Retour aux Agents    STUDIO DE CRÉATION    [?]   │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│  PROJETS     │   ZONE DE TRAVAIL                     │
│  ──────────  │                                       │
│  + Nouveau   │   ┌─ Onglets ──────────────────────┐ │
│              │   │ 📝 Textes │ 🎨 Visuels │ 🎬 Vidéo│ │
│  > Campagne  │   └────────────────────────────────┘ │
│    FLARE AI  │                                       │
│  > Posts     │   [Zone de brief]                     │
│    Semaine   │   Décrivez ce que vous voulez...      │
│              │                                       │
│  PARAMÈTRES  │   [Résultat généré]                   │
│  ──────────  │   Preview en temps réel               │
│  Plateforme  │                                       │
│  Ton         │   [Actions]                           │
│  Langue      │   Régénérer | Exporter | Envoyer au   │
│  Marque      │   GraphicDesigner | Copier            │
│              │                                       │
└──────────────┴───────────────────────────────────────┘
```

**Routing frontend** : Quand l'utilisateur clique sur "Agent Création de Contenu" dans `AgentsPanel.tsx`, au lieu d'ouvrir un chat, ça ouvre `ContentStudioPage` en plein écran (même pattern que les autres panels : Mémoire, Fichiers, etc.).

---

## PHASE 2 — Graphic Designer Agent (Équipe dev)

### Objectif
Agent qui crée des visuels professionnels : affiches, posts illustrés, bannières, stories.

### `graphic_designer_agent.py` — Spécifications

```python
class GraphicDesignerAgent:
    """
    Agent de design graphique. Compose des visuels en couches :
    Fond créatif (Imagen) + Typographie (Pillow) + Layout (structuré).
    """

    # PIPELINE DE CRÉATION (3 étapes obligatoires) :
    #
    # Étape 1 — BRIEF STRUCTURÉ
    #   L'agent reçoit le brief et le décompose en :
    #   {
    #     "format": "1080x1080",        # ou "1080x1920", "1920x1080", "A4"
    #     "background": {
    #       "type": "generated",         # ou "uploaded", "solid_color", "gradient"
    #       "prompt": "Bureau moderne, lumière dorée, flou artistique",
    #       "color": "#1B2A4A"           # si solid/gradient
    #     },
    #     "elements": [
    #       {
    #         "type": "text",
    #         "content": "FLARE AI",
    #         "font": "Montserrat-Bold",
    #         "size": 72,
    #         "color": "#FFFFFF",
    #         "position": {"x": "center", "y": 200},
    #         "effects": ["shadow", "glow"]
    #       },
    #       {
    #         "type": "text",
    #         "content": "L'IA qui comprend Madagascar",
    #         "font": "Inter-Light",
    #         "size": 24,
    #         "color": "#F5A623",
    #         "position": {"x": "center", "y": 300}
    #       },
    #       {
    #         "type": "image",
    #         "source": "uploaded",       # ou "generated"
    #         "url": "...",
    #         "position": {"x": 50, "y": 50},
    #         "size": {"w": 200, "h": 200},
    #         "effects": ["rounded", "shadow"]
    #       },
    #       {
    #         "type": "shape",
    #         "shape": "rectangle",
    #         "color": "#000000",
    #         "opacity": 0.5,
    #         "position": {"x": 0, "y": 800},
    #         "size": {"w": 1080, "h": 280}
    #       }
    #     ]
    #   }
    #
    # Étape 2 — GÉNÉRATION DES ASSETS
    #   - Fond : Imagen 3 si "generated", sinon couleur/gradient via Pillow
    #   - Images : Imagen 3 si "generated", sinon upload utilisateur
    #   - Polices : téléchargement Google Fonts à la demande
    #
    # Étape 3 — COMPOSITION FINALE
    #   Pillow assemble toutes les couches :
    #   fond → shapes → images → textes → effets → export PNG

    # OUTILS :
    TOOLS = [
        "generate_background",      # Imagen 3 → fond créatif
        "compose_visual",           # Pillow → assemblage final
        "download_font",            # Google Fonts API → TTF
        "apply_filter",             # Pillow → filtres (blur, brightness, contrast)
        "remove_background",        # rembg → détourage
        "resize_and_crop",          # Pillow → redimensionnement intelligent
    ]
```

### Dépendances Python à ajouter

```
# requirements.txt
Pillow>=10.0.0          # Composition d'images, typographie
rembg>=2.0.0            # Suppression d'arrière-plan
playwright>=1.40.0      # Rendu HTML→image (layouts complexes)
requests                # Téléchargement Google Fonts
```

### Formats supportés

| Format | Dimensions | Usage |
|--------|-----------|-------|
| Post Instagram carré | 1080×1080 | Feed IG |
| Story Instagram/Reels | 1080×1920 | Stories, Reels |
| Post Facebook | 1200×630 | Feed FB |
| Cover Facebook | 820×312 | Bannière FB |
| Post LinkedIn | 1200×627 | Feed LinkedIn |
| Banner LinkedIn | 1584×396 | Bannière profil |
| Post X (Twitter) | 1200×675 | Feed X |
| Affiche A4 | 2480×3508 (300dpi) | Print |
| Affiche A3 | 3508×4960 (300dpi) | Print |
| YouTube Thumbnail | 1280×720 | Miniature YT |

### Frontend — Onglet Visuels dans ContentStudioPage

```
┌─────────────────────────────────────────────────┐
│  🎨 VISUELS                                      │
│                                                   │
│  Format: [Post IG ▼]  Style: [Minimaliste ▼]    │
│                                                   │
│  ┌──────────────────────────────────────┐        │
│  │                                      │        │
│  │         PREVIEW EN DIRECT            │        │
│  │                                      │        │
│  │    [Image composée affichée ici]     │        │
│  │                                      │        │
│  └──────────────────────────────────────┘        │
│                                                   │
│  Police titre : [Montserrat ▼]  Taille: [72]     │
│  Police sous-titre : [Inter ▼]  Taille: [24]     │
│  Couleur principale : [■ #F5A623]                │
│  Couleur texte : [■ #FFFFFF]                     │
│                                                   │
│  Image de fond :                                  │
│  ○ Générée par l'IA  ● Uploadée  ○ Couleur unie │
│  [Décrire l'ambiance souhaitée...]               │
│                                                   │
│  [Générer le visuel]  [Régénérer le fond]        │
│  [Exporter PNG]  [Exporter pour toutes les       │
│   plateformes]                                    │
└─────────────────────────────────────────────────┘
```

**Interaction utilisateur** :
- L'utilisateur peut uploader une image OU demander à l'IA de la générer
- Il choisit la police dans un dropdown (Google Fonts, top 50 les plus populaires)
- Il peut ajuster les couleurs en live
- Un bouton "Exporter pour toutes les plateformes" génère automatiquement toutes les déclinaisons (IG, FB, LinkedIn, X) à partir d'un seul design

---

## PHASE 3 — Video Generator Agent (Équipe dev)

### Objectif
Agent qui génère des clips vidéo IA structurés en scènes, commandables individuellement.

### `video_generator_agent.py` — Spécifications

```python
class VideoGeneratorAgent:
    """
    Agent de génération vidéo. Décompose un brief en scènes,
    génère chaque scène via Veo 2.0, et retourne les clips bruts.
    """

    # PIPELINE :
    #
    # 1. STORYBOARD AUTOMATIQUE
    #    L'utilisateur donne un brief ("Pub 30s pour FLARE AI")
    #    L'agent (via Gemini Pro) décompose en storyboard :
    #    {
    #      "title": "Pub FLARE AI 30s",
    #      "total_duration": 30,
    #      "scenes": [
    #        {
    #          "id": 1,
    #          "start": 0, "end": 5,
    #          "visual_prompt": "Plan large, bureau moderne à Antananarivo,
    #                           lumière dorée matinale, personne devant un ordinateur",
    #          "voiceover": "Dans un monde où l'information va vite...",
    #          "text_overlay": null,
    #          "mood": "inspiring",
    #          "camera": "slow dolly in"
    #        },
    #        {
    #          "id": 2,
    #          "start": 5, "end": 12,
    #          "visual_prompt": "Gros plan écran d'ordinateur, interface FLARE AI
    #                           avec des résultats de recherche qui s'affichent",
    #          "voiceover": "FLARE AI analyse, comprend et crée pour vous.",
    #          "text_overlay": "Recherche intelligente",
    #          "mood": "dynamic",
    #          "camera": "close-up, slight zoom"
    #        },
    #        ...
    #      ]
    #    }
    #
    # 2. GÉNÉRATION PAR SCÈNE
    #    Chaque scène → un appel Veo 2.0 indépendant (parallélisable)
    #    L'utilisateur peut :
    #    - Régénérer une scène spécifique sans toucher aux autres
    #    - Remplacer une scène par un rush uploadé
    #    - Modifier le prompt d'une scène et régénérer
    #
    # 3. RUSHES UTILISATEUR
    #    L'utilisateur peut uploader ses propres vidéos.
    #    L'agent les intègre au storyboard comme des scènes existantes.
    #    Format accepté : MP4, MOV, WebM (max 500MB par fichier)

    # OUTILS :
    TOOLS = [
        "generate_storyboard",     # Gemini Pro → décomposition en scènes
        "generate_scene",          # Veo 2.0 → clip vidéo par scène
        "upload_rush",             # Stockage GCS du rush utilisateur
        "preview_storyboard",      # Rendu texte/image du storyboard
        "regenerate_scene",        # Régénère une scène spécifique
    ]
```

### Frontend — Onglet Vidéo dans ContentStudioPage

```
┌────────────────────────────────────────────────────────┐
│  🎬 VIDÉO                                               │
│                                                          │
│  Brief : [Décrivez votre vidéo...]                      │
│  Durée cible : [30s ▼]   Style : [Cinématique ▼]       │
│  [Générer le storyboard]                                 │
│                                                          │
│  ┌─ STORYBOARD ──────────────────────────────────────┐  │
│  │                                                    │  │
│  │  [Scène 1]     [Scène 2]     [Scène 3]     [+]   │  │
│  │  0:00-0:05     0:05-0:12     0:12-0:20            │  │
│  │  ┌────────┐   ┌────────┐   ┌────────┐            │  │
│  │  │ thumb  │   │ thumb  │   │ thumb  │            │  │
│  │  │  ▶     │   │  ▶     │   │  ▶     │            │  │
│  │  └────────┘   └────────┘   └────────┘            │  │
│  │  "Bureau      "Écran        "Montage              │  │
│  │   moderne"     FLARE AI"     rapide"              │  │
│  │  [Régénérer]  [Régénérer]   [Uploader            │  │
│  │  [Modifier]   [Modifier]     un rush]             │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Générer toutes les scènes]  [Envoyer au monteur →]   │
└────────────────────────────────────────────────────────┘
```

**Interaction utilisateur** :
- L'utilisateur écrit un brief → l'IA génère un storyboard visuel
- Chaque scène est une carte avec thumbnail + description
- Click sur une scène → modifier le prompt, régénérer, ou remplacer par un rush uploadé
- Drag & drop pour réordonner les scènes
- Bouton "Envoyer au monteur" → passe les clips bruts au Video Editor (Phase 4)

---

## PHASE 4 — Video Editor Agent (Claude Opus — complexe)

### Objectif
Agent monteur professionnel qui assemble, monte et post-produit des vidéos avec de vraies compétences cinématographiques.

### Pourquoi c'est la phase la plus complexe

1. **FFmpeg est un outil bas-niveau** — il faut traduire des intentions créatives ("transition fluide entre les scènes") en commandes FFmpeg précises avec des filtergraphs complexes
2. **Le montage est subjectif** — un bon monteur fait des choix artistiques (rythme, timing des coupes, choix de transitions)
3. **La chaîne de traitement est longue** — chaque opération produit un fichier temporaire, il faut gérer le pipeline
4. **Les erreurs sont silencieuses** — un mauvais filtergraph FFmpeg ne crash pas toujours, il produit juste une vidéo cassée

### `video_editor_agent.py` — Spécifications détaillées

```python
class VideoEditorAgent:
    """
    Agent monteur vidéo professionnel.
    Traduit des intentions de montage en pipeline FFmpeg/MoviePy.

    ARCHITECTURE INTERNE :

    L'agent ne manipule JAMAIS FFmpeg directement via des commandes shell.
    Il génère un Edit Decision List (EDL) en JSON structuré.
    Un moteur d'exécution (VideoRenderEngine) interprète l'EDL
    et exécute les commandes FFmpeg correspondantes.

    Agent LLM → EDL JSON → VideoRenderEngine → FFmpeg → Fichier final
    """

    # ═══════════════════════════════════════════════
    # COMPÉTENCE 1 : MONTAGE DE BASE
    # ═══════════════════════════════════════════════
    #
    # Coupes et assemblage :
    # - Trim : extraire un segment précis d'un clip (in/out points)
    # - Concat : assembler des clips en séquence
    # - Split : couper un clip en deux à un timecode précis
    # - Reorder : réorganiser l'ordre des clips
    #
    # Timing et vitesse :
    # - Speed : accélérer/ralentir un clip (0.25x à 4x)
    # - Speed ramp : accélération progressive (slow-mo → vitesse normale)
    # - Reverse : lecture inversée
    # - Freeze frame : geler une image pendant N secondes
    #
    # Format EDL pour le montage de base :
    # {
    #   "version": "1.0",
    #   "project": { "name": "...", "resolution": "1920x1080", "fps": 30 },
    #   "timeline": [
    #     {
    #       "type": "clip",
    #       "source": "gs://bucket/clip1.mp4",
    #       "in": 0.0, "out": 5.0,
    #       "speed": 1.0,
    #       "transition_in": null,
    #       "transition_out": { "type": "crossfade", "duration": 0.5 }
    #     },
    #     ...
    #   ]
    # }

    # ═══════════════════════════════════════════════
    # COMPÉTENCE 2 : TRANSITIONS PROFESSIONNELLES
    # ═══════════════════════════════════════════════
    #
    # Transitions douces :
    # - Crossfade (fondu enchaîné) : le plus classique
    # - Fade to black / Fade from black
    # - Dissolve : fondu avec texture
    #
    # Transitions dynamiques :
    # - Wipe (horizontal, vertical, diagonal, circulaire)
    # - Slide (push left/right/up/down)
    # - Zoom transition : zoom avant sur le clip sortant → zoom arrière sur l'entrant
    # - Whip pan : flou directionnel rapide entre deux clips
    #
    # Transitions graphiques :
    # - Glitch transition : artefacts numériques stylisés
    # - Light leak : fuite de lumière organique
    # - Shape mask : transition à travers une forme (cercle, losange, hexagone)
    #
    # Implémentation FFmpeg :
    # - Crossfade : xfade filter avec offset calculé
    # - Wipe : xfade=transition=wipeleft:duration=0.5
    # - Zoom : zoompan + crossfade combinés
    # - Glitch/Light leak : overlay d'un asset pré-rendu

    # ═══════════════════════════════════════════════
    # COMPÉTENCE 3 : TEXTES ET TITRES ANIMÉS
    # ═══════════════════════════════════════════════
    #
    # Types de textes :
    # - Titre principal : grande police, centré, animation d'entrée/sortie
    # - Sous-titre : plus petit, sous le titre principal
    # - Lower third : bandeau en bas avec nom/titre (style JT/interview)
    # - Caption/sous-titres : texte synchronisé au timecode
    # - Call to action : texte avec fond coloré, bouton stylisé
    #
    # Animations de texte :
    # - fade_in / fade_out
    # - slide_up / slide_down / slide_left / slide_right
    # - typewriter : caractères apparaissent un par un
    # - scale_in : le texte grossit depuis 0
    # - bounce : rebond élastique à l'arrivée
    # - blur_in : le texte se dé-floute progressivement
    #
    # Format EDL pour les textes :
    # {
    #   "type": "text_overlay",
    #   "content": "FLARE AI",
    #   "font": "Montserrat-Bold",
    #   "size": 64,
    #   "color": "#FFFFFF",
    #   "position": { "x": "center", "y": "center" },
    #   "background": { "color": "#000000", "opacity": 0.5, "padding": 20 },
    #   "animation_in": { "type": "slide_up", "duration": 0.5 },
    #   "animation_out": { "type": "fade_out", "duration": 0.3 },
    #   "start": 3.0,
    #   "duration": 4.0
    # }
    #
    # Implémentation :
    # - Polices : Google Fonts téléchargées dans /tmp/fonts/
    # - Animations : FFmpeg drawtext avec enable='between(t,start,end)'
    #   + expressions pour x, y, fontsize, alpha
    # - Lower thirds : rectangle semi-transparent + texte positionné
    # - Typewriter : drawtext avec text=substr(text,0,t*chars_per_sec)

    # ═══════════════════════════════════════════════
    # COMPÉTENCE 4 : RACCORDS CINÉMATOGRAPHIQUES
    # ═══════════════════════════════════════════════
    #
    # L'agent doit comprendre et appliquer les règles de montage :
    #
    # - Cut on action : couper pendant un mouvement pour fluidifier
    #   → L'agent analyse le dernier frame du clip A et le premier du clip B
    #   → Ajuste les in/out points pour que le mouvement soit continu
    #
    # - Match cut : deux plans visuellement similaires enchaînés
    #   → L'agent détecte les similitudes de composition entre clips
    #
    # - J-cut : l'audio du clip B commence avant la vidéo
    #   → Audio offset négatif sur le clip B
    #   Format : { "audio_offset": -1.5 }  (audio commence 1.5s avant la vidéo)
    #
    # - L-cut : l'audio du clip A continue sur la vidéo du clip B
    #   → Audio du clip A prolongé au-delà de son out point
    #   Format : { "audio_extend": 2.0 }  (audio continue 2s après la coupe)
    #
    # - Jump cut contrôlé : coupes rapides dans le même plan (style vlog/montage)
    #   → L'agent détecte les silences/pauses dans l'audio
    #   → Coupe automatique aux silences

    # ═══════════════════════════════════════════════
    # COMPÉTENCE 5 : MOTION DESIGN
    # ═══════════════════════════════════════════════
    #
    # Effets visuels :
    # - Ken Burns : zoom lent + pan sur une image fixe (pour les photos)
    #   → FFmpeg zoompan filter
    #
    # - Picture-in-Picture : petite vidéo dans un coin
    #   → FFmpeg overlay filter avec positionnement
    #
    # - Split screen : 2 à 4 vidéos côte à côte
    #   → FFmpeg hstack/vstack ou xstack
    #
    # - Masques animés : une forme qui révèle progressivement
    #   → FFmpeg alphamerge avec masque animé
    #
    # - Particules / Éléments graphiques : overlay d'assets pré-rendus
    #   → Bibliothèque d'assets (confetti, sparkles, smoke, etc.)
    #   → Overlay avec chromakey ou alpha
    #
    # Format EDL pour le motion design :
    # {
    #   "type": "effect",
    #   "effect": "ken_burns",
    #   "source": "gs://bucket/photo.jpg",
    #   "zoom_start": 1.0, "zoom_end": 1.3,
    #   "pan_direction": "left_to_right",
    #   "duration": 5.0
    # }

    # ═══════════════════════════════════════════════
    # COMPÉTENCE 6 : POST-PRODUCTION
    # ═══════════════════════════════════════════════
    #
    # Color grading :
    # - LUTs prédéfinies : cinematic_warm, cold_blue, vintage, noir_et_blanc,
    #   sunset_orange, teal_and_orange, desaturated, high_contrast
    # - Ajustements manuels : brightness, contrast, saturation, gamma, hue
    # - Implémentation : FFmpeg lut3d pour LUTs, eq/colorbalance pour ajustements
    #
    # Audio :
    # - Ajout de musique de fond (volume ajustable)
    # - Normalisation audio (loudnorm filter)
    # - Fade in/out audio
    # - Ducking : la musique baisse quand il y a de la voix
    #   → FFmpeg sidechaincompress
    # - Suppression de bruit de fond (afftdn filter)
    #
    # Sous-titres automatiques :
    # - Transcription via Gemini Audio (déjà câblé)
    # - Génération de fichier .srt avec timecodes
    # - Burn-in des sous-titres avec style personnalisable
    # - Implémentation : FFmpeg subtitles filter avec fichier ASS stylé
    #
    # Stabilisation :
    # - FFmpeg vidstabdetect + vidstabtransform (2 passes)
    #
    # Export multi-format :
    # - 16:9 (YouTube, paysage)
    # - 9:16 (Reels, Stories, TikTok)
    # - 1:1 (Feed Instagram)
    # - Auto-reframe : recadrage intelligent basé sur la détection de visage/sujet
    #   → FFmpeg cropdetect + scale + crop

    # ═══════════════════════════════════════════════
    # MOTEUR DE RENDU — VideoRenderEngine
    # ═══════════════════════════════════════════════
    #
    # Classe séparée qui interprète l'EDL JSON et exécute FFmpeg.
    #
    # class VideoRenderEngine:
    #     """
    #     Interprète un EDL JSON et produit la vidéo finale via FFmpeg.
    #     Gère le pipeline de fichiers temporaires et le nettoyage.
    #     """
    #
    #     def render(self, edl: dict) -> str:
    #         """
    #         1. Valide l'EDL (schéma JSON)
    #         2. Télécharge les sources depuis GCS vers /tmp/
    #         3. Exécute les opérations dans l'ordre :
    #            a. Trim des clips sources
    #            b. Application des effets individuels
    #            c. Ajout des textes/overlays
    #            d. Transitions entre clips
    #            e. Concat final
    #            f. Color grading global
    #            g. Audio mix
    #            h. Export final
    #         4. Upload le résultat sur GCS
    #         5. Nettoie /tmp/
    #         6. Retourne l'URL publique
    #         """
    #
    #     Chaque étape produit un fichier temporaire.
    #     En cas d'erreur à l'étape N, les fichiers des étapes 1..N-1
    #     sont conservés pour debug, puis nettoyés après 1h.

    # OUTILS LangGraph :
    TOOLS = [
        "analyze_clips",            # Analyse les clips (durée, résolution, fps, audio)
        "generate_edl",             # Génère l'EDL JSON à partir d'instructions
        "render_preview",           # Rendu basse qualité rapide (480p, 15fps)
        "render_final",             # Rendu qualité finale (1080p/4K, 30/60fps)
        "add_music",                # Ajoute une piste audio
        "generate_subtitles",       # Transcription → SRT via Gemini Audio
        "apply_color_grade",        # Applique un LUT ou des corrections
        "auto_reframe",             # Recadrage intelligent pour autre ratio
        "export_multi_format",      # Export 16:9 + 9:16 + 1:1
    ]
```

### Frontend — Timeline de montage

```
┌──────────────────────────────────────────────────────────┐
│  ✂️ MONTEUR VIDÉO                                         │
│                                                           │
│  ┌─ PREVIEW ─────────────────────────────────────────┐   │
│  │                                                    │   │
│  │              [Lecteur vidéo intégré]               │   │
│  │              ▶ ⏸ ◀◀ ▶▶  00:12 / 00:30            │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─ TIMELINE ────────────────────────────────────────┐   │
│  │  🎬 Vidéo  ┃▓▓▓▓▓▓▓┃░░┃▓▓▓▓▓▓▓▓▓┃░░┃▓▓▓▓▓▓▓┃   │   │
│  │  📝 Textes ┃       ┃▓▓▓▓▓▓┃              ┃▓▓▓┃   │   │
│  │  🎵 Audio  ┃▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┃   │   │
│  │  ──────────┼───┼───┼───┼───┼───┼───┼───┼───┼──   │   │
│  │  0s    5s    10s   15s   20s   25s   30s          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─ INSTRUCTIONS IA ─────────────────────────────────┐   │
│  │  Décrivez le montage souhaité...                   │   │
│  │  Ex: "Ajoute une transition fluide entre les       │   │
│  │  scènes 1 et 2, mets un lower third avec           │   │
│  │  'FLARE AI' à 0:05, et applique un color           │   │
│  │  grading cinématique chaud sur l'ensemble"         │   │
│  │                                                    │   │
│  │  [Appliquer]  [Preview rapide]  [Rendu final]     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─ PANNEAU LATÉRAL ─┐                                   │
│  │  Transitions       │  Color grading : [Cinematic ▼]   │
│  │  ├ Crossfade       │  Musique : [Uploader ▼]          │
│  │  ├ Wipe            │  Sous-titres : [Auto ▼]          │
│  │  ├ Zoom            │  Export : [16:9 ▼] [1080p ▼]    │
│  │  └ Glitch          │                                   │
│  │  Textes            │  [Exporter toutes les versions]   │
│  │  ├ Titre           │                                   │
│  │  ├ Lower third     │                                   │
│  │  └ Caption         │                                   │
│  └────────────────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

---

## INFRASTRUCTURE — Dockerfile

```dockerfile
# Ajouts nécessaires au Dockerfile existant

# FFmpeg pour le montage vidéo
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Playwright pour le rendu HTML→image (Graphic Designer)
RUN pip install playwright && playwright install chromium --with-deps

# Dossier temporaire pour les rendus
RUN mkdir -p /tmp/renders /tmp/fonts /tmp/assets
```

## INFRASTRUCTURE — Cloud Run

| Paramètre | Valeur actuelle | Valeur recommandée | Raison |
|-----------|----------------|-------------------|---------|
| Memory | 512Mi | **2Gi minimum, 4Gi recommandé** | FFmpeg + Pillow + fichiers temporaires |
| CPU | 1 | **2 minimum, 4 recommandé** | Encodage vidéo = CPU intensif |
| Timeout | 300s | **900s (15min)** | Rendu vidéo long |
| Max instances | 10 | **5** | Limiter les coûts CPU |
| Concurrency | 80 | **10** | Chaque rendu est lourd |

### Alternative : Worker dédié pour les rendus lourds

Pour éviter de bloquer le backend principal, le rendu vidéo devrait idéalement passer par **Cloud Tasks** :

```
1. L'utilisateur demande un rendu → le backend crée une Cloud Task
2. La Cloud Task appelle un endpoint dédié /api/content-studio/render
3. Le rendu s'exécute en background (jusqu'à 30 minutes)
4. Le résultat est uploadé sur GCS
5. Le frontend est notifié via SSE ou polling
```

---

## STRUCTURE FICHIERS FINALE

```
backend/agents/content_studio/
├── __init__.py
├── supervisor.py                 # Orchestre les sous-agents
├── copywriter_agent.py           # Phase 1 — Textes
├── graphic_designer_agent.py     # Phase 2 — Visuels
├── video_generator_agent.py      # Phase 3 — Rushes IA
├── video_editor_agent.py         # Phase 4 — Montage
├── video_render_engine.py        # Phase 4 — Moteur FFmpeg
├── fonts_manager.py              # Phase 2 — Gestion Google Fonts
└── assets/                       # Assets pré-rendus
    ├── luts/                     # Fichiers .cube pour color grading
    │   ├── cinematic_warm.cube
    │   ├── cold_blue.cube
    │   ├── vintage.cube
    │   └── teal_and_orange.cube
    └── overlays/                 # Transitions/effets pré-rendus
        ├── light_leak_01.webm
        ├── glitch_01.webm
        └── confetti_01.webm

backend/routers/
└── content_studio.py             # API endpoints

frontend/src/components/
├── ContentStudioPage.tsx         # Page principale du studio
├── ContentStudioSidebar.tsx      # Navigation projets
├── CopywriterPanel.tsx           # Onglet textes
├── GraphicDesignerPanel.tsx      # Onglet visuels
├── VideoGeneratorPanel.tsx       # Onglet génération vidéo
├── VideoEditorPanel.tsx          # Onglet montage (timeline)
└── VideoTimeline.tsx             # Composant timeline interactif
```

---

## RÉSUMÉ DES RESPONSABILITÉS

| Qui | Quoi | Livrable |
|-----|------|---------|
| **Équipe dev IA** | Phase 1 : CopywriterAgent | `copywriter_agent.py` + `CopywriterPanel.tsx` |
| **Équipe dev IA** | Phase 2 : GraphicDesignerAgent | `graphic_designer_agent.py` + `GraphicDesignerPanel.tsx` |
| **Équipe dev IA** | Phase 3 : VideoGeneratorAgent | `video_generator_agent.py` + `VideoGeneratorPanel.tsx` |
| **Équipe dev IA** | Router + Supervisor + ContentStudioPage | `content_studio.py` + `supervisor.py` + `ContentStudioPage.tsx` |
| **Claude (Opus)** | Phase 4 : VideoEditorAgent | `video_editor_agent.py` + `video_render_engine.py` + `VideoEditorPanel.tsx` + `VideoTimeline.tsx` |
| **Claude (Opus)** | Assets (LUTs, overlays) | `assets/luts/` + `assets/overlays/` |

---

*Document de référence — Ne pas modifier sans validation de Kévin.*
