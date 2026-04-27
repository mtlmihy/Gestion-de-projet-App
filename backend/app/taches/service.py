from __future__ import annotations
import uuid
from asyncpg import Connection


def _row(r) -> dict:
    d = dict(r)
    d["id"]        = str(d["id"])
    d["projet_id"] = str(d["projet_id"])
    if d.get("echeance") is not None:
        d["echeance"] = str(d["echeance"])
    # renommer la colonne DB -> champ Pydantic
    d["assigne"] = d.pop("assigne_a", "") or ""
    d.setdefault("jalon", "")
    return d


async def get_all(conn: Connection, projet_id: str) -> list[dict]:
    rows = await conn.fetch(
        "SELECT * FROM taches WHERE projet_id=$1::uuid ORDER BY nom",
        projet_id,
    )
    return [_row(r) for r in rows]


async def create(conn: Connection, projet_id: str, data: dict) -> dict:
    echeance = data.get("echeance") or None
    row = await conn.fetchrow(
        """
        INSERT INTO taches
            (id, projet_id, nom, description, importance,
             avancement, assigne_a, jalon, statut, echeance)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::date)
        RETURNING *
        """,
        str(uuid.uuid4()),
        projet_id,
        data["nom"],
        data.get("description", ""),
        data.get("importance", "Moyenne"),
        data.get("avancement", 0),
        data.get("assigne", ""),
        data.get("jalon", ""),
        data.get("statut", "A faire"),
        echeance,
    )
    return _row(row)


async def update(conn: Connection, tache_id: str, data: dict) -> dict | None:
    echeance = data.get("echeance") or None
    row = await conn.fetchrow(
        """
        UPDATE taches
        SET nom=$2, description=$3, importance=$4,
            avancement=$5, assigne_a=$6, jalon=$7, statut=$8, echeance=$9::date
        WHERE id=$1::uuid
        RETURNING *
        """,
        tache_id,
        data["nom"],
        data.get("description", ""),
        data.get("importance", "Moyenne"),
        data.get("avancement", 0),
        data.get("assigne", ""),
        data.get("jalon", ""),
        data.get("statut", "A faire"),
        echeance,
    )
    return _row(row) if row else None


async def delete(conn: Connection, tache_id: str) -> bool:
    result = await conn.execute("DELETE FROM taches WHERE id=$1::uuid", tache_id)
    return result == "DELETE 1"
