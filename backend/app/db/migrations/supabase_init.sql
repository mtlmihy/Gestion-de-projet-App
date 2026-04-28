-- ─────────────────────────────────────────────────────────────────────────────
--  Script d'initialisation Supabase — version complète et à jour
--  Coller dans : Supabase → SQL Editor → New query → Run
--  Idempotent : peut être ré-exécuté sans erreur
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ENUMs ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE projet_statut AS ENUM ('Brouillon', 'En cours', 'En pause', 'Clôturé');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE projet_role AS ENUM ('Proprietaire', 'Editeur', 'Lecteur', 'Client_Limite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Correction des valeurs d'enum si l'ancienne base avait des accents
DO $$ BEGIN ALTER TYPE projet_role RENAME VALUE 'Propriétaire' TO 'Proprietaire'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE projet_role RENAME VALUE 'Éditeur'      TO 'Editeur';      EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE projet_role RENAME VALUE 'Client_Limité' TO 'Client_Limite'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;

-- ── utilisateurs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateurs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) UNIQUE NOT NULL,
    nom               VARCHAR(100),
    poste             VARCHAR(100),
    mot_de_passe      TEXT        NOT NULL,
    is_admin          BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    peut_creer_projet BOOLEAN     NOT NULL DEFAULT FALSE,
    pages_autorisees  TEXT[]      DEFAULT NULL,
    date_creation     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs (email);

ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS is_admin          BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active         BOOLEAN  NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS peut_creer_projet BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pages_autorisees  TEXT[]   DEFAULT NULL;

-- ── projets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projets (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    nom          VARCHAR(255)   NOT NULL,
    description  TEXT           NOT NULL DEFAULT '',
    statut       projet_statut  NOT NULL DEFAULT 'Brouillon',
    est_cloture  BOOLEAN        NOT NULL DEFAULT FALSE,
    createur_id  UUID           REFERENCES utilisateurs(id),
    date_creation TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    date_cloture  TIMESTAMP
);

ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS est_cloture  BOOLEAN   NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS date_cloture TIMESTAMP;

-- ── projet_membres ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projet_membres (
    projet_id       UUID        REFERENCES projets(id)      ON DELETE CASCADE,
    utilisateur_id  UUID        REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role            projet_role NOT NULL,
    PRIMARY KEY (projet_id, utilisateur_id)
);

-- ── cdc ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cdc (
    id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id    UUID      UNIQUE REFERENCES projets(id) ON DELETE CASCADE,
    contenu      TEXT,
    derniere_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── taches ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taches (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id   UUID         REFERENCES projets(id) ON DELETE CASCADE,
    nom         VARCHAR(255) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    importance  VARCHAR(50)  NOT NULL DEFAULT 'Moyenne',
    avancement  INT          NOT NULL DEFAULT 0,
    assigne_a   TEXT         NOT NULL DEFAULT '',
    jalon       TEXT         NOT NULL DEFAULT '',
    statut      VARCHAR(50)  NOT NULL DEFAULT 'A faire',
    echeance    DATE
);

ALTER TABLE taches
    ADD COLUMN IF NOT EXISTS description TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS importance  VARCHAR(50) NOT NULL DEFAULT 'Moyenne',
    ADD COLUMN IF NOT EXISTS avancement  INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS jalon       TEXT        NOT NULL DEFAULT '';

-- Migrer assigne_a de UUID vers TEXT si nécessaire
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='taches' AND column_name='assigne_a'
          AND data_type='uuid'
    ) THEN
        ALTER TABLE taches DROP COLUMN assigne_a;
        ALTER TABLE taches ADD COLUMN assigne_a TEXT NOT NULL DEFAULT '';
    ELSE
        ALTER TABLE taches ADD COLUMN IF NOT EXISTS assigne_a TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- ── risques ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risques (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id   UUID         REFERENCES projets(id) ON DELETE CASCADE,
    nom         VARCHAR(255) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    categorie   TEXT         NOT NULL DEFAULT '',
    probabilite VARCHAR(50)  NOT NULL DEFAULT 'Faible',
    impact      VARCHAR(50)  NOT NULL DEFAULT 'Faible',
    priorite    INT          NOT NULL DEFAULT 1,
    responsable TEXT         NOT NULL DEFAULT '',
    attenuation TEXT         NOT NULL DEFAULT '',
    statut      VARCHAR(50)  NOT NULL DEFAULT 'Ouvert',
    gravite     INT          DEFAULT 1 CHECK (gravite BETWEEN 1 AND 5)
);

ALTER TABLE risques
    ADD COLUMN IF NOT EXISTS description TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS categorie   TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS probabilite VARCHAR(50) NOT NULL DEFAULT 'Faible',
    ADD COLUMN IF NOT EXISTS impact      VARCHAR(50) NOT NULL DEFAULT 'Faible',
    ADD COLUMN IF NOT EXISTS priorite    INT         NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS responsable TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS attenuation TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS statut      VARCHAR(50) NOT NULL DEFAULT 'Ouvert';

-- ── equipe ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipe (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id     UUID         REFERENCES projets(id) ON DELETE CASCADE,
    collaborateur VARCHAR(255) NOT NULL,
    poste         TEXT         NOT NULL DEFAULT '',
    manager       TEXT         NOT NULL DEFAULT '',
    numero        TEXT         NOT NULL DEFAULT '',
    email         TEXT         NOT NULL DEFAULT ''
);

ALTER TABLE equipe
    ADD COLUMN IF NOT EXISTS poste   TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS manager TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS numero  TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS email   TEXT NOT NULL DEFAULT '';

-- ── SEED — Compte administrateur ──────────────────────────────────────────────
--   email    : admin@projet.local
--   password : Admin2026!
INSERT INTO utilisateurs (id, email, nom, poste, mot_de_passe, is_admin, is_active, peut_creer_projet)
VALUES (
    gen_random_uuid(),
    'admin@projet.local',
    'Administrateur',
    'Administrateur système',
    '$2b$12$9MSsv1SCPBn8R45ke8fKtumtJSc8z.GuTDw927dqx8BmsW1bkDhka',
    TRUE, TRUE, TRUE
)
ON CONFLICT (email) DO UPDATE
    SET mot_de_passe      = EXCLUDED.mot_de_passe,
        is_admin          = TRUE,
        is_active         = TRUE,
        peut_creer_projet = TRUE;
