from __future__ import annotations

import asyncpg
from asyncpg import Pool

from app.config import settings

_pool: Pool | None = None


async def init_pool() -> None:
    """
    Crée le pool de connexions asyncpg au démarrage du serveur FastAPI.
    Appelé une seule fois via le lifespan de main.py.

    min_size=2  → 2 connexions toujours ouvertes (prêtes à l'emploi)
    max_size=10 → montée en charge jusqu'à 10 connexions simultanées
    """
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
        ssl="require" if settings.db_ssl else None,
    )


async def close_pool() -> None:
    """
    Ferme proprement toutes les connexions du pool à l'arrêt du serveur.
    Appelé via le lifespan de main.py (après le yield).
    """
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> Pool:
    """
    Dépendance FastAPI — injecte le pool dans les fonctions de service.

    Usage dans un router :
        pool = Depends(get_pool)  # dans la signature de route
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT ...")
    """
    if _pool is None:
        raise RuntimeError("Le pool de connexions n'est pas initialisé.")
    return _pool
