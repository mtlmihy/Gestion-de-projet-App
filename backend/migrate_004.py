import asyncio, asyncpg

async def run():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/AppGDP')
    await conn.execute('ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS peut_creer_projet BOOLEAN NOT NULL DEFAULT FALSE')
    await conn.execute("UPDATE utilisateurs SET peut_creer_projet=TRUE WHERE email='alice@projet.local'")
    await conn.close()
    print('Migration 004 OK')

asyncio.run(run())
