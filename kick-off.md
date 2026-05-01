Voici une version retravaillée et alignée sur l'existant réel de l'application (constaté dans le code et la note de suivi) :

---

# Kick-off Projet — Application de Gestion de Projet

## Ordre du jour
Cadrer le projet de façon claire et précise pour la suite.

## Vision
Une application web de pilotage de projets, accessible par navigateur, **multi-utilisateurs** et **multi-projets**, qui centralise la documentation de gouvernance (CDC, charte, risques, équipe, planning) là où Jira reste centré tickets et Miro sur le visuel.

## Stack & déploiement actuels
- **Frontend** : React + Vite, déployé sur **Vercel**
- **Backend** : FastAPI (Python), déployé sur **Render**
- **Base de données** : PostgreSQL hébergée sur **Supabase**
- **Auth** : comptes utilisateurs avec mots de passe chiffrés + rôles (admin / utilisateur)

## Retours positifs du POC
- Planning lié aux jalons du CDC (vraie valeur ajoutée vs Jira)
- Centralisation CDC + risques + équipe + tâches dans un seul outil
- Organigramme équipe (utile passation / contact client)

## Axes d'amélioration identifiés
- Revoir **UX/UI** (placement boutons, tri colonnes, pagination tableaux)
- Centraliser le **RACI** (livrables × membres équipe)
- **Plan de communication** (qui / quoi / quand / fréquence)
- Intégrer les modèles **Thalïa** (Plan projet, Charte projet) dans la génération PDF || Fait avec les liens externes
- Permettre à l'utilisateur de **changer son mot de passe** lui-même
- Afficher la **dernière date de modification du CDC** (et idéalement journal d'audit)
- Réactiver les **raccourcis clavier** (c / r / t / p / e)
- Revoir le **format des exports PDF** (CDC + charte) pour une vue plus propre || Fait

## Où on en est (déjà livré ✓)
- Authentification + chiffrement des mots de passe
- Gestion **multi-projets** (création, sélection, clôture, réactivation, projets favoris épinglés)
- **Registre des risques** (CRUD + criticité)
- **Tâches** liées aux jalons du CDC
- **Cahier des charges** structuré, lié au planning
- **Planning** auto-généré depuis les jalons du CDC
- **Équipe projet** + **organigramme** dynamique
- **Liens projet** (Jira, Miro, Teams, …) — solution retenue plutôt que réimplémenter
- Génération **PDF** : Charte projet + CDC
- Page **Admin** (gestion utilisateurs, rôles, pages autorisées)
- Thèmes clair / sombre (incluant l'organigramme)
- Import / export des données + reprise des anciens CSV
- Déploiement prod opérationnel (Vercel + Render + Supabase)

## Périmètre V1
Fournir une application **stable et intuitive** à mettre en test auprès des CDP pour obtenir des retours réels.
Objectifs :
- Faire **gagner du temps** aux CDP (centralisation, moins d'allers-retours entre outils)
- Pouvoir **partager au client** un accès en lecture (suivi planning, avancement jalons, contact équipe)
- Servir de base de **passation** propre entre CDP

## Rôles et responsabilités
- **PO / CDP** : *(à définir)* — priorisation backlog, validation fonctionnelle, retours terrain
- **Exécutant** : Mathys LEONI — développement, déploiement, maintenance

## Gestion des tâches
Directement dans l'application (dogfooding — on utilise l'app pour piloter l'app).

## Workflow de validation
Création → Tests de conformité → Validation PO/CDP → Mise en prod (Vercel / Render auto sur `main`).

## Communication
Point hebdomadaire (vendredi ?).

## Hors périmètre V1 (déjà couvert ailleurs)
Dépendances de tâches, Gantt détaillé, burndown, whiteboard → restent dans **Jira** / **Miro**.

## Roadmap proposée (post-V1)
- **Phase 2** : RACI · CR de COPIL · plan de communication · templates de projet · notifications email (jalon < 30j, risque critique)
- **Phase 3** : journal d'audit · budget structuré · QimTime (heures réelles) · export `.ics` jalons · SSO Microsoft

## Les 3 prochaines étapes en sortant
1. *(à compléter en réunion)*
2. *(à compléter en réunion)*
3. *(à compléter en réunion)*

## Tour de table
Validation que tout le monde est aligné sur la vision V1 et les priorités.

---

Veux-tu que je l'enregistre dans un fichier (`docs/kickoff.md` par ex.) ou que je l'ajoute en bas de `help suivi.txt` ?