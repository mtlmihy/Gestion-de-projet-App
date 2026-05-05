-- =============================================================================
-- MIGRATION UNIQUE — QimProject
-- Consolidation des migrations 001 à 015
-- À exécuter une seule fois sur une base PostgreSQL vide.
--
-- Usage :
--   psql $DATABASE_URL -f 000_schema_complet.sql
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- TYPES ENUM
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE projet_statut AS ENUM ('Brouillon', 'En cours', 'En pause', 'Clôturé');
CREATE TYPE projet_role   AS ENUM ('Propriétaire', 'Éditeur', 'Lecteur', 'Client_Limité');
CREATE TYPE raci_role     AS ENUM ('R', 'A', 'C', 'I');

-- ─────────────────────────────────────────────────────────────────────────────
-- UTILISATEURS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE utilisateurs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    nom                 VARCHAR(100),
    poste               VARCHAR(100),
    mot_de_passe        TEXT         NOT NULL,
    date_creation       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    is_admin            BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    pages_autorisees    TEXT[]       DEFAULT NULL,   -- NULL = toutes les pages autorisées
    token_version       INTEGER      NOT NULL DEFAULT 0,
    derniere_connexion  TIMESTAMPTZ
);

CREATE INDEX idx_utilisateurs_email ON utilisateurs (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJETS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE projets (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(255)  NOT NULL,
    description     TEXT,
    statut          projet_statut DEFAULT 'Brouillon',
    createur_id     UUID          REFERENCES utilisateurs(id),
    date_creation   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    date_cloture    TIMESTAMP,
    est_cloture     BOOLEAN       NOT NULL DEFAULT FALSE,
    pages_visibles  TEXT[]        DEFAULT NULL,        -- NULL = toutes les pages visibles
    type_projet     TEXT          NOT NULL DEFAULT 'Interne',
    budget_prevu    NUMERIC(12,2) NULL,
    devise          TEXT          NOT NULL DEFAULT 'CHF',

    CONSTRAINT ck_projets_type
        CHECK (type_projet IN ('Interne', 'Client')),

    CONSTRAINT ck_projets_budget
        CHECK (
            (type_projet = 'Interne' AND budget_prevu IS NULL)
            OR
            (type_projet = 'Client' AND budget_prevu IS NOT NULL AND budget_prevu >= 0)
        ),

    CONSTRAINT ck_projets_devise
        CHECK (devise IN ('CHF', 'EUR'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MEMBRES DU PROJET (droits d'accès)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE projet_membres (
    projet_id       UUID REFERENCES projets(id)      ON DELETE CASCADE,
    utilisateur_id  UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role            projet_role NOT NULL,
    PRIMARY KEY (projet_id, utilisateur_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CAHIER DES CHARGES (1 par projet)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE cdc (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id    UUID UNIQUE REFERENCES projets(id) ON DELETE CASCADE,
    contenu      TEXT,
    derniere_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉQUIPE PROJET
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE equipe (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id     UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    collaborateur TEXT NOT NULL,
    poste         TEXT NOT NULL DEFAULT '',
    manager       TEXT NOT NULL DEFAULT '',
    numero        TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT ''
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TÂCHES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE taches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id   UUID REFERENCES projets(id)      ON DELETE CASCADE,
    nom         VARCHAR(255) NOT NULL,
    description TEXT,
    assigne_a   UUID REFERENCES utilisateurs(id),
    statut      VARCHAR(50),
    echeance    DATE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MATRICE RACI (liée aux tâches + membres équipe)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE tache_raci (
    tache_id   UUID      NOT NULL REFERENCES taches(id) ON DELETE CASCADE,
    membre_id  UUID      NOT NULL REFERENCES equipe(id) ON DELETE CASCADE,
    role       raci_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tache_id, membre_id)
);

-- Un seul Accountable et un seul Responsible par tâche
CREATE UNIQUE INDEX uq_tache_raci_one_a_per_tache ON tache_raci (tache_id) WHERE role = 'A';
CREATE UNIQUE INDEX uq_tache_raci_one_r_per_tache ON tache_raci (tache_id) WHERE role = 'R';
CREATE INDEX        idx_tache_raci_membre_id       ON tache_raci (membre_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RISQUES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE risques (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    nom       VARCHAR(255) NOT NULL,
    gravite   INT  CHECK (gravite BETWEEN 1 AND 5),
    priorite  INT           -- Convention ITIL : P1 = critique, P3 = faible
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LIENS EXTERNES PAR PROJET
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE projet_liens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id     UUID         NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    libelle       VARCHAR(100) NOT NULL,
    url           TEXT         NOT NULL,
    type          VARCHAR(20)  NOT NULL DEFAULT 'autre',  -- jira|miro|teams|confluence|github|drive|autre
    visible       BOOLEAN      NOT NULL DEFAULT TRUE,
    ordre         INT          NOT NULL DEFAULT 0,
    date_creation TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projet_liens_projet ON projet_liens (projet_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- JOURNAL D'AUDIT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    user_id     UUID         NULL REFERENCES utilisateurs(id) ON DELETE SET NULL,
    user_email  VARCHAR(255) NULL,
    action      VARCHAR(64)  NOT NULL,
    target_type VARCHAR(64)  NULL,
    target_id   VARCHAR(64)  NULL,
    ip          VARCHAR(64)  NULL,
    user_agent  TEXT         NULL,
    metadata    JSONB        NULL
);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX idx_audit_log_action     ON audit_log (action);

-- ─────────────────────────────────────────────────────────────────────────────
-- COPIL — RÉUNIONS DE PILOTAGE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE copil_reunions (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id      UUID         NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    date_reunion   DATE         NOT NULL,
    heure_reunion  TIME,
    titre          VARCHAR(200) NOT NULL,
    participants   TEXT,
    notes          TEXT,
    decisions      TEXT,
    actions        TEXT,
    createur_id    UUID         REFERENCES utilisateurs(id) ON DELETE SET NULL,
    date_creation  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    derniere_maj   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_copil_projet_date ON copil_reunions (projet_id, date_reunion DESC);

-- =============================================================================
COMMIT;
