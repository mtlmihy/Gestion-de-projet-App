-- ─────────────────────────────────────────────────────────────────────────────
-- 010 : COPIL (réunions de pilotage)
--   Historise les réunions COPIL/COPROJ par projet : date, notes, décisions,
--   actions. Sert au suivi de gouvernance et à la passation.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copil_reunions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id       UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    date_reunion    DATE NOT NULL,
    titre           VARCHAR(200) NOT NULL,
    participants    TEXT,
    notes           TEXT,
    decisions       TEXT,
    actions         TEXT,
    createur_id     UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    date_creation   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    derniere_maj    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copil_projet_date
    ON copil_reunions(projet_id, date_reunion DESC);
