from __future__ import annotations

from asyncpg import Connection


def _row(r) -> dict:
    d = dict(r)
    d["id"] = str(d["id"])
    d["projet_id"] = str(d["projet_id"])
    if d.get("createur_id") is not None:
        d["createur_id"] = str(d["createur_id"])
    return d


def _note_row(r) -> dict:
    d = dict(r)
    d["id"] = str(d["id"])
    d["copil_id"] = str(d["copil_id"])
    if d.get("auteur_id") is not None:
        d["auteur_id"] = str(d["auteur_id"])
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


async def get_notes(conn: Connection, copil_id: str) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT id, copil_id, auteur_id, contenu, created_at, updated_at
        FROM copil_reunion_notes
        WHERE copil_id = $1::uuid
        ORDER BY created_at DESC
        """,
        copil_id,
    )
    return [_note_row(r) for r in rows]


async def create_note(conn: Connection, copil_id: str, contenu: str, user_id: str | None) -> dict | None:
    row = await conn.fetchrow(
        """
        INSERT INTO copil_reunion_notes (copil_id, auteur_id, contenu)
        SELECT id, $2::uuid, $3
        FROM copil_reunions
        WHERE id = $1::uuid
        RETURNING id, copil_id, auteur_id, contenu, created_at, updated_at
        """,
        copil_id,
        user_id,
        contenu,
    )
    return _note_row(row) if row else None


async def update_note(conn: Connection, note_id: str, contenu: str) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE copil_reunion_notes
        SET contenu = $2,
            updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id, copil_id, auteur_id, contenu, created_at, updated_at
        """,
        note_id,
        contenu,
    )
    return _note_row(row) if row else None


async def delete_note(conn: Connection, note_id: str) -> bool:
    result = await conn.execute(
        "DELETE FROM copil_reunion_notes WHERE id = $1::uuid",
        note_id,
    )
    return result == "DELETE 1"
