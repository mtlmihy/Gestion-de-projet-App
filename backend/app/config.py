from __future__ import annotations

import json
from typing import Any, List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Base de données ───────────────────────────────────────────────────────
    database_url: str

    # ── JWT ───────────────────────────────────────────────────────────────────
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 heures de session

    # ── Ancien hash admin (conservé pour rétro-compatibilité, non utilisé) ────
    password_hash: Optional[str] = None

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: Any) -> Any:
        """Accepte une string JSON, une liste séparée par virgules, ou une liste."""
        if isinstance(v, str):
            v = v.strip()
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [parsed]
            except (json.JSONDecodeError, ValueError):
                return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ── Cookies (auth) ────────────────────────────────────────────────────────
    # En prod cross-site (frontend Vercel ↔ backend Render) :
    #   COOKIE_SECURE=true et COOKIE_SAMESITE=none
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # ── SSL DB (Supabase nécessite SSL) ───────────────────────────────────────
    db_ssl: bool = False


settings = Settings()

