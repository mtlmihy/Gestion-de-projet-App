"""
Point d'entrée racine pour Vercel et autres déploiements.
Importe et expose l'app FastAPI définie dans app/main.py.
"""
from app.main import app

__all__ = ["app"]
