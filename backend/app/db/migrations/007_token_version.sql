-- ─────────────────────────────────────────────────────────────────────────────
-- 007 : Révocation des JWT
--   Ajoute un compteur token_version sur utilisateurs.
--   Le JWT embarque ce numéro ; toute modification (logout global, reset
--   mot de passe, désactivation) incrémente le compteur ⇒ tous les tokens
--   précédents deviennent invalides immédiatement.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
