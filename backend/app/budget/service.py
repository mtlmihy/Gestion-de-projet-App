from __future__ import annotations
import uuid
from asyncpg import Connection


async def get_all(conn: Connection, projet_id: str) -> list[dict]:
    rows = await conn.fetch(
        "SELECT id::text, projet_id::text, date, categorie, description, montant, date_creation "
        "FROM budget_lignes WHERE projet_id=$1::uuid ORDER BY date DESC, date_creation DESC",
        projet_id,
    )
    return [dict(r) for r in rows]


async def create(conn: Connection, projet_id: str, data: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO budget_lignes (id, projet_id, date, categorie, description, montant)
        VALUES ($1::uuid, $2::uuid, $3::date, $4, $5, $6)
        RETURNING id::text, projet_id::text, date, categorie, description, montant, date_creation
        """,
        str(uuid.uuid4()), projet_id,
        data['date'], data['categorie'], data.get('description', ''), data['montant'],
    )
    return dict(row)


async def update(conn: Connection, ligne_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE budget_lignes
        SET date=$2::date, categorie=$3, description=$4, montant=$5
        WHERE id=$1::uuid
        RETURNING id::text, projet_id::text, date, categorie, description, montant, date_creation
        """,
        ligne_id, data['date'], data['categorie'], data.get('description', ''), data['montant'],
    )
    return dict(row) if row else None


async def delete(conn: Connection, ligne_id: str) -> bool:
    result = await conn.execute("DELETE FROM budget_lignes WHERE id=$1::uuid", ligne_id)
    return result == 'DELETE 1'
