-- Migration 015 : matrice RACI liée aux tâches et aux membres de l'équipe

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'raci_role') THEN
        CREATE TYPE raci_role AS ENUM ('R', 'A', 'C', 'I');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS tache_raci (
    tache_id   UUID NOT NULL REFERENCES taches(id) ON DELETE CASCADE,
    membre_id  UUID NOT NULL REFERENCES equipe(id) ON DELETE CASCADE,
    role       raci_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tache_id, membre_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tache_raci_one_a_per_tache
    ON tache_raci (tache_id)
    WHERE role = 'A';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tache_raci_one_r_per_tache
    ON tache_raci (tache_id)
    WHERE role = 'R';

CREATE INDEX IF NOT EXISTS idx_tache_raci_membre_id ON tache_raci(membre_id);
