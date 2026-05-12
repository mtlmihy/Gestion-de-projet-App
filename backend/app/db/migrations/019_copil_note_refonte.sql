-- ─────────────────────────────────────────────────────────────────────────────
-- 019 : COPIL - refonte mode note
--   - Fusionne decisions/actions dans notes (conservation historique)
--   - Supprime decisions/actions devenues inutiles
--   - Rend heure_reunion obligatoire
-- ⚠️ À exécuter après avoir validé l'application de la nouvelle UI/API COPIL.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Conserve l'information existante avant suppression de colonnes.
UPDATE copil_reunions
SET notes = CONCAT_WS(
    E'\n\n',
    NULLIF(TRIM(notes), ''),
    CASE
        WHEN NULLIF(TRIM(decisions), '') IS NOT NULL THEN 'Décisions:' || E'\n' || TRIM(decisions)
        ELSE NULL
    END,
    CASE
        WHEN NULLIF(TRIM(actions), '') IS NOT NULL THEN 'Actions:' || E'\n' || TRIM(actions)
        ELSE NULL
    END
)
WHERE decisions IS NOT NULL OR actions IS NOT NULL;

-- Backfill technique pour permettre NOT NULL sans perdre d'enregistrements historiques.
UPDATE copil_reunions
SET heure_reunion = TIME '09:00'
WHERE heure_reunion IS NULL;

ALTER TABLE copil_reunions
    ALTER COLUMN heure_reunion SET NOT NULL,
    DROP COLUMN IF EXISTS decisions,
    DROP COLUMN IF EXISTS actions;

COMMIT;
