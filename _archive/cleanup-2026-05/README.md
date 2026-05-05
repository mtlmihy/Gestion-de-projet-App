# Cleanup 2026-05

Ce dossier contient les fichiers retires de la racine/runtime pour assainir le projet, sans changer l'experience utilisateur.

## Contenu

- backend-scripts/: anciens scripts de migration one-shot
- db-sql/: scripts SQL globaux Supabase (hors migrations sequentielles)
- data/: anciennes donnees locales CSV/JSON de la version legacy
- docs/: documents de cadrage/historique non runtime

## Pourquoi

- Reduire le bruit dans le depot
- Clarifier la source de verite technique
- Eviter l'execution accidentelle de scripts obsoletes
