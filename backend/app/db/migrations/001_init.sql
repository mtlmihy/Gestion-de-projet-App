-- Statuts pour le cycle de vie du projet
CREATE TYPE projet_statut AS ENUM ('Brouillon', 'En cours', 'En pause', 'Clôturé');

-- Niveaux de droits sur un projet
CREATE TYPE projet_role AS ENUM ('Propriétaire', 'Éditeur', 'Lecteur', 'Client_Limité');

CREATE TABLE utilisateurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(100),
    poste VARCHAR(100),
    mot_de_passe TEXT NOT NULL, -- Pour la gestion de l'accès
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    statut projet_statut DEFAULT 'Brouillon',
    createur_id UUID REFERENCES utilisateurs(id), -- Qui a créé le projet
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_cloture TIMESTAMP
);

CREATE TABLE projet_membres (
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role projet_role NOT NULL,
    PRIMARY KEY (projet_id, utilisateur_id)
);

-- Cahier des charges (un seul par projet)
CREATE TABLE cdc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID UNIQUE REFERENCES projets(id) ON DELETE CASCADE, -- UNIQUE = 1 projet a 1 CDC
    contenu TEXT,
    derniere_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tâches
CREATE TABLE taches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    assigne_a UUID REFERENCES utilisateurs(id), -- Liaison propre vers un utilisateur
    statut VARCHAR(50),
    echeance DATE
);

-- Risques
CREATE TABLE risques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    gravite INT CHECK (gravite BETWEEN 1 AND 5)
);