# Documentation — Application de Gestion de Projet

> Application web développée avec **Streamlit** (Python).  
> Lancement : `python -m streamlit run app.py`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Installation et lancement](#2-installation-et-lancement)
3. [Architecture des fichiers](#3-architecture-des-fichiers)
4. [Authentification](#4-authentification)
5. [Navigation](#5-navigation)
6. [Pages de l'application](#6-pages-de-lapplication)
    - [Registre des Risques](#61-registre-des-risques)
    - [Suivi des Tâches](#62-suivi-des-tâches)
    - [Planning](#63-planning)
    - [Cahier des Charges](#64-cahier-des-charges)
    - [Équipe](#65-équipe)
    - [Aide Pilotage](#66-aide-pilotage)
7. [Sauvegarde et restauration des données](#7-sauvegarde-et-restauration-des-données)
8. [Thèmes clair / sombre](#8-thèmes-clair--sombre)
9. [Raccourcis clavier](#9-raccourcis-clavier)

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
| Aide Pilotage         | Documents de référence téléchargeables + ressources en ligne     |

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
│   ├── cahier_des_charges.json     # Sauvegarde du Cahier des Charges
│   └── cdc_sync_token.txt          # Jeton de synchronisation du CDC (usage interne)
└── assets/                         # Fichiers statiques (templates, documents)
    ├── cahier_des_charges.html     # Interface HTML du Cahier des Charges
    ├── Guide-CDP.pdf               # Document Guide CDP (téléchargement)
    └── Cahier-des-charges.docx     # Document CDC Word (téléchargement)
```

> **Note :** Le dossier `data/` est créé automatiquement au premier lancement si absent. Les fichiers CSV et JSON sont générés avec des données d'exemple à la première utilisation.

---

## 4. Authentification

L'application est **protégée par un mot de passe** configuré via les secrets Streamlit.

### Configuration

Dans le fichier `.streamlit/secrets.toml` (à créer à la racine du projet) :

```toml
PASSWORD_HASH = "<sha256_du_mot_de_passe>"
```

Le hash SHA-256 se génère avec Python :

```python
import hashlib
hashlib.sha256("mon_mot_de_passe".encode()).hexdigest()
```

### Comportement

- À l'ouverture, si l'utilisateur n'est pas authentifié, la barre latérale est masquée et un formulaire de connexion s'affiche.
- Après connexion réussie, le hash est stocké dans le paramètre URL `?auth=...` pour **persister la session** à travers les navigations sans rechargement complet.
- Un mot de passe incorrect affiche un message d'erreur.

---

## 5. Navigation

La navigation se fait via une **barre d'onglets dans le header** de l'application (en haut à gauche). Chaque page est accessible en un clic.

Les onglets disponibles sont (dans l'ordre affiché) :

1. Cahier des Charges
2. Risques
3. Tâches
4. Planning
5. Équipe
6. Aide Pilotage

La page active est mise en évidence visuellement (couleur bleue). La navigation fonctionne par **paramètres URL** (`?page=...`), ce qui permet de partager ou mémoriser un lien direct vers une page.

> **Astuce :** Utiliser les [raccourcis clavier](#9-raccourcis-clavier) pour naviguer sans la souris.

---

## 6. Pages de l'application

### 6.1 Registre des Risques

**Objectif :** Identifier, évaluer et suivre les risques du projet.

#### Indicateurs clés (KPIs)

En haut de page, 5 métriques sont affichées en temps réel :

| Métrique        | Description                        |
|-----------------|------------------------------------|
| Total           | Nombre total de risques            |
| Ouverts         | Risques au statut "Ouvert"         |
| En cours        | Risques au statut "En cours"       |
| Fermés          | Risques au statut "Fermé"          |
| Critiques (P3)  | Risques de priorité 3              |

#### Fonctionnalités

- **Tableau des risques** — liste tous les risques avec : Identifiant, Catégorie, Probabilité, Impact, Priorité, Responsable, Atténuation, Statut.
- **Ajout d'un risque** — via le bouton flottant `+` en bas à droite ou le panneau `Nouveau risque`. Champs obligatoires : Identifiant, Responsable.
- **Modification d'un risque** — cliquer sur l'icône ✏️ en bout de ligne pour ouvrir le formulaire d'édition.
- **Suppression d'un risque** — bouton `Supprimer` dans le formulaire d'édition (sans confirmation supplémentaire).
- **Filtres** — panneau dépliable avec filtrage par Probabilité, Impact, Statut, Priorité et recherche textuelle sur l'Identifiant.
- **Responsable existant** — dans les formulaires d'ajout et d'édition, un menu déroulant propose les responsables déjà présents dans le registre pour éviter les doublons de saisie.

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

### 6.2 Suivi des Tâches

**Objectif :** Gérer les tâches du projet, les associer à des jalons et suivre leur avancement.

#### Indicateurs clés (KPIs)

| Métrique          | Description                              |
|-------------------|------------------------------------------|
| Total tâches      | Nombre total de tâches                   |
| Avancement moyen  | Moyenne des avancements (%)              |
| Terminées         | Nombre de tâches à 100 %                 |

#### Fonctionnalités

- **Tableau des tâches** — liste toutes les tâches avec : Nom, Description, Importance, Jalon, Avancement, Assigné.
- **Ajout d'une tâche** — bouton flottant `+` ou panneau `Nouvelle tâche`. Champs obligatoires : Nom, Assigné à.
- **Modification d'une tâche** — cliquer sur l'icône ✏️ en bout de ligne pour ouvrir le formulaire d'édition.
- **Suppression d'une tâche** — bouton `Supprimer` dans le formulaire d'édition.
- **Barre de progression** — affichage visuel de l'avancement (0–100 %).
- **Filtres** — panneau dépliable : recherche par nom, filtre par Importance, filtre par Assigné.
- **Lien avec le Planning** — le champ `Jalon` rattache une tâche à un jalon défini dans le Cahier des Charges. Cela alimente les données affichées dans la page Planning.

#### Niveaux d'importance

| Niveau   | Signification                       |
|----------|-------------------------------------|
| Faible   | Peut être reportée                  |
| Moyenne  | À traiter dans le sprint courant    |
| Élevée   | Prioritaire                         |
| Critique | Bloquante — à traiter immédiatement |

---

### 6.3 Planning

**Objectif :** Visualiser l'avancement du projet sous forme de diagramme de Gantt, basé sur les jalons et les tâches.

#### Fonctionnement

- Le planning se **génère automatiquement** depuis :
  - Les **jalons** définis dans le Cahier des Charges (nom, date, description).
  - Les **tâches** du Suivi des Tâches et leur avancement.
- Aucune saisie n'est nécessaire sur cette page — elle est entièrement calculée.

#### Ce qui est affiché

1. **En-tête** : nom du projet, chef de projet, nombre de jalons, durée totale.
2. **Barre de progression globale** : avancement temporel du projet (de la date de début à la fin du dernier jalon), avec marqueur "Aujourd'hui".
3. **Timeline SVG** : frise chronologique avec un losange par jalon, les jalons pairs au-dessus de la barre et impairs en-dessous, repères mensuels et ligne "Auj.".
4. **Cartes jalons** : une carte par jalon indiquant :
   - Statut coloré (Non démarré, Démarré, En cours, Terminé / Passé, Prochain, À venir)
   - Date et délai restant
   - Barre de progression des tâches associées
   - Liste des tâches avec leur avancement individuel

#### Couleurs de statut

| Couleur | Signification (basée sur tâches)   | Signification (basée sur date) |
|---------|------------------------------------|-------------------------------|
| 🟢 Vert  | Terminé (100 %)                    | —                             |
| 🔵 Bleu  | En cours (≥ 50 %)                  | À venir (> 30 j.)             |
| 🟠 Orange| Démarré (> 0 %)                    | Prochain (≤ 30 j.)            |
| 🔴 Rouge | Non démarré (0 %)                  | —                             |
| ⚫ Gris  | —                                   | Passé (date dépassée)         |

> **Prérequis :** Renseigner les jalons dans le Cahier des Charges pour que le planning s'affiche.

---

### 6.4 Cahier des Charges

**Objectif :** Rédiger, sauvegarder et exporter le Cahier des Charges du projet.

#### Fonctionnement

Le CDC est une **interface HTML interactive** chargée dans l'application. Elle permet de saisir :

- Informations générales : nom du projet, chef de projet, date de début, description.
- Objectifs, périmètre, contraintes.
- Jalons (nom + date + description) — utilisés par le Planning.
- Parties prenantes.
- Exigences fonctionnelles et techniques.

#### Sauvegarde et synchronisation

- Les données sont **sauvegardées dans `cahier_des_charges.json`** via un serveur HTTP local démarré automatiquement par l'application.
- Le panneau `Synchronisation sauvegarde CDC` permet de :
  - **Importer** un fichier JSON pour restaurer un CDC précédent.
  - **Exporter** le JSON actuel pour le sauvegarder ou le partager.

> **Important :** Les modifications dans le CDC sont sauvegardées dans le JSON via l'interface HTML. Rechargez la page après un import JSON pour appliquer les nouvelles données.

---

### 6.5 Équipe

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

### 6.6 Aide Pilotage

**Objectif :** Mettre à disposition des ressources documentaires pour soutenir la gestion de projet.

#### Documents téléchargeables

| Document           | Format | Description                       |
|--------------------|--------|-----------------------------------|
| Guide CDP          | PDF    | Guide complet du chef de projet   |
| Cahier des Charges | DOCX   | Modèle Word du Cahier des Charges |

> Les fichiers doivent être présents dans le répertoire `assets/` (`Guide-CDP.pdf`, `Cahier-des-charges.docx`). Un message d'erreur s'affiche si un fichier est absent.

#### Ressources en ligne

- [Registre des risques : guide complet (Asana)](https://asana.com/fr/resources/risk-register)

---

## 7. Sauvegarde et restauration des données

Toutes les données sont sauvegardées **localement** dans des fichiers dans le répertoire `data/`.

| Module             | Fichier                   | Format          | Sauvegarde                        |
|--------------------|---------------------------|-----------------|-----------------------------------|
| Risques            | `registre_risques.csv`    | CSV (UTF-8 BOM) | Automatique à chaque modification |
| Tâches             | `suivi_taches.csv`        | CSV (UTF-8 BOM) | Automatique à chaque modification |
| Équipe             | `equipe_completions.csv`  | CSV (UTF-8 BOM) | Manuelle (bouton "Sauvegarder")   |
| Cahier des Charges | `cahier_des_charges.json` | JSON            | Via l'interface HTML du CDC       |

> **Migration automatique :** Si un CSV existant ne contient pas toutes les colonnes attendues, l'application ajoute les colonnes manquantes avec des valeurs vides au chargement. Les données existantes ne sont pas perdues.

### Sauvegarde ZIP globale

La **barre latérale** propose deux actions de sauvegarde complète :

- **Télécharger la sauvegarde** — génère un fichier `sauvegarde_projet_AAAA-MM-JJ.zip` contenant les 4 fichiers de données (CSV + JSON). Le nom inclut la date du jour.
- **Restaurer depuis ZIP** — permet d'importer un fichier `.zip` précédemment téléchargé pour restaurer tout ou partie des données. Les fichiers reconnus dans le ZIP sont appliqués immédiatement et les données en session sont mises à jour.

---

## 8. Thèmes clair / sombre

L'application respecte le thème configuré dans Streamlit (clair ou sombre).  
Pour changer de thème : menu `⋮` en haut à droite → `Settings` → `Theme`.

Le CSS de l'application utilise des variables relatives au thème actif pour assurer la lisibilité dans les deux modes.

---

## 9. Raccourcis clavier

| Touche | Action                        |
|--------|-------------------------------|
| `c`    | Aller au Cahier des Charges   |
| `r`    | Aller au Registre des Risques |
| `t`    | Aller au Suivi des Tâches     |
| `p`    | Aller au Planning             |
| `e`    | Aller à la page Équipe        |

> Ces raccourcis fonctionnent lorsque le focus n'est pas dans un champ de saisie (et sans modificateur Ctrl / Alt / Cmd).
