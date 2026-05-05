from __future__ import annotations
from asyncpg import Connection


async def get_matrix(conn: Connection, projet_id: str) -> dict:
    membres_rows = await conn.fetch(
        """
        SELECT id::text, collaborateur, poste, email
        FROM equipe
        WHERE projet_id = $1::uuid
        ORDER BY collaborateur
        """,
        projet_id,
    )

    taches_rows = await conn.fetch(
        """
        SELECT id::text, nom, jalon, importance, statut, avancement
        FROM taches
        WHERE projet_id = $1::uuid
        ORDER BY nom
        """,
        projet_id,
    )

    assignations_rows = await conn.fetch(
        """
        SELECT tr.tache_id::text AS tache_id,
               tr.membre_id::text AS membre_id,
               tr.role::text AS role
        FROM tache_raci tr
        JOIN taches t ON t.id = tr.tache_id
        WHERE t.projet_id = $1::uuid
        ORDER BY tr.tache_id, tr.role, tr.membre_id
        """,
        projet_id,
    )

    return {
        "membres": [dict(r) for r in membres_rows],
        "taches": [dict(r) for r in taches_rows],
        "assignations": [dict(r) for r in assignations_rows],
    }


async def update_tache_assignations(
    conn: Connection,
    projet_id: str,
    tache_id: str,
    assignations: list[dict],
) -> list[dict] | None:
    tache_exists = await conn.fetchval(
        "SELECT 1 FROM taches WHERE id = $1::uuid AND projet_id = $2::uuid",
        tache_id,
        projet_id,
    )
    if not tache_exists:
        return None

    member_ids = [a["membre_id"] for a in assignations]
    if len(set(member_ids)) != len(member_ids):
        raise ValueError("Un membre ne peut avoir qu'un seul rôle RACI par tâche.")

    if member_ids:
        rows = await conn.fetch(
            "SELECT id::text FROM equipe WHERE projet_id = $1::uuid AND id = ANY($2::uuid[])",
            projet_id,
            member_ids,
        )
        valid_ids = {r["id"] for r in rows}
        invalid = [member_id for member_id in member_ids if member_id not in valid_ids]
        if invalid:
            raise ValueError("Membre(s) introuvable(s) pour ce projet.")

    roles = [a["role"] for a in assignations]
    if roles.count("A") > 1:
        raise ValueError("Une tâche ne peut avoir qu'un seul Accountable (A).")
    if roles.count("R") > 1:
        raise ValueError("Une tâche ne peut avoir qu'un seul Responsible (R).")

    # On remplace le set d'assignations pour garder une API idempotente.
    await conn.execute("DELETE FROM tache_raci WHERE tache_id = $1::uuid", tache_id)

    for item in assignations:
        await conn.execute(
            """
            INSERT INTO tache_raci (tache_id, membre_id, role)
            VALUES ($1::uuid, $2::uuid, $3::raci_role)
            """,
            tache_id,
            item["membre_id"],
            item["role"],
        )

    rows = await conn.fetch(
        """
        SELECT tache_id::text AS tache_id,
               membre_id::text AS membre_id,
               role::text AS role
        FROM tache_raci
        WHERE tache_id = $1::uuid
        ORDER BY role, membre_id
        """,
        tache_id,
    )
    return [dict(r) for r in rows]
