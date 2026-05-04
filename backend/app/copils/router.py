from __future__ import annotations

from typing import List

from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.copils import service as svc
from app.copils.schemas import CopilCreate, CopilRead, CopilUpdate
from app.db.pool import get_pool

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[CopilRead])
async def list_copils(
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=CopilRead, status_code=201)
async def create_copil(
    payload: CopilCreate,
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump(), current_user.get("id"))


@router.put("/{copil_id}", response_model=CopilRead)
async def update_copil(
    copil_id: str,
    payload: CopilUpdate,
    pool: Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        result = await svc.update(conn, copil_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="COPIL introuvable.")
    return result


@router.delete("/{copil_id}", status_code=204)
async def delete_copil(
    copil_id: str,
    pool: Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, copil_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="COPIL introuvable.")
