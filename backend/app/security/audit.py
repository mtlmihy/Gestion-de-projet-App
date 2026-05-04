"""
Module audit log : insertion centralisée d'événements de sécurité/métier.

Objectif : tracer qui a fait quoi sur les actions sensibles (auth, users,
projets…). Utile pour passation, conformité, COPIL et investigation post-mortem.

L'écriture du log ne doit JAMAIS faire échouer la requête fonctionnelle :
toute erreur est silencieusement avalée (loggée stdout uniquement).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from asyncpg import Pool
from starlette.requests import Request

logger = logging.getLogger(__name__)


# ── Constantes d'actions ──────────────────────────────────────────────────────
class Action:
    LOGIN_SUCCESS         = "login.success"
    LOGIN_FAILURE         = "login.failure"
    LOGOUT                = "logout"
    LOGOUT_ALL            = "logout.all"
    PASSWORD_CHANGE       = "password.change"
    PASSWORD_RESET        = "password.reset"          # par admin
    USER_CREATE           = "user.create"
    USER_UPDATE           = "user.update"
    USER_DELETE           = "user.delete"
    PROJET_DELETE         = "projet.delete"
    PROJET_CLOTURE        = "projet.cloture"


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    # Render / Vercel posent X-Forwarded-For ; on prend le 1er hop (client réel).
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_agent(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    return ua[:1000] if ua else None  # cap pour éviter les abus


async def log_event(
    pool: Pool,
    *,
    action: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    request: Optional[Request] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO audit_log
                  (user_id, user_email, action, target_type, target_id, ip, user_agent, metadata)
                VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb)
                """,
                user_id,
                (user_email or "")[:255] or None,
                action[:64],
                target_type,
                str(target_id)[:64] if target_id is not None else None,
                _client_ip(request),
                _user_agent(request),
                json.dumps(metadata) if metadata else None,
            )
    except Exception as exc:                              # noqa: BLE001
        # On ne casse jamais le flux applicatif sur un échec d'audit.
        logger.warning("audit log failed (%s): %s", action, exc)
