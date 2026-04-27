from __future__ import annotations
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.cdc import service as svc
from app.cdc.schemas import CdcRead, CdcUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=CdcRead)
async def get_cdc(projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        result = await svc.get(conn, projet_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CDC introuvable.")
    return result


@router.put("/", response_model=CdcRead)
async def update_cdc(payload: CdcUpdate, projet_id: str = Query(...), pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.upsert(conn, projet_id, payload.contenu)
