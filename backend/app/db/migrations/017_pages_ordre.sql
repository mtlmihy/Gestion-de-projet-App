-- 017 : Ordre personnalisé des pages dans le menu de navigation
ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS pages_ordre TEXT[];
