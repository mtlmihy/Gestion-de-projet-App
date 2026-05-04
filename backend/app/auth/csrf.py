"""
Protection CSRF — pattern « double-submit cookie ».

Pourquoi : nos cookies de session utilisent SameSite=None en prod (cross-site
Vercel ↔ Render). SameSite=None désactive la protection CSRF native du
navigateur. On mitige avec un second cookie *non* HttpOnly (csrf_token) :
le frontend doit le lire et le renvoyer dans l'en-tête X-CSRF-Token sur
toute requête mutable. Un site malveillant ne peut pas lire ce cookie
(politique d'origine), donc ne peut pas forger l'en-tête.

Le middleware refuse les requêtes mutables (POST/PUT/PATCH/DELETE) qui :
  - ont un cookie de session (access_token) ET
  - ne fournissent pas un X-CSRF-Token correspondant au cookie csrf_token.

Les requêtes sans session (login, /health, etc.) ne sont pas filtrées :
elles sont déjà rate-limitées et n'ont rien à protéger côté CSRF.
"""
from __future__ import annotations

import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def generate_csrf_token() -> str:
    """Token URL-safe imprévisible (32 octets ≈ 256 bits)."""
    return secrets.token_urlsafe(32)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Pas de session → rien à protéger (login, endpoints publics, healthcheck).
        # On laisse aussi passer les méthodes sûres.
        if (
            request.method in SAFE_METHODS
            or request.cookies.get("access_token") is None
        ):
            return await call_next(request)

        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        header_token = request.headers.get(CSRF_HEADER_NAME)

        if (
            not cookie_token
            or not header_token
            or not secrets.compare_digest(cookie_token, header_token)
        ):
            return JSONResponse(
                status_code=403,
                content={"detail": "Jeton CSRF invalide ou manquant."},
            )

        return await call_next(request)
