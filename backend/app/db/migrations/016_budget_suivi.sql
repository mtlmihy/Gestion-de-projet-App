-- 016 : Suivi budgétaire
CREATE TABLE IF NOT EXISTS budget_lignes (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id     UUID          NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    date          DATE          NOT NULL DEFAULT CURRENT_DATE,
    categorie     TEXT          NOT NULL DEFAULT 'Autre',
    description   TEXT          NOT NULL DEFAULT '',
    montant       NUMERIC(12,2) NOT NULL,
    date_creation TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_budget_montant    CHECK (montant >= 0),
    CONSTRAINT ck_budget_categorie  CHECK (
        categorie IN ('Prestation','Matériel','Déplacement','Formation','Sous-traitance','Autre')
    )
);
CREATE INDEX IF NOT EXISTS idx_budget_lignes_projet ON budget_lignes (projet_id);
