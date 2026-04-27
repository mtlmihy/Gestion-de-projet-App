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
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user, require_admin
from app.db.pool import get_pool
from app.users import service as svc
from app.users.schemas import ResetPasswordRequest, UserCreate, UserRead, UserUpdate

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/", response_model=List[UserRead])
async def list_users(pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn)


@router.post("/", response_model=UserRead, status_code=201)
async def create_user(payload: UserCreate, pool: Pool = Depends(get_pool)):
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
        return await svc.create(conn, payload.model_dump())


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        user = await svc.get_by_id(conn, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(user_id: str, payload: UserUpdate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        user = await svc.update(conn, user_id, payload.model_dump())
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
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


@router.post("/{user_id}/reset-password", status_code=204)
async def reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    pool: Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        ok = await svc.reset_password(conn, user_id, payload.password)
    if not ok:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
