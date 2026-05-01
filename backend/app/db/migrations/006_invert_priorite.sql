-- Inversion de la convention de priorité des risques.
-- Ancienne convention : P1 = faible, P3 = critique
-- Nouvelle convention (ITIL) : P1 = critique, P3 = faible
-- Mapping : 1 -> 3, 3 -> 1, 2 inchangé.
UPDATE risques SET priorite = 4 - priorite WHERE priorite IN (1, 2, 3);

-- Le champ "gravite" n'est plus utilisé par l'application.
-- On le laisse en base pour ne rien casser, mais il peut être supprimé plus tard avec :
--   ALTER TABLE risques DROP COLUMN gravite;
