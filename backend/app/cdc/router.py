from __future__ import annotations
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.cdc import service as svc
from app.cdc.schemas import CdcRead, CdcUpdate
from app.projets import service as proj_svc

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _projet_actif(pool: Pool) -> str:
    async with pool.acquire() as conn:
        return await proj_svc.ensure_default(conn)


@router.get("/", response_model=CdcRead)
async def get_cdc(pool: Pool = Depends(get_pool)):
    pid = await _projet_actif(pool)
    async with pool.acquire() as conn:
        result = await svc.get(conn, pid)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CDC introuvable.")
    return result


@router.put("/", response_model=CdcRead)
async def update_cdc(payload: CdcUpdate, pool: Pool = Depends(get_pool)):
    pid = await _projet_actif(pool)
    async with pool.acquire() as conn:
        return await svc.upsert(conn, pid, payload.contenu)
