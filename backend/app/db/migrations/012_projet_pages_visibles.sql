-- ─────────────────────────────────────────────────────────────────────────────
-- 012 : Paramètres projet - pages visibles
--   NULL = toutes les pages visibles (comportement actuel)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS pages_visibles TEXT[] DEFAULT NULL;
