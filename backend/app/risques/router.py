from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.projets import permissions as perms
from app.risques import service as svc
from app.risques.schemas import RisqueCreate, RisqueRead, RisqueUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _get_projet_id_for_risque(risque_id: str, pool: Pool) -> str:
    """Retourne le projet_id associé à un risque, ou lève 404."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT projet_id::text FROM risques WHERE id=$1::uuid",
            risque_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risque introuvable.")
    return row["projet_id"]


@router.get("/", response_model=List[RisqueRead])
async def list_risques(
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await perms.check_membre(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=RisqueRead, status_code=201)
async def create_risque(
    payload: RisqueCreate,
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put("/{risque_id}", response_model=RisqueRead)
async def update_risque(
    risque_id: str,
    payload: RisqueUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_risque(risque_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.update(conn, risque_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risque introuvable.")
    return result


@router.delete("/{risque_id}", status_code=204)
async def delete_risque(
    risque_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_risque(risque_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, risque_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risque introuvable.")
