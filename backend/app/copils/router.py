from __future__ import annotations

from typing import List

from asyncpg import Pool
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.copils import service as svc
from app.copils.schemas import (
    CopilCreate,
    CopilNoteCreate,
    CopilNoteRead,
    CopilNoteUpdate,
    CopilRead,
    CopilUpdate,
)
from app.db.pool import get_pool
from app.projets import permissions as perms

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _get_projet_id_for_copil(copil_id: str, pool: Pool) -> str:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT projet_id::text FROM copil_reunions WHERE id=$1::uuid",
            copil_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="COPIL introuvable.")
    return row["projet_id"]


async def _get_projet_id_for_note(note_id: str, pool: Pool) -> str:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT cr.projet_id::text
            FROM copil_reunion_notes n
            JOIN copil_reunions cr ON cr.id = n.copil_id
            WHERE n.id = $1::uuid
            """,
            note_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note introuvable.")
    return row["projet_id"]


@router.get("/", response_model=List[CopilRead])
async def list_copils(
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await perms.check_membre(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.get_all(conn, projet_id)


@router.post("/", response_model=CopilRead, status_code=201)
async def create_copil(
    payload: CopilCreate,
    projet_id: str = Query(...),
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.create(conn, projet_id, payload.model_dump(), current_user.get("id"))


@router.put("/{copil_id}", response_model=CopilRead)
async def update_copil(
    copil_id: str,
    payload: CopilUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_copil(copil_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        result = await svc.update(conn, copil_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="COPIL introuvable.")
    return result


@router.delete("/{copil_id}", status_code=204)
async def delete_copil(
    copil_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_copil(copil_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete(conn, copil_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="COPIL introuvable.")


@router.get("/{copil_id}/notes", response_model=List[CopilNoteRead])
async def list_copil_notes(
    copil_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_copil(copil_id, pool)
    await perms.check_membre(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        return await svc.get_notes(conn, copil_id)


@router.post("/{copil_id}/notes", response_model=CopilNoteRead, status_code=201)
async def create_copil_note(
    copil_id: str,
    payload: CopilNoteCreate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_copil(copil_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        note = await svc.create_note(conn, copil_id, payload.contenu, current_user.get("id"))
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="COPIL introuvable.")
    return note


@router.put("/notes/{note_id}", response_model=CopilNoteRead)
async def update_copil_note(
    note_id: str,
    payload: CopilNoteUpdate,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_note(note_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        note = await svc.update_note(conn, note_id, payload.contenu)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note introuvable.")
    return note


@router.delete("/notes/{note_id}", status_code=204)
async def delete_copil_note(
    note_id: str,
    pool: Pool = Depends(get_pool),
    current_user: dict = Depends(get_current_user),
):
    projet_id = await _get_projet_id_for_note(note_id, pool)
    await perms.check_editeur(projet_id, current_user, pool)
    async with pool.acquire() as conn:
        deleted = await svc.delete_note(conn, note_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note introuvable.")
