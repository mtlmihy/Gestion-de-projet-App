from __future__ import annotations
from typing import List
from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.db.pool import get_pool
from app.projets import service as svc
from app.projets.schemas import (
    MembreCreate, MembreRead, MembreUpdate,
    ProjetCreate, ProjetRead, ProjetStatutUpdate, ProjetUpdate,
    ROLES_VALIDES,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


# ── Projets ───────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ProjetRead])
async def list_projets(
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    async with pool.acquire() as conn:
        return await svc.get_accessible(conn, current_user["id"], current_user["is_admin"])


@router.post("/", response_model=ProjetRead, status_code=201)
async def create_projet(
    payload: ProjetCreate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    if not current_user["is_admin"] and not current_user.get("peut_creer_projet"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs et chefs de projet peuvent créer un projet.",
        )
    async with pool.acquire() as conn:
        return await svc.create(conn, payload.model_dump(), createur_id=current_user["id"])


@router.put("/{projet_id}", response_model=ProjetRead)
async def update_projet(projet_id: str, payload: ProjetUpdate, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        result = await svc.update(conn, projet_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return result


@router.patch("/{projet_id}/statut", response_model=ProjetRead)
async def change_statut(
    projet_id: str,
    payload: ProjetStatutUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    """Change le statut d'un projet. Réservé au Propriétaire ou admin."""
    await _check_owner_or_admin(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.update_statut(conn, projet_id, payload.statut)
    if not result:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return result


@router.delete("/{projet_id}", status_code=204)
async def delete_projet(projet_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, projet_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")


@router.post("/{projet_id}/cloturer", response_model=ProjetRead)
async def cloturer_projet(
    projet_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    """Clôture un projet (lecture seule). Réservé au Propriétaire ou admin."""
    await _check_owner_or_admin(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.cloturer(conn, projet_id)
    if not result:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return result


@router.post("/{projet_id}/reactiver", response_model=ProjetRead)
async def reactiver_projet(
    projet_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    """Réactive un projet clôturé. Réservé aux administrateurs uniquement."""
    if not current_user["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un administrateur peut réactiver un projet clôturé.",
        )
    async with pool.acquire() as conn:
        result = await svc.reactiver(conn, projet_id)
    if not result:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return result


# ── Membres du projet ─────────────────────────────────────────────────────────

async def _check_owner_or_admin(projet_id: str, current_user: dict, pool: Pool) -> None:
    """Vérifie que l'utilisateur est admin ou Propriétaire du projet."""
    if current_user["is_admin"]:
        return
    async with pool.acquire() as conn:
        role = await svc.get_user_role(conn, projet_id, current_user["id"])
    if role != "Proprietaire":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé au propriétaire du projet ou à l'administrateur.",
        )


@router.get("/{projet_id}/membres", response_model=List[MembreRead])
async def list_membres(
    projet_id: str,
    pool: Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        return await svc.get_membres(conn, projet_id)


@router.post("/{projet_id}/membres", response_model=MembreRead, status_code=201)
async def add_membre(
    projet_id: str,
    payload: MembreCreate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_owner_or_admin(projet_id, current_user, pool)
    if payload.role not in ROLES_VALIDES:
        raise HTTPException(status_code=422, detail=f"Rôle invalide. Valeurs autorisées : {ROLES_VALIDES}")
    if payload.role == "Proprietaire" and not current_user["is_admin"]:
        raise HTTPException(status_code=403, detail="Seul un administrateur peut attribuer le rôle Propriétaire.")
    async with pool.acquire() as conn:
        membre = await svc.add_membre(conn, projet_id, payload.user_id, payload.role)
    if not membre:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return membre


@router.put("/{projet_id}/membres/{user_id}", response_model=MembreRead)
async def update_membre(
    projet_id: str,
    user_id: str,
    payload: MembreUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_owner_or_admin(projet_id, current_user, pool)
    if payload.role not in ROLES_VALIDES:
        raise HTTPException(status_code=422, detail=f"Rôle invalide. Valeurs autorisées : {ROLES_VALIDES}")
    if payload.role == "Proprietaire" and not current_user["is_admin"]:
        raise HTTPException(status_code=403, detail="Seul un administrateur peut attribuer le rôle Propriétaire.")
    async with pool.acquire() as conn:
        result = await svc.update_membre_role(conn, projet_id, user_id, payload.role)
    if not result:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    return result


@router.delete("/{projet_id}/membres/{user_id}", status_code=204)
async def remove_membre(
    projet_id: str,
    user_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await _check_owner_or_admin(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.remove_membre(conn, projet_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Membre introuvable.")

