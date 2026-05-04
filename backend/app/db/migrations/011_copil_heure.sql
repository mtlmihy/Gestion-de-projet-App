-- ─────────────────────────────────────────────────────────────────────────────
-- 011 : COPIL - ajout de l'heure de réunion
--   Permet de distinguer plusieurs réunions le même jour et d'afficher
--   l'heure dans l'interface COPIL.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE copil_reunions
    ADD COLUMN IF NOT EXISTS heure_reunion TIME;
