-- ─────────────────────────────────────────────────────────────────────────────
-- 009 : Suivi de la dernière connexion
--   Ajoute une colonne derniere_connexion sur utilisateurs, mise à jour à
--   chaque login réussi. Permet à l'admin de détecter les comptes dormants
--   ou jamais utilisés (offboarding).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;
