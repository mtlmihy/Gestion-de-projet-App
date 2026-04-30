# Archives

Ce dossier contient des fichiers conservés pour traçabilité historique mais qui ne sont plus utilisés par l'application active (frontend React/Vite + backend FastAPI).

## `legacy-streamlit/`

Contient l'ancienne application Streamlit (mono-fichier Python) qui a précédé l'architecture actuelle React + FastAPI.

| Fichier / Dossier | Description |
|---|---|
| `Gestion-de-projet-App.py` | Ancienne application Streamlit complète (UI + logique métier) |
| `db.py` | Couche d'accès PostgreSQL (psycopg2) utilisée par l'app Streamlit |
| `migrate_csv_to_db.py` | Script one-shot de migration CSV → PostgreSQL |
| `requirements.txt` | Dépendances Python de l'app Streamlit (streamlit, pandas, psycopg2-binary…) |
| `DOCUMENTATION.md` | Documentation de l'app Streamlit |
| `help suivi.txt` | Notes d'aide associées à l'ancienne app |
| `.streamlit/` | Configuration et secrets Streamlit |
| `.st_jalons_sync/` | Cache de synchronisation jalons généré par Streamlit |
| `assets/cahier_des_charges.html` | Export HTML statique du CDC (ancien) |
| `assets/Cahier-des-charges.docx` | Document Word source (ancien) |
| `assets/Guide-CDP.pdf` | Guide PDF (non référencé par la nouvelle app) |
| `__pycache__/` | Cache de bytecode Python lié à `db.py` |

## Restauration

Pour restaurer un fichier, il suffit de le déplacer à son emplacement d'origine (la racine du projet ou le sous-dossier d'origine). Aucun fichier de l'application active (`frontend/`, `backend/`, `start.ps1`) n'a été modifié.

## Remarque sur `data/`

Les fichiers CSV/JSON dans `data/` (à la racine, hors archive) **n'ont pas été archivés** par prudence : ils servaient de fallback à l'ancienne app et leur présence n'impacte pas l'application actuelle. Vous pouvez les archiver manuellement une fois certain que la base PostgreSQL contient bien toutes les données migrées.
