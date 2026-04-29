-- Liens externes par projet (Jira, Miro, Teams, Confluence, etc.)
-- Le chef de projet (Propriétaire) ajoute les liens pertinents pour SON projet
-- et choisit individuellement leur visibilité pour les autres membres.
CREATE TABLE IF NOT EXISTS projet_liens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id     UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    libelle       VARCHAR(100) NOT NULL,
    url           TEXT NOT NULL,
    type          VARCHAR(20)  NOT NULL DEFAULT 'autre', -- jira | miro | teams | confluence | github | drive | autre
    visible       BOOLEAN      NOT NULL DEFAULT TRUE,
    ordre         INT          NOT NULL DEFAULT 0,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projet_liens_projet ON projet_liens(projet_id);
