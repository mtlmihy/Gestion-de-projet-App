"""
Service d'authentification.

Authentification par e-mail + mot de passe (bcrypt) stocké en base.
JWT HttpOnly cookie — sub = UUID de l'utilisateur, tv = token_version.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from asyncpg import Connection
from fastapi import HTTPException, status
import jwt
from jwt import PyJWTError
import bcrypt as _bcrypt

from app.config import settings


_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentification requise.",
    # Pas de WWW-Authenticate: révèle inutilement le schéma d'auth Bearer.
)


# Hash bcrypt factice (cost 12) utilisé pour faire un check même quand
# l'utilisateur n'existe pas → égalise les temps de réponse et bloque
# l'énumération des comptes par mesure de timing.
_DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8.bnB3jB9uH5Q1dGZ2c1aN3RvR3K3K"


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
    data["tv"] doit contenir le token_version courant de l'utilisateur (int).
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
    except PyJWTError:
        raise _CREDENTIALS_EXCEPTION


# ── Authentification ──────────────────────────────────────────────────────────

async def authenticate_user(
    conn: Connection, email: str, password: str
) -> dict | None:
    """
    Cherche l'utilisateur par e-mail, vérifie le mot de passe bcrypt.
    ⚠️ Constant-time : exécute toujours un bcrypt (même si l'email n'existe
    pas) pour égaliser les temps de réponse → bloque l'énumération des comptes.
    Retourne le dict utilisateur (incl. token_version) ou None si KO.
    """
    row = await conn.fetchrow(
        "SELECT id::text, email, nom, poste, mot_de_passe, is_admin, is_active, token_version "
        "FROM utilisateurs WHERE email=$1",
        email.lower().strip(),
    )
    # Toujours hasher pour ne pas révéler l'absence de l'utilisateur via timing.
    stored_hash = row["mot_de_passe"] if row else _DUMMY_HASH
    password_ok = verify_password(password, stored_hash)
    if not row or not password_ok or not row["is_active"]:
        return None
    return dict(row)
