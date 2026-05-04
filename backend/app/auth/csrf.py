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

import logging
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


_logger = logging.getLogger("app.csrf")


CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Préfixes exemptés de la vérification CSRF.
# Toutes les routes /auth/* sont exemptes :
#   - /auth/login & /auth/logout  → pas de session valide à protéger ;
#     déjà couverts par le rate-limiter (anti brute-force).
#   - /auth/me, /auth/logout-all  → protégés par Depends(get_current_user)
#     qui vérifie la signature JWT + token_version (JWT non forgeable).
CSRF_EXEMPT_PREFIXES = ("/auth/",)


def generate_csrf_token() -> str:
    """Token URL-safe imprévisible (32 octets ≈ 256 bits)."""
    return secrets.token_urlsafe(32)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            request.method in SAFE_METHODS
            or any(path.startswith(p) for p in CSRF_EXEMPT_PREFIXES)
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
            # Log côté serveur uniquement (utile pour debug post-déploiement
            # quand un client a un cookie csrf_token périmé). Aucun détail
            # n'est renvoyé au client.
            _logger.warning(
                "CSRF rejected on %s %s — cookie=%s header=%s",
                request.method, path,
                "present" if cookie_token else "missing",
                "present" if header_token else "missing",
            )
            # Message générique : ne mentionne pas "CSRF" → ne révèle pas la défense.
            return JSONResponse(
                status_code=403,
                content={"detail": "Opération refusée."},
            )

        return await call_next(request)
