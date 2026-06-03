-- Ajout du champ "assigne" sur les lignes de budget
-- Permet le suivi "Qui / Quand / Combien" par membre de l'équipe.
ALTER TABLE budget_lignes
  ADD COLUMN IF NOT EXISTS assigne TEXT DEFAULT NULL;
