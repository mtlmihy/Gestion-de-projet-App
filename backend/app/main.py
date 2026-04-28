from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.pool import init_pool, close_pool
from app.auth.router import router as auth_router
from app.users.router import router as users_router, _public_router as users_public_router
from app.projets.router import router as projets_router
from app.risques.router import router as risques_router
from app.taches.router import router as taches_router
from app.equipe.router import router as equipe_router
from app.cdc.router import router as cdc_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise le pool de connexions DB au démarrage, le ferme à l'arrêt."""
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Gestion de Projet — API",
    description="Backend FastAPI pour l'application de gestion de projet.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# allow_credentials=True est requis pour que les cookies HttpOnly (JWT) soient
# transmis entre le frontend Vue (localhost:5173) et l'API (localhost:8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health", tags=["Infra"])
async def health_check():
    """Endpoint de supervision — retourne 200 si l'API est en ligne."""
    return {"status": "ok"}
