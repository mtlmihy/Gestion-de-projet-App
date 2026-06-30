# Reste à faire — suite de l'audit QimProject

État au 2026-06-30. Ce document liste ce qui n'a **pas** encore été traité après
les sessions d'audit (faille IDOR, CI, risques moyens/faibles). À reprendre dans
cet ordre de priorité indicatif.

## 1. Mis en stand-by volontairement : tracking des migrations DB

- Pas de table de version (`alembic_version` ou équivalent) — les migrations
  `backend/app/db/migrations/*.sql` sont appliquées à la main, sans garantie
  qu'elles l'ont toutes été en prod.
- `docs/doc-archi.md` référence les migrations jusqu'à `019` seulement, alors
  que `020_budget_assigne.sql` et `021_tache_charge.sql` existent déjà → à
  corriger dans tous les cas, même avant de traiter le fond du sujet.
- Décision à prendre : adopter Alembic, ou a minima une table
  `schema_migrations` + script d'application séquentielle.

## 2. Risques "Élevé" reportés (hors scope des sessions précédentes)

- **Transactions DB manquantes** : aucune opération multi-requêtes n'est
  englobée dans `async with conn.transaction()`. Cas concret :
  `backend/app/projets/service.py` (`create`) insère le projet puis son
  membre Propriétaire en deux requêtes séparées — un échec entre les deux
  laisse un projet orphelin sans propriétaire.
- **Race conditions frontend** : pas d'`AbortController` dans les `useEffect`
  de chargement (RisquesPage, TachesPage, CopilPage, RaciPage, CdcPage,
  PlanningPage). Changer rapidement de projet peut afficher les données du
  mauvais projet le temps que les requêtes se résolvent.
- **Couverture de tests quasi nulle** sur le cœur métier : aucun test sur
  l'auth, les permissions, ni le CRUD risques/tâches/équipe/admin/projets —
  exactement la zone où s'était glissée la faille IDOR. Pages sans aucun
  test : `RisquesPage`, `TachesPage`, `EquipePage`, `RaciPage`, `BudgetPage`,
  `AdminPage`, `ProjectsPage`, `AuthContext`, `ProjectContext`, le routeur
  `PageGuard` dans `App.jsx`.

## 3. Risques "Moyen" restants

- **CSRF fallback cross-domain affaibli** (`backend/app/auth/csrf.py:72`,
  commentaire "Mode 2") : une requête mutable sans header `X-CSRF-Token` est
  acceptée si `Origin` est dans `CORS_ORIGINS` + header
  `X-Requested-With: XMLHttpRequest`. Pas un bug en soi, mais ça veut dire que
  si `CORS_ORIGINS` est un jour mal configuré en prod, c'est la seule ligne de
  défense restante. À documenter clairement, ou durcir si possible.
- **Duplication du composant `Notification` restante** dans `CdcPage.jsx` et
  `RaciPage.jsx` (non migrées vers `components/Notification.jsx` +
  `hooks/useCrudResource.js`, contrairement à Risques/Taches/Equipe/Copil).
  Ces deux pages ont un pattern de chargement différent (CdcPage = document
  unique, RaciPage = matrice) donc l'application du hook demande un peu plus
  de réflexion que les autres.

## 4. Risques "Faible" restants

- **Pool DB modeste** (`backend/app/db/pool.py:22-24` : `min_size=2,
  max_size=10, command_timeout=30`) — à surveiller en prod si la charge
  augmente, pas bloquant pour un usage actuel.
- **Pas de focus trap dans les modals** (`components/Modal.jsx`,
  `components/admin/AdminModal.jsx`) — gênant en navigation clavier, pas
  traité pendant le passage accessibilité (on a fait les `htmlFor`/`id`
  uniquement).
- **`Layout.test.jsx` exclu de la CI** (`.github/workflows/ci.yml`, voir le
  commentaire dans le step frontend) : 13 tests de gestes tactiles/molette
  avec timers échouent réellement et nécessitent une vraie investigation
  (logique métier à vérifier, pas juste un souci d'environnement comme pour
  les 3 bugs d'infra déjà corrigés). Pas de garantie que `Layout.jsx`
  fonctionne comme attendu tant que ce n'est pas fait.
- **12 tests backend `skip`** dans `backend/tests/test_copils.py` (fixture
  `test_db`) : nécessitent une vraie base PostgreSQL de test pour être
  réactivés (actuellement impossible avec asyncpg + DSN sqlite).

## 5. Bons points déjà acquis (pour mémoire, rien à faire)

- CSRF double-submit cookie : bien implémenté.
- `.env` backend correctement exclu du suivi git.
- Permissions projet désormais cohérentes sur tous les modules (RACI, CDC,
  COPIL, équipe, liens, risques, tâches, budget) via
  `backend/app/projets/permissions.py`.
- CI GitHub Actions opérationnelle (pytest + jest + build) sur push/PR vers
  `main`.
