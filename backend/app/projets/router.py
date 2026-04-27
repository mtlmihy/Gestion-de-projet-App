from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.projets import service as svc
from app.projets.schemas import ProjetCreate, ProjetRead, ProjetUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[ProjetRead])
async def list_projets(pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn)


@router.post("/", response_model=ProjetRead, status_code=201)
async def create_projet(payload: ProjetCreate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.create(conn, payload.model_dump())


@router.put("/{projet_id}", response_model=ProjetRead)
async def update_projet(projet_id: str, payload: ProjetUpdate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        result = await svc.update(conn, projet_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return result


@router.delete("/{projet_id}", status_code=204)
async def delete_projet(projet_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, projet_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
