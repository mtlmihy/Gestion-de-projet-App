from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.db.pool import init_pool, close_pool
from app.auth.csrf import CSRFMiddleware
from app.auth.router import router as auth_router
from app.users.router import router as users_router, _public_router as users_public_router
from app.projets.router import router as projets_router
from app.risques.router import router as risques_router
from app.taches.router import router as taches_router
from app.equipe.router import router as equipe_router
from app.cdc.router import router as cdc_router
from app.liens.router import router as liens_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise le pool de connexions DB au démarrage, le ferme à l'arrêt."""
    await init_pool()
    yield
    await close_pool()


# ── Rate limiter (anti brute-force) ───────────────────────────────────────────
# Identifie l'appelant par IP. Derrière un proxy (Render), X-Forwarded-For est
# géré automatiquement par get_remote_address si Uvicorn est lancé avec
# --proxy-headers (cas par défaut).
limiter = Limiter(key_func=get_remote_address, default_limits=[])


# ── Application ───────────────────────────────────────────────────────────────
# En production : on désactive Swagger / ReDoc / openapi.json pour ne pas
# exposer le schéma complet de l'API à un attaquant.
_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if settings.is_production
    else {}
)

app = FastAPI(
    title="Gestion de Projet — API",
    description="Backend FastAPI pour l'application de gestion de projet.",
    version="1.0.0",
    lifespan=lifespan,
    **_docs_kwargs,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Headers de sécurité HTTP ──────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Ajoute les en-têtes HTTP de sécurité recommandés par OWASP.
    HSTS n'est ajouté qu'en production (sinon casse le dev sur http://).
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)


# ── CORS ──────────────────────────────────────────────────────────────────────
# allow_credentials=True est requis pour que les cookies HttpOnly (JWT) soient
# transmis entre le frontend (Vercel) et l'API (Render).
# On liste explicitement les méthodes et headers attendus (durcissement).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-CSRF-Token"],
    max_age=600,
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router,         prefix="/auth",    tags=["Auth"])
app.include_router(users_public_router, prefix="/users",   tags=["Utilisateurs"])
app.include_router(users_router,        prefix="/users",   tags=["Utilisateurs"])
app.include_router(projets_router, prefix="/projets", tags=["Projets"])
app.include_router(risques_router, prefix="/risques", tags=["Risques"])
app.include_router(taches_router,  prefix="/taches",  tags=["Tâches"])
app.include_router(equipe_router,  prefix="/equipe",  tags=["Équipe"])
app.include_router(cdc_router,     prefix="/cdc",     tags=["Cahier des Charges"])
app.include_router(liens_router,                      tags=["Liens externes"])


@app.get("/health", tags=["Infra"])
async def health_check():
    """Endpoint de supervision — retourne 200 si l'API est en ligne."""
    return {"status": "ok"}
