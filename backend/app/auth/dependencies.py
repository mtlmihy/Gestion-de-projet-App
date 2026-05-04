"""
Dépendances FastAPI d'authentification.

get_current_user  — vérifie le JWT, charge l'utilisateur depuis la DB.
require_admin     — vérifie en plus que is_admin=True.
"""
from __future__ import annotations

from typing import Optional

from asyncpg import Pool
from fastapi import Cookie, Depends, HTTPException, status

from app.auth import service as auth_service
from app.db.pool import get_pool


async def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    pool: Pool = Depends(get_pool),
) -> dict:
    """
    Lit le cookie HttpOnly 'access_token', valide le JWT,
    puis charge l'utilisateur depuis la base.
    Retourne un dict {id, email, nom, poste, is_admin, is_active}.
    ⚠️ Tous les échecs renvoient le même 401 générique pour ne pas révéler
    à un attaquant si le token est absent / expiré / révoqué / l'utilisateur désactivé.
    """
    _UNAUTHORIZED = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise.",
    )

    if access_token is None:
        raise _UNAUTHORIZED
    try:
        payload = auth_service.decode_access_token(access_token)
    except HTTPException:
        raise _UNAUTHORIZED
    user_id  = payload.get("sub")
    token_v  = payload.get("tv")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id::text, email, nom, poste, is_admin, is_active, peut_creer_projet, "
            "pages_autorisees, token_version "
            "FROM utilisateurs WHERE id=$1::uuid",
            user_id,
        )

    if row is None or not row["is_active"]:
        raise _UNAUTHORIZED

    # Révocation : si le token a été émis avant un changement
    # (logout global, reset mot de passe, désactivation), on refuse —
    # même message générique.
    if token_v is None or token_v != row["token_version"]:
        raise _UNAUTHORIZED

    user = dict(row)
    user.pop("token_version", None)
    return user


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Lève HTTP 403 si l'utilisateur n'est pas administrateur."""
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs.",
        )
    return current_user
