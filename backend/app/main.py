from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


# ── Sentry (optionnel) ────────────────────────────────────────────────────────
# Activé uniquement si SENTRY_DSN est défini en env. Doit être initialisé
# AVANT la création de l'app FastAPI pour capturer les erreurs de démarrage.
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.env,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,           # ne pas envoyer cookies, IP, etc. par défaut
        integrations=[FastApiIntegration(), StarletteIntegration()],
    )


from app.db.pool import init_pool, close_pool
from app.auth.csrf import CSRFMiddleware
from app.security.tarpit import TarpitMiddleware
from app.auth.router import router as auth_router
from app.users.router import router as users_router, _public_router as users_public_router
from app.projets.router import router as projets_router
from app.risques.router import router as risques_router
from app.taches.router import router as taches_router
from app.copils.router import router as copils_router
from app.equipe.router import router as equipe_router
from app.cdc.router import router as cdc_router
from app.liens.router import router as liens_router
from app.raci.router import router as raci_router
from app.budget.router import router as budget_router


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
    title="Gestion de Projet - API",
    description="Backend FastAPI pour l'application de gestion de projet.",
    version="1.0.0",
    lifespan=lifespan,
    **_docs_kwargs,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Headers de sécurité HTTP ──────────────────────────────────────────────────
# Stratégie « zero-information » : on retire tous les en-têtes qui révèlent la
# stack (Server, X-Powered-By, Via). On ajoute les en-têtes OWASP + une CSP
# stricte qui n'est appliquée qu'aux réponses HTML (l'API renvoie du JSON).
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Retire toute info sur la pile technique
        for h in ("server", "x-powered-by", "via", "x-aspnet-version"):
            if h in response.headers:
                del response.headers[h]
        # En-têtes OWASP de base
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        # API JSON only - pas de scripts à autoriser, on bloque tout.
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
        # En-tête générique non identifiant
        response.headers["Server"] = "web"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
            # Cache désactivé pour toute réponse API (évite leak via cache)
            response.headers.setdefault("Cache-Control", "no-store")
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
# Tarpit en *dernier* dans add_middleware = *premier* dans la chaîne de
# traitement (Starlette empile dans l'ordre inverse). Il voit donc le
# status code final de la réponse, y compris ceux posés par CSRF/exception
# handlers, et peut appliquer son délai avant qu'aucun travail coûteux ne
# soit fait sur la prochaine requête.
app.add_middleware(TarpitMiddleware)


# ── Handler global 500 - réponse opaque ───────────────────────────────────────
# Empêche FastAPI de renvoyer une stack trace ou un message technique en cas
# d'erreur non gérée. L'erreur réelle reste loggée côté serveur (Sentry/Render).
from fastapi.exceptions import RequestValidationError  # noqa: E402
from starlette.exceptions import HTTPException as StarletteHTTPException  # noqa: E402
import logging  # noqa: E402

_logger = logging.getLogger("app")


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    # Log côté serveur uniquement
    _logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erreur interne."})


@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    # En prod, on neutralise les messages détaillés des 4xx/5xx serveur-side
    # qui pourraient renseigner un attaquant (ex: "Membre introuvable" vs "Projet introuvable").
    if settings.is_production and exc.status_code in (401, 403, 404):
        # Réponse uniforme : pas d'indice sur la cause
        generic = {
            401: "Authentification requise.",
            403: "Accès refusé.",
            404: "Ressource introuvable.",
        }[exc.status_code]
        return JSONResponse(status_code=exc.status_code, content={"detail": generic})
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail if isinstance(exc.detail, str) else "Erreur."},
        headers=getattr(exc, "headers", None) or {},
    )


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    # En prod : message générique (ne révèle pas la structure attendue).
    if settings.is_production:
        return JSONResponse(status_code=422, content={"detail": "Requête invalide."})
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


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
app.include_router(copils_router,  prefix="/copils",  tags=["COPIL"])
app.include_router(equipe_router,  prefix="/equipe",  tags=["Équipe"])
app.include_router(cdc_router,     prefix="/cdc",     tags=["Cahier des Charges"])
app.include_router(liens_router,                      tags=["Liens externes"])
app.include_router(raci_router,    prefix="/raci",    tags=["RACI"])
app.include_router(budget_router,  prefix="/budget",  tags=["Budget"])


@app.get("/health", include_in_schema=False)
async def health_check():
    # Réponse minimale : 204 No Content. Aucun corps, aucune info.
    # Render/Azure n'ont besoin que d'un 2xx pour le healthcheck.
    from fastapi import Response as _Resp
    return _Resp(status_code=204)


# ── Catch-all 404 ──────────────────────────────────────────────────────────────
# Toute requête sur un chemin inconnu (fuzzing, scan de routes /admin,
# /.env, /wp-login.php, etc.) renvoie le même 404 générique que les vraies
# routes inexistantes → indistinguable. Cumulé au tarpit, fuzzer devient
# très lent et improductif.
@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
async def _catch_all(full_path: str):
    return JSONResponse(status_code=404, content={"detail": "Ressource introuvable."})
