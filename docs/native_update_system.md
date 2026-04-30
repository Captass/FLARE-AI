# FLARE AI - Systeme de mises a jour natives

Mise a jour du 30 avril 2026.

Ce document decrit le mecanisme de mise a jour pour les clients FLARE AI :

- Web / PWA : mise a jour par redeploiement Render et service worker.
- Android : notification in-app puis telechargement du fichier `.apk`.
- Windows : notification in-app puis telechargement de l'installeur `.exe`.

## Objectif produit

Le comportement attendu est proche d'un logiciel moderne comme Claude Desktop :

1. L'application verifie sa version au demarrage.
2. Si une nouvelle version est disponible mais pas obligatoire, une notification apparait en bas a gauche.
3. Si la version installee est trop ancienne, une modale bloque l'utilisation et demande la mise a jour.
4. Sur Android et Windows, le bouton ouvre le lien officiel de telechargement.
5. Sur Web / PWA, le bouton recharge l'application ou active le nouveau service worker.

## Source de verite

Le backend expose :

```text
GET /api/app/version
```

Le routeur est :

```text
backend/routers/app_version.py
```

La configuration est centralisee dans :

```text
backend/core/config.py
render.yaml
```

Le frontend lit le manifeste via :

```text
frontend/src/hooks/useForceUpdate.ts
frontend/src/components/ForceUpdateModal.tsx
```

## Format du manifeste

Le backend renvoie les champs historiques pour compatibilite :

```json
{
  "current_version": "2.0.2",
  "latest_version": "2.0.2",
  "min_required": {
    "web": "2.0.2",
    "android": "2.0.2",
    "windows": "2.0.2"
  }
}
```

Il renvoie aussi un manifeste detaille par plateforme :

```json
{
  "platforms": {
    "android": {
      "latest_version": "2.0.2",
      "min_required_version": "2.0.2",
      "download_url": "https://github.com/Captass/FLARE-AI/releases/download/v2.0.2/flare-ai-android.apk",
      "release_notes": "Assistant Mail ameliore, verification des mises a jour native et correctifs de stabilite."
    },
    "windows": {
      "latest_version": "2.0.2",
      "min_required_version": "2.0.2",
      "download_url": "https://github.com/Captass/FLARE-AI/releases/download/v2.0.2/flare-ai-windows-setup.exe",
      "release_notes": "Assistant Mail ameliore, verification des mises a jour native et correctifs de stabilite."
    }
  }
}
```

## Variables de version

Backend :

```text
APP_CURRENT_VERSION
APP_MIN_REQUIRED_WEB_VERSION
APP_MIN_REQUIRED_ANDROID_VERSION
APP_MIN_REQUIRED_WINDOWS_VERSION
APP_ANDROID_RELEASE_URL
APP_WINDOWS_RELEASE_URL
APP_RELEASE_NOTES
```

Frontend :

```text
NEXT_PUBLIC_APP_VERSION
NEXT_PUBLIC_ANDROID_RELEASE_ASSET_URL
NEXT_PUBLIC_WINDOWS_RELEASE_ASSET_URL
NEXT_PUBLIC_ANDROID_RELEASE_VERSION
NEXT_PUBLIC_WINDOWS_RELEASE_VERSION
NEXT_PUBLIC_ANDROID_RELEASE_DATE
NEXT_PUBLIC_WINDOWS_RELEASE_DATE
```

## Mise a jour optionnelle

Pour afficher "Mise a jour disponible" sans bloquer l'utilisateur :

1. Publier les nouveaux assets GitHub Release.
2. Mettre `APP_CURRENT_VERSION` sur la nouvelle version.
3. Laisser les `APP_MIN_REQUIRED_*` sur l'ancienne version encore acceptee.
4. Deployer backend + frontend.

Exemple :

```text
APP_CURRENT_VERSION=2.0.3
APP_MIN_REQUIRED_ANDROID_VERSION=2.0.2
APP_MIN_REQUIRED_WINDOWS_VERSION=2.0.2
```

## Mise a jour obligatoire

Pour forcer tous les utilisateurs a mettre a jour :

1. Publier les nouveaux assets GitHub Release.
2. Mettre `APP_CURRENT_VERSION` sur la nouvelle version.
3. Mettre `APP_MIN_REQUIRED_*` sur la meme nouvelle version.
4. Deployer backend + frontend.

Exemple :

```text
APP_CURRENT_VERSION=2.0.3
APP_MIN_REQUIRED_ANDROID_VERSION=2.0.3
APP_MIN_REQUIRED_WINDOWS_VERSION=2.0.3
```

## Build Android APK

Build debug :

```powershell
cd frontend
npm run android:apk:debug
```

Build release signe :

```powershell
cd frontend
npm run android:apk:release
```

Le build release exige :

```text
FLARE_ANDROID_KEYSTORE_PATH
FLARE_ANDROID_KEYSTORE_PASSWORD
FLARE_ANDROID_KEY_ALIAS
FLARE_ANDROID_KEY_PASSWORD
```

Artefact attendu :

```text
artifacts/native/android/flare-ai-android.apk
```

Publier ensuite l'APK dans GitHub Releases avec un nom stable :

```text
flare-ai-android.apk
```

## Build Windows EXE

Build installeur NSIS :

```powershell
cd frontend
npm run desktop:build:windows
```

Artefact attendu :

```text
artifacts/native/windows/flare-ai-windows-setup.exe
```

Publier ensuite l'installeur dans GitHub Releases avec un nom stable :

```text
flare-ai-windows-setup.exe
```

## Limites actuelles

Android APK :

- L'application ouvre le lien APK officiel.
- L'installation finale reste geree par Android.
- Pour une experience encore plus native, il faudra ajouter une verification de signature et eventuellement un flux Play Store si FLARE AI est publie sur Google Play.

Windows EXE :

- L'application ouvre le lien de l'installeur officiel.
- L'installation finale reste geree par l'utilisateur.
- Pour une experience auto-updater complete, il faudra migrer vers le updater signe de Tauri avec cle de signature et manifeste dedie.

## Checklist release

1. Incrementer les versions dans `frontend/package.json`, `desktop/tauri/src-tauri/tauri.conf.json`, `render.yaml` et les variables backend.
2. Builder Android et Windows.
3. Publier les assets sur GitHub Releases.
4. Mettre a jour les URLs de release si le tag change.
5. Commit + push sur `main`.
6. Attendre le deploy Render.
7. Verifier `GET /api/app/version`.
8. Ouvrir l'app installee et verifier la notification en bas a gauche ou la modale obligatoire.
