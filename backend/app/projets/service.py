from __future__ import annotations
import uuid
from asyncpg import Connection


async def get_all(conn: Connection) -> list[dict]:
    rows = await conn.fetch("SELECT id::text, nom, description, statut::text FROM projets ORDER BY date_creation")
    return [dict(r) for r in rows]


async def get_accessible(conn: Connection, user_id: str, is_admin: bool) -> list[dict]:
    """Retourne tous les projets pour l'admin, sinon uniquement ceux où l'user est membre."""
    if is_admin:
        rows = await conn.fetch(
            """
            SELECT p.id::text, p.nom, p.description, p.statut::text, p.est_cloture,
                   pm.role::text AS mon_role
            FROM projets p
            LEFT JOIN projet_membres pm ON pm.projet_id = p.id AND pm.utilisateur_id = $1::uuid
            ORDER BY p.date_creation
            """,
            user_id,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT p.id::text, p.nom, p.description, p.statut::text, p.est_cloture,
                   pm.role::text AS mon_role
            FROM projets p
            JOIN projet_membres pm ON pm.projet_id = p.id AND pm.utilisateur_id = $1::uuid
            ORDER BY p.date_creation
            """,
            user_id,
        )
    return [dict(r) for r in rows]


async def get_by_id(conn: Connection, projet_id: str) -> dict | None:
    row = await conn.fetchrow(
        "SELECT id::text, nom, description, statut::text FROM projets WHERE id=$1::uuid",
        projet_id,
    )
    return dict(row) if row else None


async def create(conn: Connection, data: dict, createur_id: str | None = None) -> dict:
    new_id = str(uuid.uuid4())
    row = await conn.fetchrow(
        """
        INSERT INTO projets (id, nom, description, statut, createur_id)
        VALUES ($1::uuid, $2, $3, $4::projet_statut, $5::uuid)
        RETURNING id::text, nom, description, statut::text
        """,
        new_id,
        data["nom"],
        data.get("description", ""),
        data.get("statut", "Brouillon"),
        createur_id,
    )
    projet = dict(row)

    # Auto-ajout du créateur comme Propriétaire
    if createur_id:
        await conn.execute(
            """
            INSERT INTO projet_membres (projet_id, utilisateur_id, role)
            VALUES ($1::uuid, $2::uuid, 'Proprietaire'::projet_role)
            ON CONFLICT DO NOTHING
            """,
            new_id, createur_id,
        )
    return projet


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


async def update_statut(conn: Connection, projet_id: str, statut: str) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE projets SET statut=$2::projet_statut WHERE id=$1::uuid
        RETURNING id::text, nom, description, statut::text, est_cloture
        """,
        projet_id, statut,
    )
    return dict(row) if row else None


async def delete(conn: Connection, projet_id: str) -> bool:
    result = await conn.execute("DELETE FROM projets WHERE id=$1::uuid", projet_id)
    return result == "DELETE 1"


async def cloturer(conn: Connection, projet_id: str) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE projets
        SET est_cloture = TRUE, date_cloture = NOW()
        WHERE id = $1::uuid
        RETURNING id::text, nom, description, statut::text, est_cloture
        """,
        projet_id,
    )
    return dict(row) if row else None


async def reactiver(conn: Connection, projet_id: str) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE projets
        SET est_cloture = FALSE, date_cloture = NULL
        WHERE id = $1::uuid
        RETURNING id::text, nom, description, statut::text, est_cloture
        """,
        projet_id,
    )
    return dict(row) if row else None


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


# ── Gestion des membres ───────────────────────────────────────────────────────

async def get_membres(conn: Connection, projet_id: str) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT u.id::text AS user_id, u.email, u.nom, u.poste, pm.role::text AS role
        FROM projet_membres pm
        JOIN utilisateurs u ON u.id = pm.utilisateur_id
        WHERE pm.projet_id = $1::uuid
        ORDER BY u.nom NULLS LAST
        """,
        projet_id,
    )
    return [dict(r) for r in rows]


async def add_membre(conn: Connection, projet_id: str, user_id: str, role: str) -> dict | None:
    """Ajoute ou met à jour le rôle d'un membre. Retourne la ligne ou None si l'utilisateur n'existe pas."""
    user = await conn.fetchrow("SELECT id FROM utilisateurs WHERE id=$1::uuid", user_id)
    if not user:
        return None
    await conn.execute(
        """
        INSERT INTO projet_membres (projet_id, utilisateur_id, role)
        VALUES ($1::uuid, $2::uuid, $3::projet_role)
        ON CONFLICT (projet_id, utilisateur_id) DO UPDATE SET role = $3::projet_role
        """,
        projet_id, user_id, role,
    )
    row = await conn.fetchrow(
        """
        SELECT u.id::text AS user_id, u.email, u.nom, u.poste, pm.role::text AS role
        FROM projet_membres pm
        JOIN utilisateurs u ON u.id = pm.utilisateur_id
        WHERE pm.projet_id=$1::uuid AND pm.utilisateur_id=$2::uuid
        """,
        projet_id, user_id,
    )
    return dict(row) if row else None


async def update_membre_role(conn: Connection, projet_id: str, user_id: str, role: str) -> dict | None:
    row = await conn.fetchrow(
        """
        UPDATE projet_membres SET role=$3::projet_role
        WHERE projet_id=$1::uuid AND utilisateur_id=$2::uuid
        RETURNING utilisateur_id::text AS user_id
        """,
        projet_id, user_id, role,
    )
    if not row:
        return None
    full = await conn.fetchrow(
        """
        SELECT u.id::text AS user_id, u.email, u.nom, u.poste, pm.role::text AS role
        FROM projet_membres pm JOIN utilisateurs u ON u.id=pm.utilisateur_id
        WHERE pm.projet_id=$1::uuid AND pm.utilisateur_id=$2::uuid
        """,
        projet_id, user_id,
    )
    return dict(full) if full else None


async def remove_membre(conn: Connection, projet_id: str, user_id: str) -> bool:
    result = await conn.execute(
        "DELETE FROM projet_membres WHERE projet_id=$1::uuid AND utilisateur_id=$2::uuid",
        projet_id, user_id,
    )
    return result == "DELETE 1"


async def get_user_role(conn: Connection, projet_id: str, user_id: str) -> str | None:
    """Retourne le rôle de l'utilisateur sur ce projet, ou None s'il n'est pas membre."""
    val = await conn.fetchval(
        "SELECT role::text FROM projet_membres WHERE projet_id=$1::uuid AND utilisateur_id=$2::uuid",
        projet_id, user_id,
    )
    return val

