from __future__ import annotations
import uuid
from asyncpg import Connection


async def get_all(conn: Connection) -> list[dict]:
    rows = await conn.fetch("SELECT id::text, nom, description, statut::text FROM projets ORDER BY date_creation")
    return [dict(r) for r in rows]


async def get_by_id(conn: Connection, projet_id: str) -> dict | None:
    row = await conn.fetchrow(
        "SELECT id::text, nom, description, statut::text FROM projets WHERE id=$1::uuid",
        projet_id,
    )
    return dict(row) if row else None


async def create(conn: Connection, data: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO projets (id, nom, description, statut)
        VALUES ($1::uuid, $2, $3, $4::projet_statut)
        RETURNING id::text, nom, description, statut::text
        """,
        str(uuid.uuid4()),
        data["nom"],
        data.get("description", ""),
        data.get("statut", "Brouillon"),
    )
    return dict(row)


async def update(conn: Connection, projet_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE projets
        SET nom=$2, description=$3, statut=$4::projet_statut
        WHERE id=$1::uuid
        RETURNING id::text, nom, description, statut::text
        """,
        projet_id,
        data["nom"],
        data.get("description", ""),
        data.get("statut", "Brouillon"),
    )
    return dict(row) if row else None


async def delete(conn: Connection, projet_id: str) -> bool:
    result = await conn.execute("DELETE FROM projets WHERE id=$1::uuid", projet_id)
    return result == "DELETE 1"


async def ensure_default(conn: Connection) -> str:
    """Crée un projet par défaut s'il n'en existe aucun. Retourne son id."""
    row = await conn.fetchrow("SELECT id::text FROM projets LIMIT 1")
    if row:
        return row["id"]
    new_id = str(uuid.uuid4())
    await conn.execute(
        "INSERT INTO projets (id, nom, description, statut) VALUES ($1::uuid, $2, $3, $4::projet_statut)",
        new_id, "Projet Principal", "Projet par défaut", "En cours",
    )
    return new_id
