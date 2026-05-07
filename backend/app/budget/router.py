from __future__ import annotations
from typing import List

from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.projets import service as projets_svc
from app.budget import service as svc
from app.budget.schemas import DepenseCreate, DepenseRead, DepenseUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])

_ROLES_EDITEUR = {'Proprietaire', 'Editeur'}


async def _check_membre(projet_id: str, user: dict, pool: Pool) -> None:
    if user['is_admin']:
        return
    async with pool.acquire() as conn:
        role = await projets_svc.get_user_role(conn, projet_id, user['id'])
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Accès refusé.')


async def _check_editeur(projet_id: str, user: dict, pool: Pool) -> None:
    if user['is_admin']:
        return
    async with pool.acquire() as conn:
        role = await projets_svc.get_user_role(conn, projet_id, user['id'])
    if role not in _ROLES_EDITEUR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Rôle Éditeur ou Propriétaire requis.',
        )


async def _get_projet_id_for_ligne(ligne_id: str, pool: Pool) -> str:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT projet_id::text FROM budget_lignes WHERE id=$1::uuid', ligne_id
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ligne introuvable.')
    return row['projet_id']


@router.get('/', response_model=List[DepenseRead])
async def list_depenses(
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_membre(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post('/', response_model=DepenseRead, status_code=201)
async def create_depense(
    payload: DepenseCreate,
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump())


@router.put('/{ligne_id}', response_model=DepenseRead)
async def update_depense(
    ligne_id: str,
    payload: DepenseUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_ligne(ligne_id, pool)
    await _check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.update(conn, ligne_id, payload.model_dump())
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ligne introuvable.')
    return result


@router.delete('/{ligne_id}', status_code=204)
async def delete_depense(
    ligne_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_ligne(ligne_id, pool)
    await _check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, ligne_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ligne introuvable.')
