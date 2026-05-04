"""Applique la migration 008 : table audit_log.

Usage : python migrate_008.py
"""
import asyncio, os, asyncpg
from pathlib import Path

DEFAULT_URL = "postgresql://postgres:postgres@localhost:5432/AppGDP"
SQL_FILE = Path(__file__).parent / "app" / "db" / "migrations" / "008_audit_log.sql"


async def run():
    url = os.environ.get("DATABASE_URL", DEFAULT_URL)
    sql = SQL_FILE.read_text(encoding="utf-8")
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(sql)
        print("Migration 008 OK — table audit_log prête.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
