-- 013 : Type de projet + budget
-- Interne : pas de budget
-- Client  : budget prévu requis

ALTER TABLE projets
  ADD COLUMN IF NOT EXISTS type_projet TEXT NOT NULL DEFAULT 'Interne',
  ADD COLUMN IF NOT EXISTS budget_prevu NUMERIC(12,2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_projets_type'
  ) THEN
    ALTER TABLE projets
      ADD CONSTRAINT ck_projets_type
      CHECK (type_projet IN ('Interne', 'Client'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_projets_budget'
  ) THEN
    ALTER TABLE projets
      ADD CONSTRAINT ck_projets_budget
      CHECK (
        (type_projet = 'Interne' AND budget_prevu IS NULL)
        OR
        (type_projet = 'Client' AND budget_prevu IS NOT NULL AND budget_prevu >= 0)
      );
  END IF;
END $$;
