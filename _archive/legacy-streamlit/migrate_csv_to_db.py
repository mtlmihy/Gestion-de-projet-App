"""
Script de migration : CSV/JSON data/ -> PostgreSQL (nouveau schema)
====================================================================
Lit les fichiers locaux dans data/ et les insere dans la base AppGDP
en les rattachant au projet par defaut ("Projet Principal").

Idempotent : ne reinsere pas les lignes deja presentes (verifie par nom).

Usage :
    python migrate_csv_to_db.py
"""

import asyncio
import csv
import json
import uuid
import os

import asyncpg

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_URL   = 'postgresql://postgres:postgres@localhost:5432/AppGDP'

PROBA_SCORE  = {'Faible': 1, 'Moyenne': 2, 'Elevee': 3, 'Élevée': 3}
IMPACT_SCORE = {'Faible': 1, 'Moyen': 2, 'Eleve': 3, 'Élevé': 3}


def read_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, newline='', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


async def migrate():
    conn = await asyncpg.connect(DB_URL)

    # -- 0. Ajouter la colonne jalon aux taches si absente ----------------
    await conn.execute(
        "ALTER TABLE taches ADD COLUMN IF NOT EXISTS jalon VARCHAR(255) DEFAULT ''"
    )
    print("Colonne taches.jalon : OK")

    # -- 1. Projet par defaut ---------------------------------------------
    projet = await conn.fetchrow(
        "SELECT id FROM projets WHERE nom = 'Projet Principal' LIMIT 1"
    )
    if projet:
        projet_id = str(projet['id'])
        print(f"Projet existant  : {projet_id}")
    else:
        projet_id = str(uuid.uuid4())
        await conn.execute(
            "INSERT INTO projets (id, nom, statut) VALUES ($1::uuid, 'Projet Principal', 'En cours')",
            projet_id
        )
        print(f"Projet cree      : {projet_id}")

    # -- 2. CDC (cahier_des_charges.json -> contenu TEXT) -----------------
    cdc_path = os.path.join(DATA_DIR, 'cahier_des_charges.json')
    if os.path.exists(cdc_path):
        with open(cdc_path, encoding='utf-8') as f:
            cdc_data = json.load(f)
        contenu_str = json.dumps(cdc_data, ensure_ascii=False, indent=2)
        existing = await conn.fetchrow(
            "SELECT id FROM cdc WHERE projet_id = $1::uuid", projet_id
        )
        if existing:
            await conn.execute(
                "UPDATE cdc SET contenu=$1, derniere_maj=NOW() WHERE projet_id=$2::uuid",
                contenu_str, projet_id
            )
            print("CDC              : mis a jour")
        else:
            await conn.execute(
                "INSERT INTO cdc (id, projet_id, contenu, derniere_maj) "
                "VALUES ($1::uuid,$2::uuid,$3,NOW())",
                str(uuid.uuid4()), projet_id, contenu_str
            )
            print("CDC              : insere")
    else:
        print("CDC              : cahier_des_charges.json introuvable")

    # -- 3. Equipe --------------------------------------------------------
    equipe_csv = read_csv('equipe_completions.csv')
    nb_equipe = 0
    for row in equipe_csv:
        collaborateur = (row.get('Collaborateur') or '').strip()
        if not collaborateur:
            continue
        exists = await conn.fetchrow(
            "SELECT id FROM equipe WHERE projet_id=$1::uuid AND collaborateur=$2",
            projet_id, collaborateur
        )
        if exists:
            continue
        await conn.execute(
            "INSERT INTO equipe (id, projet_id, collaborateur, poste, manager, numero, email) "
            "VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7)",
            str(uuid.uuid4()), projet_id,
            collaborateur,
            (row.get('Poste') or '').strip(),
            (row.get('Manager') or '').strip(),
            (row.get('Numero') or row.get('Numéro') or '').strip(),
            (row.get('Email') or '').strip(),
        )
        nb_equipe += 1
    print(f"Equipe           : {nb_equipe} inseres / {len(equipe_csv)} dans le CSV")

    # -- 4. Risques -------------------------------------------------------
    risques_csv = read_csv('registre_risques.csv')
    nb_risques = 0
    for row in risques_csv:
        nom = (row.get('Identifiant') or '').strip()
        if not nom:
            continue
        exists = await conn.fetchrow(
            "SELECT id FROM risques WHERE projet_id=$1::uuid AND nom=$2",
            projet_id, nom
        )
        if exists:
            continue
        probabilite = (row.get('Probabilité') or row.get('Probabilite') or 'Faible').strip()
        impact      = (row.get('Impact') or 'Faible').strip()
        try:
            priorite = int(row.get('Priorité') or row.get('Priorite') or 1)
        except (ValueError, TypeError):
            priorite = 1
        ps   = PROBA_SCORE.get(probabilite, 1)
        is_  = IMPACT_SCORE.get(impact, 1)
        gravite = min(5, max(1, round(ps * is_ * 5 / 9)))
        await conn.execute(
            "INSERT INTO risques "
            "(id, projet_id, nom, description, categorie, probabilite, impact, "
            " priorite, responsable, attenuation, statut, gravite) "
            "VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
            str(uuid.uuid4()), projet_id,
            nom,
            (row.get('Description') or '').strip(),
            (row.get('Catégorie') or row.get('Categorie') or '').strip(),
            probabilite,
            impact,
            priorite,
            (row.get('Responsable') or '').strip(),
            (row.get('Atténuation') or row.get('Attenuation') or '').strip(),
            (row.get('Statut') or 'Ouvert').strip(),
            gravite,
        )
        nb_risques += 1
    print(f"Risques          : {nb_risques} inseres / {len(risques_csv)} dans le CSV")

    # -- 5. Taches --------------------------------------------------------
    taches_csv = read_csv('suivi_taches.csv')
    nb_taches = 0
    for row in taches_csv:
        nom = (row.get('Nom') or '').strip()
        if not nom:
            continue
        exists = await conn.fetchrow(
            "SELECT id FROM taches WHERE projet_id=$1::uuid AND nom=$2",
            projet_id, nom
        )
        if exists:
            continue
        try:
            avancement = int(row.get('Avancement') or 0)
        except (ValueError, TypeError):
            avancement = 0
        statut = (row.get('Statut') or '').strip()
        if not statut:
            statut = 'Terminee' if avancement == 100 else ('En cours' if avancement > 0 else 'A faire')
        await conn.execute(
            "INSERT INTO taches "
            "(id, projet_id, nom, description, importance, avancement, "
            " assigne_a, jalon, statut, echeance) "
            "VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10)",
            str(uuid.uuid4()), projet_id,
            nom,
            (row.get('Description') or '').strip(),
            (row.get('Importance') or 'Moyenne').strip(),
            avancement,
            (row.get('Assigné') or row.get('Assigne') or '').strip(),
            (row.get('Jalon') or '').strip(),
            statut,
            None,  # echeance absent du CSV
        )
        nb_taches += 1
    print(f"Taches           : {nb_taches} inserees / {len(taches_csv)} dans le CSV")

    await conn.close()
    print("\nMigration terminee avec succes !")


if __name__ == '__main__':
    asyncio.run(migrate())
CSV_RISQUES = BASE / "data" / "registre_risques.csv"
CSV_TACHES  = BASE / "data" / "suivi_taches.csv"
CSV_EQUIPE  = BASE / "data" / "equipe_completions.csv"
JSON_CDC    = BASE / "data" / "cahier_des_charges.json"


# ── Fonctions de migration ────────────────────────────────────────────────────

def migrate_risques(conn):
    """Importe registre_risques.csv dans la table risques."""
    if not CSV_RISQUES.exists():
        print("  [SKIP] registre_risques.csv introuvable")
        return 0
    df = pd.read_csv(CSV_RISQUES, encoding="utf-8-sig")
    df["id"] = [str(uuid.uuid4()) for _ in range(len(df))]
    rows = [
        (
            str(r["id"]),
            str(r.get("Identifiant", "")),
            str(r.get("Description", "")),
            str(r.get("Catégorie", "")),
            str(r.get("Probabilité", "")),
            str(r.get("Impact", "")),
            int(r.get("Priorité", 1)),
            str(r.get("Responsable", "")),
            str(r.get("Atténuation", "")),
            str(r.get("Statut", "")),
        )
        for _, r in df.iterrows()
    ]
    import psycopg2.extras
    with conn.cursor() as cur:
        cur.execute("DELETE FROM risques")
        if rows:
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO risques "
                "(id, identifiant, description, categorie, probabilite, "
                "impact, priorite, responsable, attenuation, statut) VALUES %s",
                rows,
            )
    conn.commit()
    return len(rows)


def migrate_taches(conn):
    """Importe suivi_taches.csv dans la table taches."""
    if not CSV_TACHES.exists():
        print("  [SKIP] suivi_taches.csv introuvable")
        return 0
    df = pd.read_csv(CSV_TACHES, encoding="utf-8-sig")
    df["id"] = [str(uuid.uuid4()) for _ in range(len(df))]
    if "Jalon" not in df.columns:
        df["Jalon"] = ""
    rows = [
        (
            str(r["id"]),
            str(r.get("Nom", "")),
            str(r.get("Description", "")),
            str(r.get("Importance", "")),
            int(r.get("Avancement", 0)),
            str(r.get("Assigné", "")),
            str(r.get("Jalon", "")),
        )
        for _, r in df.iterrows()
    ]
    import psycopg2.extras
    with conn.cursor() as cur:
        cur.execute("DELETE FROM taches")
        if rows:
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO taches "
                "(id, nom, description, importance, avancement, assigne, jalon) VALUES %s",
                rows,
            )
    conn.commit()
    return len(rows)


def migrate_equipe(conn):
    """Importe equipe_completions.csv dans la table equipe."""
    if not CSV_EQUIPE.exists():
        print("  [SKIP] equipe_completions.csv introuvable")
        return 0
    df = pd.read_csv(CSV_EQUIPE, encoding="utf-8-sig")
    df["id"] = [str(uuid.uuid4()) for _ in range(len(df))]
    for col in ["Collaborateur", "Poste", "Manager", "Numéro", "Email"]:
        if col not in df.columns:
            df[col] = ""
        df[col] = df[col].fillna("").astype(str)
    rows = [
        (
            str(r["id"]),
            str(r.get("Collaborateur", "")),
            str(r.get("Poste", "")),
            str(r.get("Manager", "")),
            str(r.get("Numéro", "")),
            str(r.get("Email", "")),
        )
        for _, r in df.iterrows()
    ]
    import psycopg2.extras
    with conn.cursor() as cur:
        cur.execute("DELETE FROM equipe")
        if rows:
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO equipe "
                "(id, collaborateur, poste, manager, numero, email) VALUES %s",
                rows,
            )
    conn.commit()
    return len(rows)


def migrate_cdc(conn):
    """Importe cahier_des_charges.json dans la table cahier_des_charges."""
    if not JSON_CDC.exists():
        print("  [SKIP] cahier_des_charges.json introuvable")
        return False
    data = json.loads(JSON_CDC.read_text(encoding="utf-8"))
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cahier_des_charges (id, data, updated_at)
            VALUES (1, %s, NOW())
            ON CONFLICT (id) DO UPDATE
                SET data = EXCLUDED.data, updated_at = NOW()
            """,
            (json.dumps(data, ensure_ascii=False),),
        )
    conn.commit()
    return True


# ── Exécution ─────────────────────────────────────────────────────────────────
# ⚠️  Ce bloc est commenté après la première exécution réussie.
#    Pour ré-importer, décommentez les lignes ci-dessous.

# import psycopg2
# import db
#
# print("=== Migration CSV → PostgreSQL ===")
# if not db.use_db():
#     print("ERREUR : use_db() est False. Vérifiez .streamlit/secrets.toml et psycopg2.")
#     sys.exit(1)
#
# db.init_db()
# print("Tables vérifiées / créées.")
#
# conn = db.get_conn()
# try:
#     n = migrate_risques(conn)
#     print(f"  risques      : {n} ligne(s) importée(s)")
#     n = migrate_taches(conn)
#     print(f"  taches       : {n} ligne(s) importée(s)")
#     n = migrate_equipe(conn)
#     print(f"  equipe       : {n} ligne(s) importée(s)")
#     ok = migrate_cdc(conn)
#     print(f"  CDC JSON     : {'OK' if ok else 'ignoré'}")
#     print("\n✅ Migration terminée avec succès.")
# except Exception as exc:
#     conn.rollback()
#     print(f"\n❌ Erreur : {exc}")
#     sys.exit(1)
# finally:
#     conn.close()
