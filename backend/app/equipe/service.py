from __future__ import annotations
import uuid
from asyncpg import Connection


def _row(r) -> dict:
    d = dict(r)
    d["id"]        = str(d["id"])
    d["projet_id"] = str(d["projet_id"])
    return d


async def get_all(conn: Connection, projet_id: str) -> list[dict]:
    rows = await conn.fetch(
        "SELECT * FROM equipe WHERE projet_id=$1::uuid ORDER BY collaborateur",
        projet_id,
    )
    return [_row(r) for r in rows]


async def create(conn: Connection, projet_id: str, data: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO equipe (id, projet_id, collaborateur, poste, manager, numero, email)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7)
        RETURNING *
        """,
        str(uuid.uuid4()),
        projet_id,
        data["collaborateur"],
        data.get("poste", ""),
        data.get("manager", ""),
        data.get("numero", ""),
        data.get("email", ""),
    )
    return _row(row)


async def update(conn: Connection, membre_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE equipe
        SET collaborateur=$2, poste=$3, manager=$4, numero=$5, email=$6
        WHERE id=$1::uuid
        RETURNING *
        """,
        membre_id,
        data["collaborateur"],
        data.get("poste", ""),
        data.get("manager", ""),
        data.get("numero", ""),
        data.get("email", ""),
    )
    return _row(row) if row else None


async def delete(conn: Connection, membre_id: str) -> bool:
    result = await conn.execute("DELETE FROM equipe WHERE id=$1::uuid", membre_id)
    return result == "DELETE 1"
