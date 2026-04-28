"""
Endpoints d'authentification.

POST /auth/login  → vérifie email + mot de passe, émet un JWT dans un cookie HttpOnly
GET  /auth/me     → retourne les infos de l'utilisateur connecté
POST /auth/logout → supprime le cookie côté client
"""
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import service as auth_service
from app.auth.dependencies import get_current_user
from app.auth.schemas import LoginRequest, MeResponse, TokenResponse
from app.config import settings
from app.db.pool import get_pool

router = APIRouter()

_COOKIE_MAX_AGE = settings.access_token_expire_minutes * 60


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response, pool: Pool = Depends(get_pool)):
    """
    Authentifie l'utilisateur (email + mot de passe bcrypt).
    En cas de succès : émet un cookie HttpOnly 'access_token' contenant le JWT.
    """
    async with pool.acquire() as conn:
        user = await auth_service.authenticate_user(conn, payload.email, payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou mot de passe incorrect.",
        )

    token = auth_service.create_access_token(data={"sub": user["id"]})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=_COOKIE_MAX_AGE,
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(current_user: dict = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur connecté."""
    return current_user


@router.post("/logout", status_code=204)
async def logout(response: Response):
    """Invalide la session côté client en supprimant le cookie 'access_token'."""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
