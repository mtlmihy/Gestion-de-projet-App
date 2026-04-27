from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.risques import service as svc
from app.risques.schemas import RisqueCreate, RisqueRead, RisqueUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[RisqueRead])
async def list_risques(projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=RisqueRead, status_code=201)
async def create_risque(payload: RisqueCreate, projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put("/{risque_id}", response_model=RisqueRead)
async def update_risque(risque_id: str, payload: RisqueUpdate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        result = await svc.update(conn, risque_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risque introuvable.")
    return result


@router.delete("/{risque_id}", status_code=204)
async def delete_risque(risque_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, risque_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risque introuvable.")
