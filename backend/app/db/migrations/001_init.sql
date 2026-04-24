-- =============================================================================
-- Migration 001 — Schéma initial
-- Remplace init_db() de db.py (Streamlit)
-- À exécuter UNE SEULE FOIS sur la base cible :
--   psql -U postgres -d AppGDP -f 001_init.sql
-- =============================================================================

-- ── Risques ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risques (
    id          TEXT        PRIMARY KEY,
    identifiant TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    categorie   TEXT        NOT NULL DEFAULT '',
    probabilite TEXT        NOT NULL DEFAULT 'Faible',
    impact      TEXT        NOT NULL DEFAULT 'Faible',
    priorite    INTEGER     NOT NULL DEFAULT 1 CHECK (priorite IN (1, 2, 3)),
    responsable TEXT        NOT NULL DEFAULT '',
    attenuation TEXT        NOT NULL DEFAULT '',
    statut      TEXT        NOT NULL DEFAULT 'Ouvert',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tâches ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taches (
    id          TEXT        PRIMARY KEY,
    nom         TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    importance  TEXT        NOT NULL DEFAULT 'Moyenne',
    avancement  INTEGER     NOT NULL DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),
    assigne     TEXT        NOT NULL DEFAULT '',
    jalon       TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Équipe ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipe (
    id            TEXT        PRIMARY KEY,
    collaborateur TEXT        NOT NULL,
    poste         TEXT        NOT NULL DEFAULT '',
    manager       TEXT        NOT NULL DEFAULT '',
    numero        TEXT        NOT NULL DEFAULT '',
    email         TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Cahier des Charges ────────────────────────────────────────────────────────
-- Une seule ligne (id = 1), upsert à chaque sauvegarde.
CREATE TABLE IF NOT EXISTS cahier_des_charges (
    id         INTEGER     PRIMARY KEY DEFAULT 1,
    data       JSONB       NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cahier_des_charges
    ADD CONSTRAINT IF NOT EXISTS single_row CHECK (id = 1);

-- ── Index utiles ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_risques_statut    ON risques (statut);
CREATE INDEX IF NOT EXISTS idx_risques_priorite  ON risques (priorite);
CREATE INDEX IF NOT EXISTS idx_taches_jalon      ON taches  (jalon);
CREATE INDEX IF NOT EXISTS idx_equipe_manager    ON equipe  (manager);
