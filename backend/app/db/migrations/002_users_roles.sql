-- ─────────────────────────────────────────────────────────────────────────────
-- 002 : Gestion des utilisateurs — ajout is_admin, is_active
-- ─────────────────────────────────────────────────────────────────────────────

-- Colonnes supplémentaires sur la table utilisateurs (idempotentes)
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS is_admin  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Index utile pour la recherche par e-mail (login)
CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs (email);
