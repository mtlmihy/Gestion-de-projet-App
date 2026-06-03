-- Ajout du champ "charge_jours" sur les tâches
-- Règle : 1 jour = 8 heures. Exemples : 0.5 = demi-journée, 1 = 1 jour, 1.05 = 8h24.
-- Optionnel (NULL = charge non renseignée).
ALTER TABLE taches
  ADD COLUMN IF NOT EXISTS charge_jours NUMERIC(5,2) DEFAULT NULL;
