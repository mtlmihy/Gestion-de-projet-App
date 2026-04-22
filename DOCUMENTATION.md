# Documentation — Application de Gestion de Projet

> Application web développée avec **Streamlit** (Python).  
> Lancement : `python -m streamlit run app.py`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Installation et lancement](#2-installation-et-lancement)
3. [Architecture des fichiers](#3-architecture-des-fichiers)
4. [Navigation](#4-navigation)
5. [Pages de l'application](#5-pages-de-lapplication)
    - [Registre des Risques](#51-registre-des-risques)
    - [Suivi des Tâches](#52-suivi-des-tâches)
    - [Planning](#53-planning)
    - [Cahier des Charges](#54-cahier-des-charges)
    - [Équipe](#55-équipe)
    - [Aide Pilotage](#56-aide-pilotage)
6. [Sauvegarde des données](#6-sauvegarde-des-données)
7. [Thèmes clair / sombre](#7-thèmes-clair--sombre)
8. [Raccourcis clavier](#8-raccourcis-clavier)

---

## 1. Vue d'ensemble

L'application centralise les principaux outils de pilotage d'un projet :

| Module                | Rôle                                                             |
|-----------------------|------------------------------------------------------------------|
| Registre des Risques  | Identification, évaluation et suivi des risques projet           |
| Suivi des Tâches      | Gestion des tâches liées aux jalons et livrables                 |
| Planning              | Visualisation générée depuis le Cahier des Charges et les Tâches |
| Cahier des Charges    | Saisie et export du CDC projet (HTML interactif + JSON)          |
| Équipe                | Annuaire de l'équipe et organigramme interactif                  |
| Aide Pilotage         | Documents de référence téléchargeables (Guide CDP, CDC)          |

---

## 2. Installation et lancement

### Prérequis

- Python 3.10 ou supérieur
- pip

### Installation des dépendances

```bash
pip install -r requirements.txt
```

Le fichier `requirements.txt` contient :

```
streamlit>=1.30.0
pandas>=2.0.0
```

### Lancement

```bash
python -m streamlit run app.py
```

L'application s'ouvre automatiquement dans le navigateur à l'adresse `http://localhost:8501`.

---

## 3. Architecture des fichiers

```
TestApp/
├── app.py                          # Code source principal (application Streamlit)
├── requirements.txt                # Dépendances Python
├── DOCUMENTATION.md                # Ce fichier
├── data/                           # Données persistantes (générées par l'app) 
│   ├── registre_risques.csv        # Sauvegarde du registre des risques
│   ├── suivi_taches.csv            # Sauvegarde des tâches
│   ├── equipe_completions.csv      # Sauvegarde de l'équipe
│   └── cahier_des_charges.json     # Sauvegarde du Cahier des Charges
└── assets/                         # Fichiers statiques (templates, documents)
    ├── cahier_des_charges.html     # Interface HTML du Cahier des Charges
    ├── Guide-CDP.pdf               # Document Guide CDP (téléchargement)
    └── Cahier-des-charges.docx     # Document CDC Word (téléchargement)
```

> **Note :** Le dossier `data/` est créé automatiquement au premier lancement si absent. Les fichiers CSV et JSON sont générés avec des données d'exemple à la première utilisation.

---

## 4. Navigation

La navigation se fait via la **barre latérale gauche**. Chaque page est accessible en un clic.

Les pages disponibles sont :

1. Registre des Risques
2. Suivi des Tâches
3. Planning
4. Cahier des Charges
5. Équipe
6. Aide Pilotage

---

## 5. Pages de l'application

### 5.1 Registre des Risques

**Objectif :** Identifier, évaluer et suivre les risques du projet.

#### Fonctionnalités

- **Tableau des risques** — liste tous les risques avec : Identifiant, Description, Catégorie, Probabilité, Impact, Priorité, Responsable, Atténuation, Statut.
- **Ajout d'un risque** — formulaire accessible via le bouton `+ Nouveau risque`. Champs obligatoires : Identifiant, Description, Catégorie, Probabilité, Impact, Responsable.
- **Modification d'un risque** — cliquer sur une ligne du tableau pour ouvrir le formulaire pré-rempli.
- **Suppression d'un risque** — bouton `Supprimer` dans le formulaire d'édition (avec confirmation).
- **Filtres** — filtrage par Catégorie et/ou Statut depuis la barre latérale.
- **Export CSV** — téléchargement du registre complet au format CSV.
- **Import CSV** — chargement d'un CSV existant pour remplacer le registre en cours.

#### Calcul automatique de la priorité

La priorité est calculée automatiquement selon la matrice :

| Probabilité × Impact | Score    | Priorité |
|----------------------|----------|----------|
| Score ≥ 6            | Critique | 🔴 3    |
| Score ≥ 3            | Moyen    | 🟡 2    |
| Score < 3            | Faible   | 🟢 1    |

> La priorité peut être modifiée manuellement si besoin.

#### Catégories disponibles

`Opérations` · `Budget` · `Planning` · `Technologie` · `Sécurité` · `Financier` · `Ressources humaines` · `Conformité` · `Scope` · `Communication` · `Qualité` · `Changement`

---

### 5.2 Suivi des Tâches

**Objectif :** Gérer les tâches du projet, les associer à des jalons et suivre leur avancement.

#### Fonctionnalités

- **Tableau des tâches** — liste toutes les tâches avec : Nom, Description, Importance, Avancement (%), Assigné, Jalon.
- **Ajout d'une tâche** — bouton `+ Nouvelle tâche`. Champs : Nom, Description, Importance, Avancement, Assigné, Jalon (sélection parmi les jalons du CDC).
- **Modification d'une tâche** — cliquer sur une ligne pour ouvrir le formulaire d'édition.
- **Suppression d'une tâche** — bouton `Supprimer` dans le formulaire (avec confirmation).
- **Barre de progression** — affichage visuel de l'avancement (0–100 %).
- **Lien avec le Planning** — le champ `Jalon` rattache une tâche à un jalon défini dans le Cahier des Charges. Cela alimente les données affichées dans la page Planning.

#### Niveaux d'importance

| Niveau   | Signification                       |
|----------|-------------------------------------|
| Faible   | Peut être reportée                  |
| Moyenne  | À traiter dans le sprint courant    |
| Élevée   | Prioritaire                         |
| Critique | Bloquante — à traiter immédiatement |

---

### 5.3 Planning

**Objectif :** Visualiser l'avancement du projet sous forme de diagramme de Gantt, basé sur les jalons et les tâches.

#### Fonctionnement

- Le planning se **génère automatiquement** depuis :
  - Les **jalons** définis dans le Cahier des Charges (nom, date, description).
  - Les **tâches** du Suivi des Tâches et leur avancement.
- Aucune saisie n'est nécessaire sur cette page — elle est entièrement calculée.

#### Ce qui est affiché

- En-tête : nom du projet, chef de projet, date de début.
- Diagramme de Gantt : un bloc par jalon, avec indication de la date et l'état.
- Liste des tâches associées à chaque jalon avec leur barre de progression.

> **Prérequis :** Renseigner les jalons dans le Cahier des Charges pour que le planning s'affiche.

---

### 5.4 Cahier des Charges

**Objectif :** Rédiger, sauvegarder et exporter le Cahier des Charges du projet.

#### Fonctionnement

Le CDC est une **interface HTML interactive** chargée dans l'application. Elle permet de saisir :

- Informations générales : nom du projet, chef de projet, date de début, description.
- Objectifs, périmètre, contraintes.
- Jalons (nom + date + description) — utilisés par le Planning.
- Parties prenantes.
- Exigences fonctionnelles et techniques.

#### Sauvegarde et synchronisation

- Les données sont **sauvegardées dans `cahier_des_charges.json`** (fichier local).
- Le panneau `Synchronisation sauvegarde CDC` permet de :
  - **Importer** un fichier JSON pour restaurer un CDC précédent.
  - **Exporter** le JSON actuel pour le sauvegarder ou le partager.

> **Important :** Les modifications dans le CDC sont sauvegardées dans le JSON via l'interface HTML. Rechargez la page après un import JSON pour appliquer les nouvelles données.

---

### 5.5 Équipe

**Objectif :** Gérer l'annuaire de l'équipe projet et visualiser la hiérarchie sous forme d'organigramme.

#### Deux onglets

##### Onglet « Organigramme »

- Affiche l'arbre hiérarchique de l'équipe **généré automatiquement** depuis le tableau de complétion.
- Chaque nœud affiche : **Nom**, Poste, Numéro, Email.
- Navigation dans l'organigramme :
  - **Zoom** : molette de la souris ou boutons `+` / `−`
  - **Déplacement** : cliquer-glisser
  - **Ajuster** : bouton `Ajuster` — recentre et redimensionne pour voir tout l'organigramme
  - **100%** : remet le zoom à l'échelle 1:1 centré
- L'organigramme s'ouvre automatiquement sur une **vue d'ensemble centrée**.

##### Onglet « Tableau de complétion »

- Tableau éditable avec les colonnes : **Collaborateur**, **Poste**, **Manager**, **Numéro**, **Email**.
- Ajouter un membre : utiliser la dernière ligne vide du tableau.
- Modifier : cliquer directement sur une cellule.
- La colonne **Manager** doit contenir le nom exact d'un autre collaborateur du tableau pour créer un lien hiérarchique dans l'organigramme.
- Cliquer **Sauvegarder l'équipe** pour persister les modifications.

---

### 5.6 Aide Pilotage

**Objectif :** Mettre à disposition des ressources documentaires pour soutenir la gestion de projet.

#### Documents disponibles

| Document           | Format | Description                       |
|--------------------|--------|-----------------------------------|
| Guide CDP          | PDF    | Guide complet du chef de projet   |
| Cahier des Charges | DOCX   | Modèle Word du Cahier des Charges |

> Les fichiers doivent être présents dans le répertoire de l'application (`Guide-CDP.pdf`, `Cahier-des-charges.docx`). Un message d'erreur s'affiche si un fichier est absent.

---

## 6. Sauvegarde des données

Toutes les données sont sauvegardées **localement** dans des fichiers dans le répertoire de l'application.

| Module             | Fichier                   | Format          | Sauvegarde                        |
|--------------------|---------------------------|-----------------|-----------------------------------|
| Risques            | `registre_risques.csv`    | CSV (UTF-8 BOM) | Automatique à chaque modification |
| Tâches             | `suivi_taches.csv`        | CSV (UTF-8 BOM) | Automatique à chaque modification |
| Équipe             | `equipe_completions.csv`  | CSV (UTF-8 BOM) | Manuelle (bouton "Sauvegarder")   |
| Cahier des Charges | `cahier_des_charges.json` | JSON            | Via l'interface HTML du CDC       |

> **Migration automatique :** Si un CSV existant ne contient pas toutes les colonnes attendues, l'application ajoute les colonnes manquantes avec des valeurs vides au chargement. Les données existantes ne sont pas perdues.

---

## 7. Thèmes clair / sombre

L'application respecte le thème configuré dans Streamlit (clair ou sombre).  
Pour changer de thème : menu `⋮` en haut à droite → `Settings` → `Theme`.

Le CSS de l'application utilise des variables relatives au thème actif pour assurer la lisibilité dans les deux modes.

---

## 8. Raccourcis clavier

| Touche | Action                        |
|--------|-------------------------------|
| `C`    | Aller au Cahier des Charges   |
| `R`    | Aller au Registre des Risques |
| `T`    | Aller au Suivi des Tâches     |
| `P`    | Aller au Planning             |
| `E`    | Aller à la page Équipe        |

> Ces raccourcis fonctionnent lorsque le focus n'est pas dans un champ de saisie.
