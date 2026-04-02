# Google Sheets

## Etat actuel

Google Sheets n'est pas encore dans le flux live.
Le vrai Google Sheet n'a pas ete modifie automatiquement depuis cette machine car l'acces API Google Sheets a retourne `403` sans credentials adequats.

## ID du classeur

- `1BbgEKcnEo1WJlGoe3mWQNtIHoWCL4XJzGyzElwMWhqA`

## Ce qui est pret

- script de bootstrap : [bootstrap_google_sheet.py](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/bootstrap_google_sheet.py)
- template workbook : [sheet_template.xlsx](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/sheet_template.xlsx)
- copie d'export : [chatbot_facebook_sheet_template.xlsx](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/output/spreadsheet/chatbot_facebook_sheet_template.xlsx)

## Onglets attendus

- `contacts`
- `events`
- `orders`
- `knowledge_base`

## Methode recommandee

### Option 1

Importer le workbook template dans Google Sheets.

### Option 2

Renseigner `GOOGLE_SERVICE_ACCOUNT_JSON` dans [`.env`](D:/Travail/RAM'S%20FLARE/Flare%20Group/Flare%20AI/Antigravity/FLARE%20AI%20OS/V2/chatbot%20Facebook/direct_service/.env) puis lancer :

```powershell
cd "D:\Travail\RAM'S FLARE\Flare Group\Flare AI\Antigravity\FLARE AI OS\V2\chatbot Facebook\direct_service"
python -m pip install -r admin_requirements.txt
python bootstrap_google_sheet.py
```

## A retenir

- le dashboard live actuel lit SQLite, pas Google Sheets
- Google Sheets reste une piste de suivi metier secondaire
