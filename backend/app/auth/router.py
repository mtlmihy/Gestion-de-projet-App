"""
Endpoints d'authentification.

POST /auth/login            → vérifie email + mdp, émet un JWT en cookie HttpOnly
POST /auth/logout           → supprime les cookies de session côté client
POST /auth/logout-all       → révoque toutes les sessions de l'utilisateur
POST /auth/change-password  → change son propre mot de passe
GET  /auth/me               → retourne les infos de l'utilisateur connecté
"""
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth import service as auth_service
from app.auth.csrf import CSRF_COOKIE_NAME, generate_csrf_token
from app.auth.dependencies import get_current_user
from app.auth.schemas import ChangePasswordRequest, LoginRequest, MeResponse, TokenResponse
from app.config import settings
from app.db.pool import get_pool
from app.security.audit import Action, log_event

router = APIRouter()

# Limiter dédié au router auth (réutilise la même clé IP que dans main.py).
# slowapi récupère le limiter via request.app.state.limiter, donc le décorateur
# fonctionne tant que main.py a bien initialisé app.state.limiter.
_limiter = Limiter(key_func=get_remote_address)

_COOKIE_MAX_AGE = settings.access_token_expire_minutes * 60


def _clear_session_cookies(response: Response) -> None:
    """Supprime systématiquement access_token + csrf_token côté client.
    Utile pour garantir un état propre avant un nouveau login ou à la
    déconnexion (les delete_cookie cross-site SameSite=None peuvent être
    capricieux selon les navigateurs si on ne réutilise pas exactement les
    mêmes attributs)."""
    for key, http_only in (("access_token", True), (CSRF_COOKIE_NAME, False)):
        response.delete_cookie(
            key=key,
            httponly=http_only,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            path="/",
        )


def _set_csrf_cookie(response: Response) -> None:
    """Pose le cookie CSRF lisible par JS (double-submit pattern)."""
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=generate_csrf_token(),
        httponly=False,           # le frontend doit pouvoir le lire
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/login", response_model=TokenResponse)
@_limiter.limit(settings.login_rate_limit)
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    pool: Pool = Depends(get_pool),
):
    """
    Authentifie l'utilisateur (email + mot de passe bcrypt).
    En cas de succès : émet un cookie HttpOnly 'access_token' contenant le JWT
    et un cookie 'csrf_token' (non HttpOnly) pour la protection CSRF.
    Toujours commencer par effacer toute session précédente pour éviter
    qu'un cookie périmé bloque la nouvelle connexion.
    """
    # 1. Reset de l'état côté client (cookies périmés éventuels).
    _clear_session_cookies(response)

    async with pool.acquire() as conn:
        user = await auth_service.authenticate_user(conn, payload.email, payload.password)

    if not user:
        await log_event(
            pool,
            action=Action.LOGIN_FAILURE,
            user_email=payload.email,
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides.",
        )

    token = auth_service.create_access_token(
        data={"sub": user["id"], "tv": user["token_version"]},
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )
    _set_csrf_cookie(response)
    await log_event(
        pool,
        action=Action.LOGIN_SUCCESS,
        user_id=user["id"],
        user_email=user["email"],
        request=request,
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(current_user: dict = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur connecté."""
    return current_user


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    pool: Pool = Depends(get_pool),
):
    """Invalide la session côté client en supprimant les cookies."""
    _clear_session_cookies(response)
    # Best-effort : si on a un access_token, on tente d'identifier l'utilisateur
    # pour tracer le logout. Sans token valide, on log quand même l'événement.
    user_id = None
    user_email = None
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = auth_service.decode_access_token(token)
            user_id = payload.get("sub")
        except HTTPException:
            pass
    await log_event(
        pool,
        action=Action.LOGOUT,
        user_id=user_id,
        user_email=user_email,
        request=request,
    )


@router.post("/logout-all", status_code=204)
async def logout_all(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    pool: Pool = Depends(get_pool),
):
    """
    Révoque TOUTES les sessions de l'utilisateur (tous appareils).
    Incrémente token_version → tous les JWT précédemment émis sont rejetés.
    """
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE utilisateurs SET token_version = token_version + 1 "
            "WHERE id = $1::uuid",
            current_user["id"],
        )
    _clear_session_cookies(response)
    await log_event(
        pool,
        action=Action.LOGOUT_ALL,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        request=request,
    )


@router.post("/change-password", status_code=204)
async def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
    pool: Pool = Depends(get_pool),
):
    """
    Permet à l'utilisateur de changer son propre mot de passe.
    Vérifie l'ancien mot de passe, applique la politique sur le nouveau,
    incrémente token_version (révoque les autres sessions) et purge les
    cookies de la session courante (force la reconnexion).
    """
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent de l'ancien.",
        )
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT mot_de_passe FROM utilisateurs WHERE id=$1::uuid",
            current_user["id"],
        )
        if not row or not auth_service.verify_password(
            payload.current_password, row["mot_de_passe"]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opération refusée.",
            )
        new_hash = auth_service.hash_password(payload.new_password)
        await conn.execute(
            "UPDATE utilisateurs "
            "SET mot_de_passe=$2, token_version = token_version + 1 "
            "WHERE id=$1::uuid",
            current_user["id"], new_hash,
        )
    _clear_session_cookies(response)
    await log_event(
        pool,
        action=Action.PASSWORD_CHANGE,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        request=request,
    )
