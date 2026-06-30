# Document de passation - QimProject

Dernière mise à jour : 2026-06-30. Aucune valeur sensible (clé, mot de passe,
URL privée, token) ne doit jamais être ajoutée à ce fichier - il est versionné
dans git.

## 1. C'est quoi, ce projet ?

QimProject est une application de gestion de projet (cadrage CDC, planning,
tâches, registre des risques, RACI, équipe, COPIL, budget, administration des
utilisateurs). Description fonctionnelle complète : [doc-func.md](doc-func.md).

## 2. Stack et architecture

| Couche | Techno |
| --- | --- |
| Frontend | React 19 + Vite, hébergé sur Vercel |
| Backend | FastAPI (Python 3.12) + asyncpg, hébergé sur Render |
| Base de données | PostgreSQL, hébergée sur Supabase |

Détail complet (schéma, middlewares, modèle de données, sécurité) :
[doc-archi.md](doc-archi.md).

## 3. Démarrer en local

Prérequis : Python 3.12+, Node 18+, une base PostgreSQL accessible (locale ou
distante).

```powershell
# Option rapide : lance backend + frontend en parallèle
.\start.ps1
```

Ou manuellement :

```bash
# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt -r requirements-dev.txt
# Copier backend/.env.example en backend/.env et renseigner les valeurs
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Les variables d'environnement nécessaires sont documentées (avec des
placeholders, pas de vraies valeurs) dans `backend/.env.example` et
`frontend/.env.production.example`. Les vraies valeurs (DB, clé JWT, etc.)
sont à récupérer auprès de la personne qui gère les accès Render / Supabase /
Vercel - elles ne sont stockées nulle part dans le dépôt.

## 4. Où trouver quoi

```
docs/
  doc-archi.md        # architecture technique détaillée
  doc-func.md          # fonctionnalités, rôles, parcours utilisateur
  tests.md              # comment lancer les tests
  reste-a-faire.md      # backlog technique issu de l'audit (voir §6)
  passation.md           # ce fichier

backend/app/
  <module>/router.py    # endpoints FastAPI par domaine métier
  <module>/service.py    # accès DB (SQL brut via asyncpg, pas d'ORM)
  <module>/schemas.py    # validation Pydantic
  projets/permissions.py # vérifications de rôle projet partagées
                           # (check_membre / check_editeur) - à réutiliser
                           # pour tout nouveau module métier

frontend/src/
  pages/                 # une page = un module métier
  components/            # composants réutilisables
  components/admin/, components/planning/, components/projects/
                           # sous-composants des pages les plus grosses
  hooks/useCrudResource.js # hook commun fetch/save/notify pour les pages CRUD
  context/                # AuthContext, ProjectContext, ThemeContext
```

## 5. État actuel (au 2026-06-30)

- **CI** : GitHub Actions (`.github/workflows/ci.yml`) lance pytest (backend)
  et jest + build (frontend) sur chaque push/PR vers `main`. Le fichier
  `Layout.test.jsx` est volontairement exclu (voir §6).
- **Sécurité** : un audit a révélé puis corrigé une faille IDOR sur
  RACI/CDC/COPIL/équipe (accès inter-projets non vérifié). Les vérifications
  de rôle sont maintenant centralisées dans `app/projets/permissions.py`.
- **Tests** : couverture encore partielle. Voir `docs/tests.md` et le détail
  des manques dans `docs/reste-a-faire.md`.
- **Conventions établies à respecter pour tout nouveau code** :
  - Backend : tout nouvel endpoint qui dépend d'un `projet_id` doit appeler
    `perms.check_membre(...)` (lecture) ou `perms.check_editeur(...)`
    (écriture) depuis `app/projets/permissions.py` - ne pas réimplémenter la
    vérification localement.
  - Frontend : pour une nouvelle page de type liste CRUD (charger une liste +
    créer/modifier/supprimer avec notification), réutiliser
    `hooks/useCrudResource.js` et `components/Notification.jsx` plutôt que de
    dupliquer le pattern.

## 6. Points de vigilance avant de continuer

Le détail complet (avec fichiers et lignes précises) est dans
[reste-a-faire.md](reste-a-faire.md). En résumé, par priorité :

1. Migrations DB : pas de table de version, application manuelle - risque
   d'oubli en prod. `doc-archi.md` est même légèrement désynchronisé (ne
   référence pas les migrations 020/021 déjà présentes dans le dépôt).
2. Pas de transaction DB sur les opérations multi-requêtes (ex: création de
   projet).
3. Pas d'annulation des requêtes en cours côté frontend lors d'un changement
   rapide de projet (risque d'affichage incohérent).
4. Couverture de tests encore faible sur le cœur métier (permissions, CRUD
   risques/tâches/équipe).
5. `Layout.test.jsx` (13 tests de gestes tactiles/molette) exclu de la CI,
   échecs réels non encore investigués.

## 7. Déploiement

- **Frontend (Vercel)** : déploiement automatique sur push vers `main`
  (configuré côté dashboard Vercel). Variables d'env à définir dans le
  dashboard Vercel, voir `frontend/.env.production.example` pour la liste.
- **Backend (Render)** : voir `backend/render.yaml` pour la configuration
  (build/start command, health check). Les secrets (`DATABASE_URL`,
  `SECRET_KEY`, `CORS_ORIGINS`) sont saisis manuellement dans le dashboard
  Render, jamais dans le dépôt.
- **Base de données (Supabase)** : accès via le dashboard Supabase. Les
  migrations dans `backend/app/db/migrations/` doivent être appliquées dans
  l'ordre numérique (voir §6, point 1 - c'est manuel pour l'instant).

Pour les identifiants d'accès à ces trois dashboards, se rapprocher de la
personne qui les détient actuellement - ils ne sont pas dans ce dépôt.
