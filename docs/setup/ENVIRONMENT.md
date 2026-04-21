# Environnement et fichiers `.env`

Derniere mise a jour : 21 avril 2026

## Regle importante

Les fichiers `.env` actifs ne doivent pas etre deplaces.
Ne jamais committer de secrets.

## Fichiers a connaitre

### Frontend

- `frontend/.env.local`
- `frontend/.env.example`
- `frontend/.env.staging.example`
- `frontend/.env.production.example`

### Backend

- `backend/.env`
- `backend/.env.example`
- `backend/.env.staging.example`
- `backend/.env.production.example`

## Variables frontend importantes

### API et callbacks

- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_URL_ANDROID`
- `NEXT_PUBLIC_API_URL_DESKTOP`
- `NEXT_PUBLIC_ANDROID_CALLBACK_URL`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL`
- `NEXT_PUBLIC_WEB_APP_URL`

Valeurs attendues pour le natif :

- `NEXT_PUBLIC_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL=flareai://oauth/windows`

### Downloads publics

Ces variables ne sont plus des URLs FLARE affichees a l'utilisateur. Elles sont les cibles finales des pages stables :

- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL`
- `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL`

Les boutons publics doivent pointer vers :

- `https://flareai.ramsflare.com/downloads/android`
- `https://flareai.ramsflare.com/downloads/windows`

Les valeurs recommandees pour les variables sont des assets GitHub Releases :

- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL=https://github.com/<org>/<repo>/releases/download/<tag>/flare-ai-android.apk`
- `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL=https://github.com/<org>/<repo>/releases/download/<tag>/flare-ai-windows-setup.exe`

Variables optionnelles d'affichage :

- `NEXT_PUBLIC_ANDROID_RELEASE_VERSION`
- `NEXT_PUBLIC_ANDROID_RELEASE_DATE`
- `NEXT_PUBLIC_WINDOWS_RELEASE_VERSION`
- `NEXT_PUBLIC_WINDOWS_RELEASE_DATE`

### Firebase

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Variables backend importantes

- `APP_ENV`
- `FRONTEND_URL`
- `BACKEND_URL`
- `DATABASE_URL`
- `NATIVE_CORS_ORIGINS`
- `NATIVE_ANDROID_CALLBACK_URL`
- `NATIVE_WINDOWS_CALLBACK_URL`

Valeurs natives recommandees :

- `NATIVE_CORS_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost`
- `NATIVE_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NATIVE_WINDOWS_CALLBACK_URL=flareai://oauth/windows`

## Build local rapide

### Frontend web

```powershell
cd frontend
npm run build
```

### Android release

```powershell
cd frontend
npm run android:apk:release
```

Sortie attendue :

- `artifacts/native/android/flare-ai-android.apk`

### Windows installer

```powershell
cd frontend
npm run desktop:build
```

Sortie attendue :

- `artifacts/native/windows/flare-ai-windows-setup.exe`

## Release GitHub

Le workflow `.github/workflows/native-release.yml` publie les binaires Android et Windows sur GitHub Releases.

Secrets requis :

- `FLARE_ANDROID_KEYSTORE_BASE64`
- `FLARE_ANDROID_KEYSTORE_PASSWORD`
- `FLARE_ANDROID_KEY_ALIAS`
- `FLARE_ANDROID_KEY_PASSWORD`

## Regle staging / production

- Android : APK release signe
- Windows : installateur NSIS `.exe`
- macOS / iPhone / iPad : web app / PWA uniquement
- ne jamais supposer un `.msi` ou un packaging store dans les exemples d'env
