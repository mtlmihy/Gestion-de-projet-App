"""Endpoints pour les liens externes d'un projet (Jira, Miro, Teams, …).

- Lecture : tous les membres voient uniquement les liens marqués visibles ;
  l'admin, le Propriétaire et l'Éditeur voient tout.
- Écriture : réservée au Propriétaire, Éditeur ou administrateur.
"""
from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.liens import service as svc
from app.liens.schemas import LienCreate, LienRead, LienUpdate, LienVisibilite
from app.projets import service as projets_svc

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _can_edit(projet_id: str, current_user: dict, pool: Pool) -> bool:
    if current_user["is_admin"]:
        return True
    async with pool.acquire() as conn:
        role = await projets_svc.get_user_role(conn, projet_id, current_user["id"])
    return role in ("Proprietaire", "Editeur")


async def _check_can_edit(projet_id: str, current_user: dict, pool: Pool) -> None:
    if not await _can_edit(projet_id, current_user, pool):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé au propriétaire, éditeur ou administrateur.",
        )


@router.get("/projets/{projet_id}/liens", response_model=List[LienRead])
async def list_liens(
    projet_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    only_visible = not await _can_edit(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.list_for_projet(conn, projet_id, only_visible=only_visible)


@router.post("/projets/{projet_id}/liens", response_model=LienRead, status_code=201)
async def create_lien(
    projet_id: str,
    payload: LienCreate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_can_edit(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put("/projets/{projet_id}/liens/{lien_id}", response_model=LienRead)
async def update_lien(
    projet_id: str,
    lien_id: str,
    payload: LienUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_can_edit(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.update(conn, lien_id, payload.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="Lien introuvable.")
    return result


@router.patch("/projets/{projet_id}/liens/{lien_id}/visibilite", response_model=LienRead)
async def toggle_visibilite(
    projet_id: str,
    lien_id: str,
    payload: LienVisibilite,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_can_edit(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.set_visibilite(conn, lien_id, payload.visible)
    if not result:
        raise HTTPException(status_code=404, detail="Lien introuvable.")
    return result


@router.delete("/projets/{projet_id}/liens/{lien_id}", status_code=204)
async def delete_lien(
    projet_id: str,
    lien_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_can_edit(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, lien_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lien introuvable.")
