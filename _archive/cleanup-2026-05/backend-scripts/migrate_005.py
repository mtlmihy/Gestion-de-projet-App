"""Applique la migration 005 : table projet_liens.

Usage : python migrate_005.py
Configurer DATABASE_URL dans l'environnement si besoin (sinon valeur locale par défaut).
"""
import asyncio, os, asyncpg
from pathlib import Path

DEFAULT_URL = "postgresql://postgres:postgres@localhost:5432/AppGDP"
SQL_FILE = Path(__file__).parent / "app" / "db" / "migrations" / "005_liens_projet.sql"


async def run():
    url = os.environ.get("DATABASE_URL", DEFAULT_URL)
    sql = SQL_FILE.read_text(encoding="utf-8")
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(sql)
        print("Migration 005 OK — table projet_liens prête.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
