-- Migration 003 : permissions d'accès aux pages par utilisateur
-- NULL = toutes les pages autorisées (pas de restriction)
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS pages_autorisees TEXT[] DEFAULT NULL;
