from __future__ import annotations

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Base de données ───────────────────────────────────────────────────────
    # Format asyncpg : postgresql://user:password@host:port/dbname
    database_url: str

    # ── JWT ───────────────────────────────────────────────────────────────────
    # Générer avec : python -c "import secrets; print(secrets.token_hex(32))"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 heures de session

    # ── Mot de passe admin ────────────────────────────────────────────────────
    # Hash SHA-256 — identique à PASSWORD_HASH dans .streamlit/secrets.toml
    # Générer : python -c "import hashlib; print(hashlib.sha256('MDP'.encode()).hexdigest())"
    password_hash: str

    # ── CORS ──────────────────────────────────────────────────────────────────
    # URLs autorisées du frontend Vue (dev + prod)
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
