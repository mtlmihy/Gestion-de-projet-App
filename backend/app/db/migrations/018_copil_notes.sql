-- ─────────────────────────────────────────────────────────────────────────────
-- 018 : COPIL - notes de réunion horodatées
--   Ajoute un journal de notes centralisé pour chaque réunion COPIL.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copil_reunion_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copil_id    UUID NOT NULL REFERENCES copil_reunions(id) ON DELETE CASCADE,
    auteur_id   UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    contenu     TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copil_notes_copil_created
    ON copil_reunion_notes(copil_id, created_at DESC);
