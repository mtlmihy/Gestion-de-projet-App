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
    # Stocké en str pour éviter le parsing JSON automatique de pydantic-settings v2.
    # Accepte :
    #   - une URL simple : "https://app.example.com"
    #   - plusieurs séparées par virgules : "https://a.com,https://b.com"
    #   - une liste JSON : '["https://a.com","https://b.com"]'
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        # Tolère le format JSON-list au cas où qqn met ["url1","url2"] en env.
        if raw.startswith("["):
            import json
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(o).strip() for o in parsed if str(o).strip()]
            except json.JSONDecodeError:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    # ── Cookies (auth) ────────────────────────────────────────────────────────
    # En prod cross-site (frontend Vercel ↔ backend Render) :
    #   COOKIE_SECURE=true et COOKIE_SAMESITE=none
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # ── SSL DB (Supabase nécessite SSL) ───────────────────────────────────────
    db_ssl: bool = False

    # ── Environnement ─────────────────────────────────────────────────────────
    # "development" | "production" — contrôle l'exposition de /docs, /redoc, etc.
    env: str = "development"

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    # Limite appliquée à /auth/login (anti brute-force).
    login_rate_limit: str = "5/minute"

    # ── Observabilité ─────────────────────────────────────────────────────────
    # Si défini, active Sentry (capture d'erreurs + alerting).
    sentry_dsn: Optional[str] = None
    # 0.0 = désactivé, 1.0 = 100% des transactions tracées.
    sentry_traces_sample_rate: float = 0.0


settings = Settings()

