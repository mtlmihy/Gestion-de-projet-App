"""
Requêtes PostgreSQL pour les risques.
Remplace save_risques() et load_risques() de db.py (Streamlit).
"""
from __future__ import annotations

import uuid

from asyncpg import Connection


async def get_all(conn: Connection) -> list[dict]:
    rows = await conn.fetch("SELECT * FROM risques ORDER BY identifiant")
    return [dict(r) for r in rows]


async def create(conn: Connection, data: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO risques
            (id, identifiant, description, categorie,
             probabilite, impact, priorite, responsable, attenuation, statut)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
        """,
        str(uuid.uuid4()),
        data["identifiant"],
        data.get("description", ""),
        data.get("categorie", ""),
        data.get("probabilite", "Faible"),
        data.get("impact", "Faible"),
        data.get("priorite", 1),
        data.get("responsable", ""),
        data.get("attenuation", ""),
        data.get("statut", "Ouvert"),
    )
    return dict(row)


async def update(conn: Connection, risque_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE risques
        SET identifiant=$2, description=$3, categorie=$4,
            probabilite=$5, impact=$6, priorite=$7,
            responsable=$8, attenuation=$9, statut=$10,
            updated_at=NOW()
        WHERE id=$1
        RETURNING *
        """,
        risque_id,
        data["identifiant"],
        data.get("description", ""),
        data.get("categorie", ""),
        data.get("probabilite", "Faible"),
        data.get("impact", "Faible"),
        data.get("priorite", 1),
        data.get("responsable", ""),
        data.get("attenuation", ""),
        data.get("statut", "Ouvert"),
    )
    return dict(row) if row else None


async def delete(conn: Connection, risque_id: str) -> bool:
    """DELETE FROM risques WHERE id = $1."""
    result = await conn.execute("DELETE FROM risques WHERE id=$1", risque_id)
    return result == "DELETE 1"
