from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.equipe import service as svc
from app.equipe.schemas import MembreCreate, MembreRead, MembreUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _check_projet_ouvert(projet_id: str, pool: Pool) -> None:
    """Lève 403 si le projet est clôturé."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT est_cloture FROM projets WHERE id = $1::uuid",
            projet_id,
        )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    if row["est_cloture"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce projet est clôturé. Modifications de l'équipe impossibles.",
        )


@router.get("/", response_model=List[MembreRead])
async def list_equipe(projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=MembreRead, status_code=201)
async def create_membre(payload: MembreCreate, projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    await _check_projet_ouvert(projet_id, pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put("/{membre_id}", response_model=MembreRead)
async def update_membre(membre_id: str, payload: MembreUpdate, projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    await _check_projet_ouvert(projet_id, pool)
    async with pool.acquire() as conn:
        result = await svc.update(conn, membre_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable.")
    return result


@router.delete("/{membre_id}", status_code=204)
async def delete_membre(membre_id: str, projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    await _check_projet_ouvert(projet_id, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, membre_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable.")
