"""Requêtes PostgreSQL pour les tâches."""
from __future__ import annotations

import uuid

from asyncpg import Connection


async def get_all(conn: Connection) -> list[dict]:
    rows = await conn.fetch("SELECT * FROM taches ORDER BY nom")
    return [dict(r) for r in rows]


async def create(conn: Connection, data: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO taches
            (id, nom, description, importance, avancement, assigne, jalon)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        """,
        str(uuid.uuid4()),
        data["nom"],
        data.get("description", ""),
        data.get("importance", "Moyenne"),
        data.get("avancement", 0),
        data["assigne"],
        data.get("jalon", ""),
    )
    return dict(row)


async def update(conn: Connection, tache_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE taches
        SET nom=$2, description=$3, importance=$4,
            avancement=$5, assigne=$6, jalon=$7, updated_at=NOW()
        WHERE id=$1
        RETURNING *
        """,
        tache_id,
        data["nom"],
        data.get("description", ""),
        data.get("importance", "Moyenne"),
        data.get("avancement", 0),
        data["assigne"],
        data.get("jalon", ""),
    )
    return dict(row) if row else None


async def delete(conn: Connection, tache_id: str) -> bool:
    result = await conn.execute("DELETE FROM taches WHERE id=$1", tache_id)
    return result == "DELETE 1"
