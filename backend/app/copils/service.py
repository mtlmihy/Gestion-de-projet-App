from __future__ import annotations

from asyncpg import Connection


def _row(r) -> dict:
    d = dict(r)
    d["id"] = str(d["id"])
    d["projet_id"] = str(d["projet_id"])
    if d.get("createur_id") is not None:
        d["createur_id"] = str(d["createur_id"])
    return d


async def get_all(conn: Connection, projet_id: str) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT id, projet_id, date_reunion, titre, participants, notes,
             heure_reunion, decisions, actions, createur_id, date_creation, derniere_maj
        FROM copil_reunions
        WHERE projet_id = $1::uuid
        ORDER BY date_reunion DESC, date_creation DESC
        """,
        projet_id,
    )
    return [_row(r) for r in rows]


async def create(conn: Connection, projet_id: str, data: dict, user_id: str | None) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO copil_reunions
            (projet_id, date_reunion, heure_reunion, titre, participants, notes, decisions, actions, createur_id)
        VALUES
            ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid)
        RETURNING id, projet_id, date_reunion, heure_reunion, titre, participants, notes,
                  decisions, actions, createur_id, date_creation, derniere_maj
        """,
        projet_id,
        data.get("date_reunion"),
        data.get("heure_reunion"),
        data.get("titre"),
        data.get("participants"),
        data.get("notes"),
        data.get("decisions"),
        data.get("actions"),
        user_id,
    )
    return _row(row)


async def update(conn: Connection, copil_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE copil_reunions
        SET date_reunion = $2,
            heure_reunion= $3,
            titre        = $4,
            participants = $5,
            notes        = $6,
            decisions    = $7,
            actions      = $8,
            derniere_maj = NOW()
        WHERE id = $1::uuid
        RETURNING id, projet_id, date_reunion, heure_reunion, titre, participants, notes,
                  decisions, actions, createur_id, date_creation, derniere_maj
        """,
        copil_id,
        data.get("date_reunion"),
        data.get("heure_reunion"),
        data.get("titre"),
        data.get("participants"),
        data.get("notes"),
        data.get("decisions"),
        data.get("actions"),
    )
    return _row(row) if row else None


async def delete(conn: Connection, copil_id: str) -> bool:
    result = await conn.execute(
        "DELETE FROM copil_reunions WHERE id = $1::uuid",
        copil_id,
    )
    return result == "DELETE 1"
