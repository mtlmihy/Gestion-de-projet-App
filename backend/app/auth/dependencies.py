"""
Dépendance FastAPI : get_current_user()
Injectée dans TOUS les routers protégés via Depends(get_current_user).
→ Implémentée à l'Étape 2.

Remplace le mécanisme ?auth=HASH dans l'URL de Streamlit.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Cookie, HTTPException, status

from app.auth import service as auth_service


async def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
) -> dict:
    """
    Lit le cookie HttpOnly 'access_token', valide le JWT.
    Retourne le payload décodé (ex: {"sub": "admin"}).
    Lève HTTP 401 si absent ou invalide.
    """
    if access_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Non authentifié.",
        )
    return auth_service.decode_access_token(access_token)
