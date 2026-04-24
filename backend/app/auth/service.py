"""
Service d'authentification.

Remplace :
  - hashlib.sha256 + comparaison dans check_password() de Gestion-de-projet-App.py
  - Le stockage du hash dans l'URL (?auth=...)
Par :
  - Vérification du mot de passe → émission d'un JWT signé (HS256)
  - JWT stocké en cookie HttpOnly (invisible au JS, protégé contre XSS)
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import settings

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Mot de passe incorrect ou session expirée.",
    headers={"WWW-Authenticate": "Bearer"},
)


def verify_password(plain_password: str) -> bool:
    """
    Compare le SHA-256 du mot de passe saisi avec PASSWORD_HASH dans .env.
    Compatible avec le hash existant dans .streamlit/secrets.toml.
    """
    digest = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return digest == settings.password_hash


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Génère un JWT signé avec SECRET_KEY (algorithme HS256).
    Inclut une expiration (défaut : ACCESS_TOKEN_EXPIRE_MINUTES).
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
