from __future__ import annotations
import uuid
from asyncpg import Connection


def _row(r) -> dict:
    d = dict(r)
    d["id"]         = str(d["id"])
    d["projet_id"]  = str(d["projet_id"])
    return d


async def get_all(conn: Connection, projet_id: str) -> list[dict]:
    rows = await conn.fetch(
        "SELECT * FROM risques WHERE projet_id=$1::uuid ORDER BY nom",
        projet_id,
    )
    return [_row(r) for r in rows]


async def create(conn: Connection, projet_id: str, data: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO risques
            (id, projet_id, nom, description, categorie,
             probabilite, impact, priorite, responsable, attenuation, statut)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        """,
        str(uuid.uuid4()),
        projet_id,
        data["nom"],
        data.get("description", ""),
        data.get("categorie", ""),
        data.get("probabilite", "Faible"),
        data.get("impact", "Faible"),
        data.get("priorite", 3),
        data.get("responsable", ""),
        data.get("attenuation", ""),
        data.get("statut", "Ouvert"),
    )
    return _row(row)


async def update(conn: Connection, risque_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE risques
        SET nom=$2, description=$3, categorie=$4,
            probabilite=$5, impact=$6, priorite=$7,
            responsable=$8, attenuation=$9, statut=$10
        WHERE id=$1::uuid
        RETURNING *
        """,
        risque_id,
        data["nom"],
        data.get("description", ""),
        data.get("categorie", ""),
        data.get("probabilite", "Faible"),
        data.get("impact", "Faible"),
        data.get("priorite", 3),
        data.get("responsable", ""),
        data.get("attenuation", ""),
        data.get("statut", "Ouvert"),
    )
    return _row(row) if row else None


async def delete(conn: Connection, risque_id: str) -> bool:
    result = await conn.execute("DELETE FROM risques WHERE id=$1::uuid", risque_id)
    return result == "DELETE 1"


