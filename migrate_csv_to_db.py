"""
Script de migration unique : CSV/JSON → PostgreSQL
====================================================
Lance ce script UNE SEULE FOIS pour importer les données locales dans la DB.
Une fois exécuté avec succès, le bloc d'exécution en bas est commenté
pour éviter d'écraser les données existantes.

Usage :
    python migrate_csv_to_db.py
"""

import json
import sys
import uuid
from pathlib import Path

import pandas as pd

# ── Chemins ───────────────────────────────────────────────────────────────────
BASE      = Path(__file__).parent
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
