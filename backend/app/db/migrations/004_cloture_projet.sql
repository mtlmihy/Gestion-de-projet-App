-- Clôture de projet : champ booléen dédié
-- Un projet clôturé passe en lecture seule pour tous sauf l'admin
ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS est_cloture BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS date_cloture TIMESTAMP;
