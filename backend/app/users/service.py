from __future__ import annotations
import uuid
from asyncpg import Connection
import bcrypt as _bcrypt




def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


async def get_all(conn: Connection) -> list[dict]:
    rows = await conn.fetch(
        "SELECT id::text, email, nom, poste, is_admin, is_active, peut_creer_projet, "
        "pages_autorisees, derniere_connexion "
        "FROM utilisateurs ORDER BY nom NULLS LAST"
    )
    return [dict(r) for r in rows]


async def get_by_id(conn: Connection, user_id: str) -> dict | None:
    row = await conn.fetchrow(
        "SELECT id::text, email, nom, poste, is_admin, is_active, peut_creer_projet, "
        "pages_autorisees, derniere_connexion "
        "FROM utilisateurs WHERE id=$1::uuid",
        user_id,
    )
    return dict(row) if row else None


async def create(conn: Connection, data: dict) -> dict:
    hashed = hash_password(data["password"])
    row = await conn.fetchrow(
        """
        INSERT INTO utilisateurs (id, email, nom, poste, mot_de_passe, is_admin, is_active, peut_creer_projet, pages_autorisees)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, TRUE, $6, $7)
        RETURNING id::text, email, nom, poste, is_admin, is_active, peut_creer_projet, pages_autorisees
        """,
        data["email"],
        data.get("nom"),
        data.get("poste"),
        hashed,
        data.get("is_admin", False),
        data.get("peut_creer_projet", False),
        data.get("pages_autorisees"),
    )
    return dict(row)


async def update(conn: Connection, user_id: str, data: dict) -> dict | None:
    # Si on désactive le compte ou retire des droits sensibles, on incrémente
    # token_version pour révoquer les sessions actives de l'utilisateur.
    bump_tv = not data.get("is_active", True)
    row = await conn.fetchrow(
        f"""
        UPDATE utilisateurs
        SET nom=$2, poste=$3, is_admin=$4, is_active=$5, peut_creer_projet=$6, pages_autorisees=$7
            {", token_version = token_version + 1" if bump_tv else ""}
        WHERE id=$1::uuid
        RETURNING id::text, email, nom, poste, is_admin, is_active, peut_creer_projet, pages_autorisees
        """,
        user_id,
        data.get("nom"),
        data.get("poste"),
        data.get("is_admin", False),
        data.get("is_active", True),
        data.get("peut_creer_projet", False),
        data.get("pages_autorisees"),
    )
    return dict(row) if row else None


async def reset_password(conn: Connection, user_id: str, password: str) -> bool:
    hashed = hash_password(password)
    # Reset mot de passe ⇒ on révoque toutes les sessions existantes.
    result = await conn.execute(
        "UPDATE utilisateurs "
        "SET mot_de_passe=$2, token_version = token_version + 1 "
        "WHERE id=$1::uuid",
        user_id, hashed,
    )
    return result == "UPDATE 1"


async def delete(conn: Connection, user_id: str) -> bool:
    result = await conn.execute(
        "DELETE FROM utilisateurs WHERE id=$1::uuid", user_id
    )
    return result == "DELETE 1"


async def force_logout(conn: Connection, user_id: str) -> bool:
    """Révoque toutes les sessions actives d'un utilisateur en bumpant
    son token_version. Tous les JWT précédemment émis sont invalidés."""
    result = await conn.execute(
        "UPDATE utilisateurs SET token_version = token_version + 1 "
        "WHERE id=$1::uuid",
        user_id,
    )
    return result == "UPDATE 1"


async def remove_from_all_projects(conn: Connection, user_id: str) -> int:
    """Retire l'utilisateur de tous ses projets (offboarding).
    Retourne le nombre de projets desquels il a été retiré."""
    result = await conn.execute(
        "DELETE FROM projet_membres WHERE utilisateur_id=$1::uuid",
        user_id,
    )
    # result = "DELETE n"
    try:
        return int(result.split()[-1])
    except (ValueError, IndexError):
        return 0


async def update_last_login(conn: Connection, user_id: str) -> None:
    await conn.execute(
        "UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id=$1::uuid",
        user_id,
    )
