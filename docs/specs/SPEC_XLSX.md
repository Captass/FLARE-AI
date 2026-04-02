# Spécifications de l'Agent d'Analyse XLSX

## Objectif
Permettre à l'utilisateur d'uploader un fichier XLSX et d'en extraire les données sous format JSON.

## Modèles de Données

```json
// Réponse Analyse XLSX
{
  "filename": "string",
  "sheets": [
    {
      "sheet_name": "string",
      "data": [
        // array of rows, each row is an object
        // {"col1": "value1", "col2": "value2"}
      ]
    }
  ]
}
```

## Routes API

| Méthode | URL | Body | Response |
|---------|-----|------|----------|
| POST | `/api/tools/upload/xlsx` | `multipart/form-data` avec le fichier | `{"filename": "...", "sheets": [...]}` |

## Composants Frontend

| Nom | Props | Événements |
|-----|-------|------------|
| `XlsxUploader.tsx` | N/A | `onFileUpload(file)` |
| `XlsxViewer.tsx` | `jsonData: object` | Affiche les données JSON dans une vue formatée |

## Variables d'Environnement
- Aucune nouvelle variable requise pour le moment.
