from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.projets import service as projets_svc
from app.taches import service as svc
from app.taches.schemas import TacheCreate, TacheRead, TacheUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])

_ROLES_EDITEUR = {"Proprietaire", "Editeur"}


async def _check_can_edit_projet(projet_id: str, current_user: dict, pool: Pool) -> None:
    """Vérifie que l'utilisateur est admin, Propriétaire ou Éditeur du projet."""
    if current_user["is_admin"]:
        return
    async with pool.acquire() as conn:
        role = await projets_svc.get_user_role(conn, projet_id, current_user["id"])
    if role not in _ROLES_EDITEUR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : rôle Éditeur ou Propriétaire requis.",
        )


async def _get_projet_id_for_tache(tache_id: str, pool: Pool) -> str:
    """Retourne le projet_id associé à une tâche, ou lève 404."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT projet_id::text FROM taches WHERE id=$1::uuid",
            tache_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable.")
    return row["projet_id"]


@router.get("/", response_model=List[TacheRead])
async def list_taches(
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    # Vérifie que l'utilisateur est au moins membre (n'importe quel rôle) du projet.
    if not current_user["is_admin"]:
        async with pool.acquire() as conn:
            role = await projets_svc.get_user_role(conn, projet_id, current_user["id"])
        if role is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=TacheRead, status_code=201)
async def create_tache(
    payload: TacheCreate,
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_can_edit_projet(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put("/{tache_id}", response_model=TacheRead)
async def update_tache(
    tache_id: str,
    payload: TacheUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_tache(tache_id, pool)
    await _check_can_edit_projet(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.update(conn, tache_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable.")
    return result


@router.delete("/{tache_id}", status_code=204)
async def delete_tache(
    tache_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_tache(tache_id, pool)
    await _check_can_edit_projet(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, tache_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable.")
