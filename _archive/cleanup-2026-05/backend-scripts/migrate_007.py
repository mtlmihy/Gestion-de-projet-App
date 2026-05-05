"""Applique la migration 007 : colonne token_version (révocation JWT).

Usage : python migrate_007.py
Configurer DATABASE_URL dans l'environnement si besoin.
"""
import asyncio, os, asyncpg
from pathlib import Path

DEFAULT_URL = "postgresql://postgres:postgres@localhost:5432/AppGDP"
SQL_FILE = Path(__file__).parent / "app" / "db" / "migrations" / "007_token_version.sql"


async def run():
    url = os.environ.get("DATABASE_URL", DEFAULT_URL)
    sql = SQL_FILE.read_text(encoding="utf-8")
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(sql)
        print("Migration 007 OK — colonne token_version ajoutée.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
