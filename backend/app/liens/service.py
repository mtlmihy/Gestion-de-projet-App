from __future__ import annotations
import uuid
from asyncpg import Connection


SELECT_COLS = """
    id::text, projet_id::text, libelle, url, type, visible, ordre
"""


async def list_for_projet(conn: Connection, projet_id: str, only_visible: bool) -> list[dict]:
    if only_visible:
        rows = await conn.fetch(
            f"SELECT {SELECT_COLS} FROM projet_liens "
            "WHERE projet_id=$1::uuid AND visible=TRUE "
            "ORDER BY ordre, date_creation",
            projet_id,
        )
    else:
        rows = await conn.fetch(
            f"SELECT {SELECT_COLS} FROM projet_liens "
            "WHERE projet_id=$1::uuid "
            "ORDER BY ordre, date_creation",
            projet_id,
        )
    return [dict(r) for r in rows]


async def get_by_id(conn: Connection, lien_id: str) -> dict | None:
    row = await conn.fetchrow(
        f"SELECT {SELECT_COLS} FROM projet_liens WHERE id=$1::uuid",
        lien_id,
    )
    return dict(row) if row else None


async def create(conn: Connection, projet_id: str, data: dict) -> dict:
    new_id = str(uuid.uuid4())
    row = await conn.fetchrow(
        f"""
        INSERT INTO projet_liens (id, projet_id, libelle, url, type, visible, ordre)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
        RETURNING {SELECT_COLS}
        """,
        new_id, projet_id,
        data["libelle"], data["url"], data.get("type", "autre"),
        data.get("visible", True), data.get("ordre", 0),
    )
    return dict(row)


async def update(conn: Connection, lien_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        f"""
        UPDATE projet_liens
        SET libelle=$2, url=$3, type=$4, visible=$5, ordre=$6
        WHERE id=$1::uuid
        RETURNING {SELECT_COLS}
        """,
        lien_id,
        data["libelle"], data["url"], data.get("type", "autre"),
        data.get("visible", True), data.get("ordre", 0),
    )
    return dict(row) if row else None


async def set_visibilite(conn: Connection, lien_id: str, visible: bool) -> dict | None:
    row = await conn.fetchrow(
        f"UPDATE projet_liens SET visible=$2 WHERE id=$1::uuid RETURNING {SELECT_COLS}",
        lien_id, visible,
    )
    return dict(row) if row else None


async def delete(conn: Connection, lien_id: str) -> bool:
    result = await conn.execute("DELETE FROM projet_liens WHERE id=$1::uuid", lien_id)
    return result == "DELETE 1"
