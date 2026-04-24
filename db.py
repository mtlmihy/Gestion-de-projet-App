"""
Couche d'accès PostgreSQL pour l'application Gestion de Projet.

La connexion est configurée via st.secrets["postgres"] :
    [postgres]
    host     = "..."
    port     = 5432
    dbname   = "..."
    user     = "..."
    password = "..."

Si la section [postgres] est absente, use_db() renvoie False et l'app
utilise les fichiers CSV/JSON comme fallback (développement local).
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

import pandas as pd
import streamlit as st

try:
    import psycopg2
    import psycopg2.extras
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    psycopg2 = None  # type: ignore
    _PSYCOPG2_AVAILABLE = False

# ── Détection de la configuration ────────────────────────────────────────────

def use_db() -> bool:
    """Renvoie True si psycopg2 est installé ET les secrets postgres sont configurés."""
    if not _PSYCOPG2_AVAILABLE:
        return False
    try:
        return bool(st.secrets.get("postgres"))
    except Exception:
        return False


# ── Connexion ────────────────────────────────────────────────────────────────

def get_conn():
    """Crée et renvoie une nouvelle connexion psycopg2."""
    cfg = st.secrets["postgres"]
    return psycopg2.connect(
        host=str(cfg.get("host", "localhost")),
        port=int(cfg.get("port", 5432)),
        dbname=str(cfg.get("dbname", "gestion_projet")),
        user=str(cfg.get("user", "postgres")),
        password=str(cfg.get("password", "")),
        connect_timeout=10,
    )


# ── Initialisation du schéma ─────────────────────────────────────────────────

def init_db() -> None:
    """Crée toutes les tables si elles n'existent pas encore."""
    ddl = """
    CREATE TABLE IF NOT EXISTS risques (
        id              TEXT PRIMARY KEY,
        identifiant     TEXT,
        description     TEXT,
        categorie       TEXT,
        probabilite     TEXT,
        impact          TEXT,
        priorite        INTEGER,
        responsable     TEXT,
        attenuation     TEXT,
        statut          TEXT
    );

    CREATE TABLE IF NOT EXISTS taches (
        id          TEXT PRIMARY KEY,
        nom         TEXT,
        description TEXT,
        importance  TEXT,
        avancement  INTEGER,
        assigne     TEXT,
        jalon       TEXT
    );

    CREATE TABLE IF NOT EXISTS equipe (
        id            TEXT PRIMARY KEY,
        collaborateur TEXT,
        poste         TEXT,
        manager       TEXT,
        numero        TEXT,
        email         TEXT
    );

    CREATE TABLE IF NOT EXISTS cahier_des_charges (
        id         INTEGER PRIMARY KEY DEFAULT 1,
        data       JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
        conn.commit()


# ── Risques ───────────────────────────────────────────────────────────────────

_RISQUES_COLS = [
    "id", "Identifiant", "Description", "Catégorie",
    "Probabilité", "Impact", "Priorité", "Responsable", "Atténuation", "Statut",
]


def load_risques() -> pd.DataFrame:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    "SELECT id, identifiant, description, categorie, probabilite, "
                    "impact, priorite, responsable, attenuation, statut "
                    "FROM risques ORDER BY identifiant"
                )
                rows = cur.fetchall()
        if not rows:
            return pd.DataFrame(columns=_RISQUES_COLS)
        df = pd.DataFrame(rows, columns=_RISQUES_COLS)
        df["Priorité"] = pd.to_numeric(df["Priorité"], errors="coerce").fillna(1).astype(int)
        return df
    except Exception as exc:
        st.error(f"Erreur DB (chargement risques) : {exc}")
        return pd.DataFrame(columns=_RISQUES_COLS)


def save_risques(df: pd.DataFrame) -> None:
    try:
        rows = [
            (
                str(r["id"]), str(r["Identifiant"]), str(r["Description"]),
                str(r["Catégorie"]), str(r["Probabilité"]), str(r["Impact"]),
                int(r["Priorité"]), str(r["Responsable"]), str(r["Atténuation"]),
                str(r["Statut"]),
            )
            for _, r in df.iterrows()
        ]
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM risques")
                if rows:
                    psycopg2.extras.execute_values(
                        cur,
                        "INSERT INTO risques "
                        "(id, identifiant, description, categorie, probabilite, "
                        "impact, priorite, responsable, attenuation, statut) "
                        "VALUES %s",
                        rows,
                    )
            conn.commit()
    except Exception as exc:
        st.error(f"Erreur DB (sauvegarde risques) : {exc}")


# ── Tâches ────────────────────────────────────────────────────────────────────

_TACHES_COLS = ["id", "Nom", "Description", "Importance", "Avancement", "Assigné", "Jalon"]


def load_taches() -> pd.DataFrame:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    "SELECT id, nom, description, importance, avancement, assigne, jalon "
                    "FROM taches ORDER BY nom"
                )
                rows = cur.fetchall()
        if not rows:
            return pd.DataFrame(columns=_TACHES_COLS)
        df = pd.DataFrame(rows, columns=_TACHES_COLS)
        df["Avancement"] = pd.to_numeric(df["Avancement"], errors="coerce").fillna(0).astype(int)
        df["Jalon"] = df["Jalon"].fillna("")
        return df
    except Exception as exc:
        st.error(f"Erreur DB (chargement tâches) : {exc}")
        return pd.DataFrame(columns=_TACHES_COLS)


def save_taches(df: pd.DataFrame) -> None:
    try:
        rows = [
            (
                str(r["id"]), str(r["Nom"]), str(r["Description"]),
                str(r["Importance"]), int(r["Avancement"]), str(r["Assigné"]),
                str(r.get("Jalon", "")),
            )
            for _, r in df.iterrows()
        ]
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM taches")
                if rows:
                    psycopg2.extras.execute_values(
                        cur,
                        "INSERT INTO taches "
                        "(id, nom, description, importance, avancement, assigne, jalon) "
                        "VALUES %s",
                        rows,
                    )
            conn.commit()
    except Exception as exc:
        st.error(f"Erreur DB (sauvegarde tâches) : {exc}")


# ── Équipe ────────────────────────────────────────────────────────────────────

_EQUIPE_COLS = ["id", "Collaborateur", "Poste", "Manager", "Numéro", "Email"]


def load_equipe() -> pd.DataFrame:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    "SELECT id, collaborateur, poste, manager, numero, email "
                    "FROM equipe ORDER BY collaborateur"
                )
                rows = cur.fetchall()
        if not rows:
            return pd.DataFrame(columns=_EQUIPE_COLS)
        df = pd.DataFrame(rows, columns=_EQUIPE_COLS)
        for col in ["Collaborateur", "Poste", "Manager", "Numéro", "Email"]:
            df[col] = df[col].fillna("")
        return df
    except Exception as exc:
        st.error(f"Erreur DB (chargement équipe) : {exc}")
        return pd.DataFrame(columns=_EQUIPE_COLS)


def save_equipe(df: pd.DataFrame) -> None:
    try:
        rows = [
            (
                str(r["id"]), str(r["Collaborateur"]), str(r.get("Poste", "")),
                str(r.get("Manager", "")), str(r.get("Numéro", "")), str(r.get("Email", "")),
            )
            for _, r in df.iterrows()
        ]
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM equipe")
                if rows:
                    psycopg2.extras.execute_values(
                        cur,
                        "INSERT INTO equipe (id, collaborateur, poste, manager, numero, email) "
                        "VALUES %s",
                        rows,
                    )
            conn.commit()
    except Exception as exc:
        st.error(f"Erreur DB (sauvegarde équipe) : {exc}")


# ── Cahier des Charges ────────────────────────────────────────────────────────

def load_cdc() -> Optional[dict]:
    """Renvoie le dict CDC ou None si absent."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT data FROM cahier_des_charges WHERE id = 1")
                row = cur.fetchone()
        if row and row[0]:
            return row[0]  # psycopg2 désérialise JSONB automatiquement
        return None
    except Exception as exc:
        st.error(f"Erreur DB (chargement CDC) : {exc}")
        return None


def save_cdc(data: dict) -> None:
    """Upsert du cahier des charges (toujours une seule ligne, id=1)."""
    try:
        with get_conn() as conn:
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
    except Exception as exc:
        st.error(f"Erreur DB (sauvegarde CDC) : {exc}")


def load_cdc_raw() -> Optional[bytes]:
    """Renvoie le CDC sérialisé en bytes (pour le serveur HTTP)."""
    data = load_cdc()
    if data is None:
        return None
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def cdc_version_hash() -> str:
    """Renvoie un hash court pour la détection de changement."""
    import hashlib
    raw = load_cdc_raw() or b""
    return hashlib.sha256(raw).hexdigest()[:16]
