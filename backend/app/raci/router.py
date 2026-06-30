from __future__ import annotations
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.projets import service as projets_svc
from app.raci import service as svc
from app.raci.schemas import RaciAssignationRead, RaciMatrixRead, RaciTacheAssignationsWrite

router = APIRouter(dependencies=[Depends(get_current_user)])

_ROLES_EDITEUR = {"Proprietaire", "Editeur"}


async def _check_membre(projet_id: str, current_user: dict, pool: Pool) -> None:
    if current_user["is_admin"]:
        return
    async with pool.acquire() as conn:
        role = await projets_svc.get_user_role(conn, projet_id, current_user["id"])
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")


async def _check_editeur(projet_id: str, current_user: dict, pool: Pool) -> None:
    if current_user["is_admin"]:
        return
    async with pool.acquire() as conn:
        role = await projets_svc.get_user_role(conn, projet_id, current_user["id"])
    if role not in _ROLES_EDITEUR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : rôle Éditeur ou Propriétaire requis.",
        )


@router.get("/", response_model=RaciMatrixRead)
async def get_raci_matrix(
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_membre(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.get_matrix(conn, projet_id)


@router.put("/taches/{tache_id}", response_model=list[RaciAssignationRead])
async def update_raci_for_tache(
    tache_id: str,
    payload: RaciTacheAssignationsWrite,
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_editeur(projet_id, current_user, pool)
    try:
        async with pool.acquire() as conn:
            updated = await svc.update_tache_assignations(
                conn,
                projet_id,
                tache_id,
                [a.model_dump() for a in payload.assignations],
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable.")
    return updated
