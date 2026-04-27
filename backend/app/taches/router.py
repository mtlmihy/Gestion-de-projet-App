from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.taches import service as svc
from app.taches.schemas import TacheCreate, TacheRead, TacheUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[TacheRead])
async def list_taches(projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=TacheRead, status_code=201)
async def create_tache(payload: TacheCreate, projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put("/{tache_id}", response_model=TacheRead)
async def update_tache(tache_id: str, payload: TacheUpdate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        result = await svc.update(conn, tache_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable.")
    return result


@router.delete("/{tache_id}", status_code=204)
async def delete_tache(tache_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, tache_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable.")
