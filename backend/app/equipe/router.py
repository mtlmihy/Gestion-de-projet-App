from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.equipe import service as svc
from app.equipe.schemas import MembreCreate, MembreRead, MembreUpdate
from app.projets import service as proj_svc

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _projet_actif(pool: Pool) -> str:
    async with pool.acquire() as conn:
        return await proj_svc.ensure_default(conn)


@router.get("/", response_model=List[MembreRead])
async def list_equipe(pool: Pool = Depends(get_pool)):
    pid = await _projet_actif(pool)
    async with pool.acquire() as conn:
        return await svc.get_all(conn, pid)


@router.post("/", response_model=MembreRead, status_code=201)
async def create_membre(payload: MembreCreate, pool: Pool = Depends(get_pool)):
    pid = await _projet_actif(pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, pid, payload.model_dump())


@router.put("/{membre_id}", response_model=MembreRead)
async def update_membre(membre_id: str, payload: MembreUpdate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        result = await svc.update(conn, membre_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable.")
    return result


@router.delete("/{membre_id}", status_code=204)
async def delete_membre(membre_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, membre_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable.")
