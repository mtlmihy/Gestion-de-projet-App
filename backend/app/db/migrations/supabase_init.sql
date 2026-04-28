-- ─────────────────────────────────────────────────────────────────────────────
--  Script unique d'initialisation Supabase
--  Combine les migrations 001 → 004 + création du compte admin
--  À copier-coller dans : Supabase → SQL Editor → New query → Run
--
--  Idempotent : peut être ré-exécuté sans erreur (tout est protégé par
--  IF NOT EXISTS / DO $$ ... $$ / ON CONFLICT).
-- ─────────────────────────────────────────────────────────────────────────────

-- Extension nécessaire pour gen_random_uuid() (déjà active sur Supabase, par sécurité)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 001 — Schéma initial
-- ─────────────────────────────────────────────────────────────────────────────

-- Types ENUM (créés seulement s'ils n'existent pas)
DO $$ BEGIN
    CREATE TYPE projet_statut AS ENUM ('Brouillon', 'En cours', 'En pause', 'Clôturé');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE projet_role AS ENUM ('Proprietaire', 'Editeur', 'Lecteur', 'Client_Limite');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS utilisateurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(100),
    poste VARCHAR(100),
    mot_de_passe TEXT NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    statut projet_statut DEFAULT 'Brouillon',
    createur_id UUID REFERENCES utilisateurs(id),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_cloture TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projet_membres (
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role projet_role NOT NULL,
    PRIMARY KEY (projet_id, utilisateur_id)
);

CREATE TABLE IF NOT EXISTS cdc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID UNIQUE REFERENCES projets(id) ON DELETE CASCADE,
    contenu TEXT,
    derniere_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    assigne_a UUID REFERENCES utilisateurs(id),
    statut VARCHAR(50),
    echeance DATE
);

CREATE TABLE IF NOT EXISTS risques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    gravite INT CHECK (gravite BETWEEN 1 AND 5)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 002 — Rôles utilisateurs (admin / actif)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS is_admin  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 003 — Pages autorisées par utilisateur (NULL = toutes) + droit création projet
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS pages_autorisees TEXT[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS peut_creer_projet BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 004 — Clôture de projet
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS est_cloture BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS date_cloture TIMESTAMP;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — Compte administrateur
--   email    : admin@projet.local
--   password : Admin2026!
--   (hash bcrypt pré-calculé)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO utilisateurs (id, email, nom, poste, mot_de_passe, is_admin, is_active)
VALUES (
    gen_random_uuid(),
    'admin@projet.local',
    'Administrateur',
    'Administrateur système',
    '$2b$12$9MSsv1SCPBn8R45ke8fKtumtJSc8z.GuTDw927dqx8BmsW1bkDhka',  -- bcrypt de "Admin2026!"
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE
   SET nom          = EXCLUDED.nom,
       poste        = EXCLUDED.poste,
       mot_de_passe = EXCLUDED.mot_de_passe,
       is_admin     = TRUE,
       is_active    = TRUE;
