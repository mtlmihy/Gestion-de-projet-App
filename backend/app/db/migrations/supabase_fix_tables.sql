-- ─────────────────────────────────────────────────────────────────────────────
--  Correctifs des tables existantes — à coller dans Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── taches ────────────────────────────────────────────────────────────────────
ALTER TABLE taches
    ADD COLUMN IF NOT EXISTS description TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS importance  VARCHAR(50) NOT NULL DEFAULT 'Moyenne',
    ADD COLUMN IF NOT EXISTS avancement  INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS jalon       TEXT        NOT NULL DEFAULT '';

-- Migrer assigne_a de UUID vers TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='taches' AND column_name='assigne_a' AND data_type='uuid'
    ) THEN
        ALTER TABLE taches DROP COLUMN assigne_a;
        ALTER TABLE taches ADD COLUMN assigne_a TEXT NOT NULL DEFAULT '';
    ELSE
        ALTER TABLE taches ADD COLUMN IF NOT EXISTS assigne_a TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- ── risques ───────────────────────────────────────────────────────────────────
ALTER TABLE risques
    ADD COLUMN IF NOT EXISTS description TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS categorie   TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS probabilite VARCHAR(50) NOT NULL DEFAULT 'Faible',
    ADD COLUMN IF NOT EXISTS impact      VARCHAR(50) NOT NULL DEFAULT 'Faible',
    ADD COLUMN IF NOT EXISTS priorite    INT         NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS responsable TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS attenuation TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS statut      VARCHAR(50) NOT NULL DEFAULT 'Ouvert';

-- ── cdc ───────────────────────────────────────────────────────────────────────
-- (aucune colonne manquante, table déjà correcte)

-- ── projet_membres ────────────────────────────────────────────────────────────
-- Correction enum si accents présents
DO $$ BEGIN ALTER TYPE projet_role RENAME VALUE 'Propriétaire' TO 'Proprietaire'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE projet_role RENAME VALUE 'Éditeur'      TO 'Editeur';      EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE projet_role RENAME VALUE 'Client_Limité' TO 'Client_Limite'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;

-- Pages accessibles par membre (pour le rôle Client_Limite, NULL = toutes)
ALTER TABLE projet_membres
    ADD COLUMN IF NOT EXISTS pages_autorisees TEXT[] DEFAULT NULL;
