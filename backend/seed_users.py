"""
Script de seeding — crée les utilisateurs initiaux dans la base.

Usage :
    cd backend
    python seed_users.py

Utilisateurs créés :
  admin@projet.local  / Admin2026!   → administrateur global
  alice@projet.local  / Test2026!    → chef de projet (test)
  bob@projet.local    / Test2026!    → développeur (test)
"""
import asyncio
import asyncpg
import bcrypt

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/AppGDP"

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

USERS = [
    {
        "email":    "admin@projet.local",
        "nom":      "Administrateur",
        "poste":    "Administrateur système",
        "password": "Admin2026!",
        "is_admin": True,
    },
    {
        "email":    "alice@projet.local",
        "nom":      "Alice Martin",
        "poste":    "Chef de projet",
        "password": "Test2026!",
        "is_admin": False,
    },
    {
        "email":    "bob@projet.local",
        "nom":      "Bob Dupont",
        "poste":    "Développeur",
        "password": "Test2026!",
        "is_admin": False,
    },
]


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL)

    # Appliquer la migration 002 si pas encore faite
    await conn.execute("""
        ALTER TABLE utilisateurs
            ADD COLUMN IF NOT EXISTS is_admin  BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    """)
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs (email);"
    )

    for u in USERS:
        hashed = hash_password(u["password"])
        await conn.execute(
            """
            INSERT INTO utilisateurs (id, email, nom, poste, mot_de_passe, is_admin, is_active)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, TRUE)
            ON CONFLICT (email) DO UPDATE
                SET nom=$2, poste=$3, mot_de_passe=$4, is_admin=$5, is_active=TRUE
            """,
            u["email"], u["nom"], u["poste"], hashed, u["is_admin"],
        )
        role = "ADMIN" if u["is_admin"] else "utilisateur"
        print(f"  ✓  {u['email']}  [{role}]  → mdp : {u['password']}")

    await conn.close()
    print("\nSeeding terminé.")


if __name__ == "__main__":
    asyncio.run(main())
