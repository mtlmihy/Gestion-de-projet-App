-- 014 : Devise du projet (CHF/EUR)

ALTER TABLE projets
  ADD COLUMN IF NOT EXISTS devise TEXT NOT NULL DEFAULT 'CHF';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_projets_devise'
  ) THEN
    ALTER TABLE projets
      ADD CONSTRAINT ck_projets_devise
      CHECK (devise IN ('CHF', 'EUR'));
  END IF;
END $$;
