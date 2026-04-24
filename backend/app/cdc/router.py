"""
Endpoints pour le Cahier des Charges.
Remplace le daemon HTTP local (_CDCSaveHandler) de Streamlit.

Mapping direct :
  Ancien daemon HTTP               →  Nouvelle route FastAPI
  ─────────────────────────────────────────────────────────
  GET  localhost:{PORT}/cdc_data   →  GET  /cdc
  POST localhost:{PORT}/save_cdc   →  PUT  /cdc
  GET  localhost:{PORT}/cdc_version→  GET  /cdc/version

Toutes les routes sont protégées par get_current_user().
"""
from __future__ import annotations

from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.cdc import service as svc
from app.cdc.schemas import CdcRead, CdcUpdate, CdcVersion
from app.db.pool import get_pool

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=CdcRead)
async def get_cdc(pool: Pool = Depends(get_pool)):
    """
    Retourne le JSON complet du CDC.
    Remplace : GET localhost:{PORT}/cdc_data
    """
    async with pool.acquire() as conn:
        result = await svc.get(conn)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CDC introuvable.")
    return result


@router.put("/", response_model=CdcRead)
async def update_cdc(payload: CdcUpdate, pool: Pool = Depends(get_pool)):
    """
    Sauvegarde le CDC (upsert JSONB).
    Remplace : POST localhost:{PORT}/save_cdc
    """
    async with pool.acquire() as conn:
        return await svc.upsert(conn, payload.data)


@router.get("/version", response_model=CdcVersion)
async def get_cdc_version(pool: Pool = Depends(get_pool)):
    """
    Retourne un hash court pour que le frontend détecte les changements.
    Remplace : GET localhost:{PORT}/cdc_version
    """
    async with pool.acquire() as conn:
        h = await svc.get_version_hash(conn)
    return CdcVersion(hash=h)
