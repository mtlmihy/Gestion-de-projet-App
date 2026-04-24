from __future__ import annotations

from typing import List

from asyncpg import Pool
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.equipe import service as svc
from app.equipe.schemas import MembreCreate, MembreRead

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[MembreRead])
async def list_equipe(pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        return await svc.get_all(conn)


@router.put("/", response_model=List[MembreRead])
async def replace_equipe(payload: List[MembreCreate], pool: Pool = Depends(get_pool)):
    """
    Remplace toute l'équipe en une opération atomique (batch save).
    Correspond au bouton "Enregistrer le tableau" de la page Équipe.
    """
    membres = [m.model_dump() for m in payload]
    async with pool.acquire() as conn:
        return await svc.replace_all(conn, membres)
