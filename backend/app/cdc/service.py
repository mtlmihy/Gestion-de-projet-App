"""
Requêtes PostgreSQL pour le Cahier des Charges.
→ Implémentées à l'Étape 3.

Remplace intégralement le daemon HTTP local (_CDCSaveHandler) de
Gestion-de-projet-App.py, qui gérait :
  GET  /cdc_version → hash de détection de changement
  GET  /cdc_data    → lecture du JSON depuis le disque
  POST /save_cdc    → écriture du JSON sur le disque

Ici, les routes FastAPI lisent/écrivent directement en PostgreSQL
(colonne JSONB dans la table cahier_des_charges).
"""
from __future__ import annotations

import hashlib
import json

from asyncpg import Connection


async def get(conn: Connection) -> dict | None:
    """SELECT data, updated_at FROM cahier_des_charges WHERE id = 1."""
    row = await conn.fetchrow(
        "SELECT data, updated_at FROM cahier_des_charges WHERE id = 1"
    )
    return dict(row) if row else None


async def upsert(conn: Connection, data: dict) -> dict:
    """Upsert atomique sur la ligne unique id = 1."""
    row = await conn.fetchrow(
        """
        INSERT INTO cahier_des_charges (id, data, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
            SET data = $1::jsonb, updated_at = NOW()
        RETURNING data, updated_at
        """,
        json.dumps(data, ensure_ascii=False),
    )
    return dict(row)


async def get_version_hash(conn: Connection) -> str:
    """Retourne un hash SHA-256 tronqué à 16 chars pour détecter les changements."""
    row = await conn.fetchrow(
        "SELECT data FROM cahier_des_charges WHERE id = 1"
    )
    if row is None:
        return "0" * 16
    # asyncpg retourne le JSONB déjà désérialisé — on re-sérialise de façon déterministe
    raw = json.dumps(row["data"], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
