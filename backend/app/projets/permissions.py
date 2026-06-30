"""Vérifications de rôle projet partagées entre les routers métier.

Avant ce module, le pattern "l'utilisateur doit être membre / Éditeur du
projet" était réimplémenté indépendamment dans risques, taches, budget,
raci, cdc, copils, equipe et liens — avec des variations (noms, ensembles
de rôles) qui ont fini par diverger silencieusement.
"""
from __future__ import annotations

from asyncpg import Pool
from fastapi import HTTPException, status

from app.projets import service as projets_svc

ROLES_EDITEUR = {"Proprietaire", "Editeur"}


async def _get_role(projet_id: str, current_user: dict, pool: Pool) -> str | None:
    async with pool.acquire() as conn:
        return await projets_svc.get_user_role(conn, projet_id, current_user["id"])


async def is_membre(projet_id: str, current_user: dict, pool: Pool) -> bool:
    """True si admin ou membre du projet, quel que soit son rôle."""
    if current_user["is_admin"]:
        return True
    return await _get_role(projet_id, current_user, pool) is not None


async def is_editeur(projet_id: str, current_user: dict, pool: Pool) -> bool:
    """True si admin, Propriétaire ou Éditeur du projet."""
    if current_user["is_admin"]:
        return True
    return await _get_role(projet_id, current_user, pool) in ROLES_EDITEUR


async def check_membre(projet_id: str, current_user: dict, pool: Pool) -> None:
    """Lève 403 si l'utilisateur n'est ni admin ni membre (tout rôle) du projet."""
    if not await is_membre(projet_id, current_user, pool):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")


async def check_editeur(projet_id: str, current_user: dict, pool: Pool) -> None:
    """Lève 403 si l'utilisateur n'est ni admin ni Éditeur/Propriétaire du projet."""
    if not await is_editeur(projet_id, current_user, pool):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : rôle Éditeur ou Propriétaire requis.",
        )
