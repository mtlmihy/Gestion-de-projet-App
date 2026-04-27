from __future__ import annotations
from asyncpg import Connection
import uuid


def _row(r) -> dict:
    d = dict(r)
    d["id"]        = str(d["id"])
    d["projet_id"] = str(d["projet_id"])
    return d


async def get(conn: Connection, projet_id: str) -> dict | None:
    row = await conn.fetchrow(
        "SELECT id, projet_id, contenu, derniere_maj FROM cdc WHERE projet_id=$1::uuid",
        projet_id,
    )
    return _row(row) if row else None


async def upsert(conn: Connection, projet_id: str, contenu: str) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO cdc (id, projet_id, contenu, derniere_maj)
        VALUES ($1::uuid, $2::uuid, $3, NOW())
        ON CONFLICT (projet_id) DO UPDATE
            SET contenu = $3, derniere_maj = NOW()
        RETURNING id, projet_id, contenu, derniere_maj
        """,
        str(uuid.uuid4()),
        projet_id,
        contenu,
    )
    return _row(row)
