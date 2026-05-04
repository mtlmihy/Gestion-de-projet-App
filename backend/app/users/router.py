"""
Endpoints de gestion des utilisateurs — réservés aux administrateurs.

GET    /users/           → liste tous les utilisateurs
POST   /users/           → crée un utilisateur
GET    /users/{id}       → détail d'un utilisateur
PUT    /users/{id}       → modifie nom/poste/is_admin/is_active
DELETE /users/{id}       → supprime (impossible de se supprimer soi-même)
POST   /users/{id}/reset-password → réinitialise le mot de passe
"""
from __future__ import annotations
from typing import List

from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth.dependencies import get_current_user, require_admin
from app.db.pool import get_pool
from app.security.audit import Action, log_event
from app.users import service as svc
from app.users.schemas import ResetPasswordRequest, UserCreate, UserPublic, UserRead, UserUpdate

router = APIRouter(dependencies=[Depends(require_admin)])


# Endpoint accessible à tout utilisateur connecté — retourne uniquement id/nom/email/poste
# Utilisé par les propriétaires de projet pour inviter des membres
_public_router = APIRouter(dependencies=[Depends(get_current_user)])


@_public_router.get("/disponibles", response_model=List[UserPublic])
async def list_users_disponibles(
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    """Retourne tous les utilisateurs actifs non-admin (sauf l'appelant)."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id::text, email, nom, poste FROM utilisateurs "
            "WHERE is_active = TRUE AND is_admin = FALSE AND id != $1::uuid "
            "ORDER BY COALESCE(nom, email)",
            current_user["id"],
        )
    return [dict(r) for r in rows]


@router.get("/", response_model=List[UserRead])
async def list_users(pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn)


@router.post("/", response_model=UserRead, status_code=201)
async def create_user(
    payload: UserCreate,
    request: Request,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    async with pool.acquire() as conn:
        # Vérifier unicité de l'e-mail
        existing = await conn.fetchval(
            "SELECT 1 FROM utilisateurs WHERE email=$1", payload.email
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un utilisateur avec cet e-mail existe déjà.",
            )
        created = await svc.create(conn, payload.model_dump())
    await log_event(
        pool,
        action=Action.USER_CREATE,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        target_type="user",
        target_id=created["id"],
        request=request,
        metadata={"email": created["email"], "is_admin": created.get("is_admin")},
    )
    return created


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        user = await svc.get_by_id(conn, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    async with pool.acquire() as conn:
        user = await svc.update(conn, user_id, payload.model_dump())
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    await log_event(
        pool,
        action=Action.USER_UPDATE,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        target_type="user",
        target_id=user_id,
        request=request,
        metadata={
            "is_admin": user.get("is_admin"),
            "is_active": user.get("is_active"),
            "peut_creer_projet": user.get("peut_creer_projet"),
        },
    )
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    request: Request,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de se supprimer soi-même.",
        )
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    await log_event(
        pool,
        action=Action.USER_DELETE,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        target_type="user",
        target_id=user_id,
        request=request,
    )


@router.post("/{user_id}/reset-password", status_code=204)
async def reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    request: Request,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    async with pool.acquire() as conn:
        ok = await svc.reset_password(conn, user_id, payload.password)
    if not ok:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    await log_event(
        pool,
        action=Action.PASSWORD_RESET,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        target_type="user",
        target_id=user_id,
        request=request,
    )


@router.post("/{user_id}/force-logout", status_code=204)
async def force_logout(
    user_id: str,
    request: Request,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    """Admin : révoque toutes les sessions actives d'un utilisateur."""
    async with pool.acquire() as conn:
        ok = await svc.force_logout(conn, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    await log_event(
        pool,
        action=Action.LOGOUT_ALL,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        target_type="user",
        target_id=user_id,
        request=request,
        metadata={"forced_by_admin": True},
    )


@router.delete("/{user_id}/projets", status_code=200)
async def remove_user_from_all_projects(
    user_id: str,
    request: Request,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    """Admin : retire l'utilisateur de tous ses projets (offboarding)."""
    async with pool.acquire() as conn:
        # Vérifie que l'utilisateur existe
        exists = await conn.fetchval(
            "SELECT 1 FROM utilisateurs WHERE id=$1::uuid", user_id
        )
        if not exists:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        nb = await svc.remove_from_all_projects(conn, user_id)
    await log_event(
        pool,
        action=Action.USER_UPDATE,
        user_id=current_user["id"],
        user_email=current_user.get("email"),
        target_type="user",
        target_id=user_id,
        request=request,
        metadata={"removed_from_projets": nb},
    )
    return {"removed": nb}
