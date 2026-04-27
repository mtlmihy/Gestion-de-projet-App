"""
Service d'authentification.

Authentification par e-mail + mot de passe (bcrypt) stocké en base.
JWT HttpOnly cookie — sub = UUID de l'utilisateur.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from asyncpg import Connection
from fastapi import HTTPException, status
from jose import JWTError, jwt
import bcrypt as _bcrypt

from app.config import settings


_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Session invalide ou expirée. Veuillez vous reconnecter.",
    headers={"WWW-Authenticate": "Bearer"},
)


# ── Mots de passe ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Génère un JWT signé avec SECRET_KEY (HS256).
    data["sub"] doit contenir l'UUID de l'utilisateur (str).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    """
    Décode et valide un JWT.
    Lève HTTP 401 si le token est invalide, expiré ou mal formé.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("sub") is None:
            raise _CREDENTIALS_EXCEPTION
        return payload
    except JWTError:
        raise _CREDENTIALS_EXCEPTION


# ── Authentification ──────────────────────────────────────────────────────────

async def authenticate_user(
    conn: Connection, email: str, password: str
) -> dict | None:
    """
    Cherche l'utilisateur par e-mail, vérifie le mot de passe bcrypt.
    Retourne le dict utilisateur ou None si les identifiants sont invalides.
    """
    row = await conn.fetchrow(
        "SELECT id::text, email, nom, poste, mot_de_passe, is_admin, is_active "
        "FROM utilisateurs WHERE email=$1",
        email.lower().strip(),
    )
    if not row:
        return None
    user = dict(row)
    if not verify_password(password, user["mot_de_passe"]):
        return None
    if not user["is_active"]:
        return None
    return user
