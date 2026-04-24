"""
Endpoints d'authentification.

POST /auth/login  → vérifie le mot de passe, émet un JWT dans un cookie HttpOnly
POST /auth/logout → supprime le cookie côté client
"""
from fastapi import APIRouter, HTTPException, Response, status

from app.auth import service as auth_service
from app.auth.schemas import LoginRequest, TokenResponse
from app.config import settings

router = APIRouter()

# Durée de vie du cookie en secondes (doit correspondre à ACCESS_TOKEN_EXPIRE_MINUTES)
_COOKIE_MAX_AGE = settings.access_token_expire_minutes * 60


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response):
    """
    Authentifie l'utilisateur avec son mot de passe.
    En cas de succès : émet un cookie HttpOnly 'access_token' contenant le JWT.
    En cas d'échec  : HTTP 401.
    """
    if not auth_service.verify_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect.",
        )

    token = auth_service.create_access_token(data={"sub": "admin"})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,       # invisible au JavaScript → protège contre XSS
        secure=False,        # True en production (HTTPS uniquement)
        samesite="lax",      # protège contre CSRF
        max_age=_COOKIE_MAX_AGE,
    )
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=204)
async def logout(response: Response):
    """Invalide la session côté client en supprimant le cookie 'access_token'."""
    response.delete_cookie(key="access_token", httponly=True, samesite="lax")
