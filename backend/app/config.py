from __future__ import annotations

from typing import List, Optional

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
    # Stocké en str pour éviter le parsing JSON de pydantic-settings v2.
    # Valeur : URL simple ou liste séparée par virgules.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Cookies (auth) ────────────────────────────────────────────────────────
    # En prod cross-site (frontend Vercel ↔ backend Render) :
    #   COOKIE_SECURE=true et COOKIE_SAMESITE=none
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # ── SSL DB (Supabase nécessite SSL) ───────────────────────────────────────
    db_ssl: bool = False


settings = Settings()

