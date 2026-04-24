"""Requêtes PostgreSQL pour l'équipe."""
from __future__ import annotations

import uuid

from asyncpg import Connection


async def get_all(conn: Connection) -> list[dict]:
    rows = await conn.fetch("SELECT * FROM equipe ORDER BY collaborateur")
    return [dict(r) for r in rows]


async def replace_all(conn: Connection, membres: list[dict]) -> list[dict]:
    """
    Remplace toute la table equipe en une transaction atomique.
    Utilisé lors de la sauvegarde du tableau de complétion (opération batch).
    """
    result = []
    async with conn.transaction():
        await conn.execute("DELETE FROM equipe")
        for m in membres:
            row = await conn.fetchrow(
                """
                INSERT INTO equipe (id, collaborateur, poste, manager, numero, email)
                VALUES ($1,$2,$3,$4,$5,$6)
                RETURNING *
                """,
                str(uuid.uuid4()),
                m["collaborateur"],
                m.get("poste", ""),
                m.get("manager", ""),
                m.get("numero", ""),
                m.get("email", ""),
            )
            result.append(dict(row))
    return result
