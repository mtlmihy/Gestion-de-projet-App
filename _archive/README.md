# Archives

Ce dossier contient des fichiers conserves pour tracabilite historique mais qui ne sont plus utilises par l'application active (frontend React/Vite + backend FastAPI).

## legacy-streamlit/

Contient l'ancienne application Streamlit (mono-fichier Python) qui a precede l'architecture actuelle React + FastAPI.

## cleanup-2026-05/

Contient le nettoyage de structure realise en mai 2026, sans impact UX ni runtime:

- backend-scripts/: scripts one-shot de migrations manuelles
- db-sql/: scripts SQL globaux Supabase (non source de verite)
- data/: anciennes donnees CSV/JSON locales de la version Streamlit
- docs/: notes de cadrage et de suivi de travail historiques

## Restauration

Pour restaurer un fichier, deplacez-le vers son emplacement d'origine (racine du projet ou sous-dossier cible).

La source de verite runtime reste:

- frontend/
- backend/
- start.ps1
