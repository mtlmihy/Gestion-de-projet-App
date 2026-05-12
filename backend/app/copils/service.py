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
        SELECT
            cr.id,
            cr.projet_id,
            cr.date_reunion,
            cr.heure_reunion,
            cr.titre,
            cr.participants,
            cr.notes,
            cr.createur_id,
            COALESCE(NULLIF(u.nom, ''), u.email) AS createur_nom,
            cr.date_creation,
            cr.derniere_maj
        FROM copil_reunions cr
        LEFT JOIN utilisateurs u ON u.id = cr.createur_id
        WHERE cr.projet_id = $1::uuid
        ORDER BY cr.date_reunion DESC, cr.date_creation DESC
        """,
        projet_id,
    )
    return [_row(r) for r in rows]


async def create(conn: Connection, projet_id: str, data: dict, user_id: str | None) -> dict:
    row = await conn.fetchrow(
        """
        WITH inserted AS (
            INSERT INTO copil_reunions
                (projet_id, date_reunion, heure_reunion, titre, participants, notes, createur_id)
            VALUES
                ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
            RETURNING id, projet_id, date_reunion, heure_reunion, titre, participants, notes,
                      createur_id, date_creation, derniere_maj
        )
        SELECT
            i.id,
            i.projet_id,
            i.date_reunion,
            i.heure_reunion,
            i.titre,
            i.participants,
            i.notes,
            i.createur_id,
            COALESCE(NULLIF(u.nom, ''), u.email) AS createur_nom,
            i.date_creation,
            i.derniere_maj
        FROM inserted i
        LEFT JOIN utilisateurs u ON u.id = i.createur_id
        """,
        projet_id,
        data.get("date_reunion"),
        data.get("heure_reunion"),
        data.get("titre"),
        data.get("participants"),
        data.get("notes"),
        user_id,
    )
    return _row(row)


async def update(conn: Connection, copil_id: str, data: dict) -> dict | None:
    row = await conn.fetchrow(
        """
        WITH updated AS (
            UPDATE copil_reunions
            SET date_reunion = $2,
                heure_reunion= $3,
                titre        = $4,
                participants = $5,
                notes        = $6,
                derniere_maj = NOW()
            WHERE id = $1::uuid
            RETURNING id, projet_id, date_reunion, heure_reunion, titre, participants, notes,
                      createur_id, date_creation, derniere_maj
        )
        SELECT
            u2.id,
            u2.projet_id,
            u2.date_reunion,
            u2.heure_reunion,
            u2.titre,
            u2.participants,
            u2.notes,
            u2.createur_id,
            COALESCE(NULLIF(u.nom, ''), u.email) AS createur_nom,
            u2.date_creation,
            u2.derniere_maj
        FROM updated u2
        LEFT JOIN utilisateurs u ON u.id = u2.createur_id
        """,
        copil_id,
        data.get("date_reunion"),
        data.get("heure_reunion"),
        data.get("titre"),
        data.get("participants"),
        data.get("notes"),
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
        SELECT
            n.id,
            n.copil_id,
            n.auteur_id,
            COALESCE(NULLIF(u.nom, ''), u.email) AS auteur_nom,
            n.contenu,
            n.created_at,
            n.updated_at
        FROM copil_reunion_notes n
        LEFT JOIN utilisateurs u ON u.id = n.auteur_id
        WHERE n.copil_id = $1::uuid
        ORDER BY n.created_at DESC
        """,
        copil_id,
    )
    return [_note_row(r) for r in rows]


async def create_note(conn: Connection, copil_id: str, contenu: str, user_id: str | None) -> dict | None:
    row = await conn.fetchrow(
        """
        WITH inserted AS (
            INSERT INTO copil_reunion_notes (copil_id, auteur_id, contenu)
            SELECT id, $2::uuid, $3
            FROM copil_reunions
            WHERE id = $1::uuid
            RETURNING id, copil_id, auteur_id, contenu, created_at, updated_at
        )
        SELECT
            i.id,
            i.copil_id,
            i.auteur_id,
            COALESCE(NULLIF(u.nom, ''), u.email) AS auteur_nom,
            i.contenu,
            i.created_at,
            i.updated_at
        FROM inserted i
        LEFT JOIN utilisateurs u ON u.id = i.auteur_id
        """,
        copil_id,
        user_id,
        contenu,
    )
    return _note_row(row) if row else None


async def update_note(conn: Connection, note_id: str, contenu: str) -> dict | None:
    row = await conn.fetchrow(
        """
        WITH updated AS (
            UPDATE copil_reunion_notes
            SET contenu = $2,
                updated_at = NOW()
            WHERE id = $1::uuid
            RETURNING id, copil_id, auteur_id, contenu, created_at, updated_at
        )
        SELECT
            n.id,
            n.copil_id,
            n.auteur_id,
            COALESCE(NULLIF(u.nom, ''), u.email) AS auteur_nom,
            n.contenu,
            n.created_at,
            n.updated_at
        FROM updated n
        LEFT JOIN utilisateurs u ON u.id = n.auteur_id
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
