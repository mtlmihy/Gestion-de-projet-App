import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import uuid
import json
import io
import zipfile
import hashlib
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from datetime import date

import db as _db

DATA_DIR        = Path(__file__).parent / "data"
ASSETS_DIR      = Path(__file__).parent / "assets"
# Chemins CSV/JSON conservés comme fallback si PostgreSQL n'est pas configuré
CSV_PATH        = DATA_DIR / "registre_risques.csv"
TACHES_CSV_PATH = DATA_DIR / "suivi_taches.csv"
CDC_JSON_PATH   = DATA_DIR / "cahier_des_charges.json"
EQUIPE_CSV_PATH = DATA_DIR / "equipe_completions.csv"
DATA_DIR.mkdir(exist_ok=True)

# Initialisation de la DB (une seule fois par session serveur)
@st.cache_resource
def _init_db_once():
    if _db.use_db():
        try:
            _db.init_db()
        except Exception as exc:
            st.warning(f"Impossible d'initialiser la DB : {exc}")
_init_db_once()


# ── Serveur HTTP local pour la sauvegarde du CDC ─────────────────────────────
class _CDCSaveHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/cdc_version":
            try:
                if _db.use_db():
                    body = _db.cdc_version_hash().encode()
                else:
                    raw = CDC_JSON_PATH.read_bytes() if CDC_JSON_PATH.exists() else b""
                    body = hashlib.sha256(raw).hexdigest()[:16].encode()
            except Exception:
                body = b"error"
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/cdc_data":
            try:
                if _db.use_db():
                    raw = _db.load_cdc_raw()
                    body = raw if raw is not None else b"null"
                else:
                    body = CDC_JSON_PATH.read_bytes() if CDC_JSON_PATH.exists() else b"null"
            except Exception:
                body = b"null"
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    def do_POST(self):
        if self.path == "/save_cdc":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                if _db.use_db():
                    _db.save_cdc(data)
                else:
                    CDC_JSON_PATH.write_text(
                        json.dumps(data, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(b"OK")
            except Exception as exc:
                self.send_response(500)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(str(exc).encode())
        else:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

    def log_message(self, format, *args):  # noqa: A002
        pass


@st.cache_resource
def _get_cdc_save_port() -> int:
    try:
        srv = HTTPServer(("127.0.0.1", 0), _CDCSaveHandler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return port
    except Exception:
        return 0


def sauvegarder():
    if _db.use_db():
        _db.save_risques(st.session_state.risques)
    else:
        st.session_state.risques.drop(columns=["id"]).to_csv(CSV_PATH, index=False, encoding="utf-8-sig")


def sauvegarder_taches():
    if _db.use_db():
        _db.save_taches(st.session_state.taches)
    else:
        st.session_state.taches.drop(columns=["id"]).to_csv(TACHES_CSV_PATH, index=False, encoding="utf-8-sig")


def sauvegarder_equipe():
    if _db.use_db():
        _db.save_equipe(st.session_state.equipe)
    else:
        st.session_state.equipe.drop(columns=["id"]).to_csv(EQUIPE_CSV_PATH, index=False, encoding="utf-8-sig")


def creer_zip_sauvegarde() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # CSVs depuis le session_state (données les plus à jour)
        zf.writestr(
            "data/registre_risques.csv",
            st.session_state.risques.drop(columns=["id"]).to_csv(index=False, encoding="utf-8-sig"),
        )
        zf.writestr(
            "data/suivi_taches.csv",
            st.session_state.taches.drop(columns=["id"]).to_csv(index=False, encoding="utf-8-sig"),
        )
        zf.writestr(
            "data/equipe_completions.csv",
            st.session_state.equipe.drop(columns=["id"]).to_csv(index=False, encoding="utf-8-sig"),
        )
        # JSON cahier des charges
        if _db.use_db():
            _cdc_raw = _db.load_cdc_raw()
            if _cdc_raw:
                zf.writestr("data/cahier_des_charges.json", _cdc_raw)
        elif CDC_JSON_PATH.exists():
            zf.write(CDC_JSON_PATH, arcname="data/cahier_des_charges.json")
    return buf.getvalue()

# ── Configuration ────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Registre des Risques",
    page_icon=":material/shield:",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ── Authentification ──────────────────────────────────────────────────────────
def check_password():
    if st.session_state.get("authenticated"):
        return

    # Si aucun mot de passe n'est configuré, l'authentification est désactivée
    expected_hash = st.secrets.get("PASSWORD_HASH", "")
    if not expected_hash:
        st.session_state.authenticated = True
        return

    # Validation via le token passé dans l'URL (persisté à travers les navigations JS)
    auth_param = st.query_params.get("auth", "")
    if auth_param and auth_param == expected_hash:
        st.session_state.authenticated = True
        return

    st.markdown(
        """
        <style>
        [data-testid="stSidebar"] { display: none; }
        </style>
        """,
        unsafe_allow_html=True,
    )

    col1, col2, col3 = st.columns([1, 1.2, 1])
    with col2:
        st.markdown("## 🔒 Accès protégé")
        pwd = st.text_input("Mot de passe", type="password", key="_pwd_input")
        if st.button("Se connecter", use_container_width=True):
            pwd_hash = hashlib.sha256(pwd.encode()).hexdigest()
            if pwd_hash == expected_hash:
                st.session_state.authenticated = True
                # Stocker le hash dans l'URL pour persister à travers les rechargements
                st.query_params["auth"] = pwd_hash
                if "page" not in st.query_params:
                    st.query_params["page"] = "risques"
                st.rerun()
            else:
                st.error("Mot de passe incorrect.")
    st.stop()


check_password()


CATEGORIES = ["Opérations", "Budget", "Planning", "Technologie", "Sécurité", "Financier", "Ressources humaines", "Conformité", "Scope", "Communication", "Qualité", "Changement"]
PROBABILITES = ["Faible", "Moyenne", "Élevée"]
IMPACTS = ["Faible", "Moyen", "Élevé"]
STATUTS = ["Ouvert", "En cours", "Fermé"]
PRIORITES = [1, 2, 3]
COLONNES = ["id", "Identifiant", "Description", "Catégorie", "Probabilité", "Impact", "Priorité", "Responsable", "Atténuation", "Statut",
]
PAGES = ["Registre des Risques", "Suivi des Tâches", "Planning", "Cahier des Charges", "Équipe", "Aide Pilotage"]

_PROBA_SCORE = {"Faible": 1, "Moyenne": 2, "Élevée": 3}
_IMPACT_SCORE = {"Faible": 1, "Moyen": 2, "Élevé": 3}


def calculer_priorite(probabilite: str, impact: str) -> int:
    score = _PROBA_SCORE.get(probabilite, 1) * _IMPACT_SCORE.get(impact, 1)
    if score >= 6:
        return 3
    if score >= 3:
        return 2
    return 1


# ── Données tests ────────────────────────────────────────────────────────
MOCK_DATA = [
    {"id": str(uuid.uuid4()), "Identifiant": "Budget insuffisant",
    "Description": "Risque de dépassement du budget alloué",
    "Catégorie": "Financier", "Probabilité": "Moyenne", "Impact": "Élevé",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Revue mensuelle des dépenses et ajustements budgétaires", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Temps insuffisant",
    "Description": "Risque de manque de temps pour terminer les tâches",
    "Catégorie": "Planning", "Probabilité": "Élevée", "Impact": "Moyen",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Priorisation des tâches et ressources critiques", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Ressources humaines",
    "Description": "Risque de pénurie de personnel qualifié",
    "Catégorie": "Ressources humaines", "Probabilité": "Moyenne", "Impact": "Élevé",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Plan de recrutement et formation continue", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Législation",
    "Description": "Risque de non-conformité aux réglementations en vigueur",
    "Catégorie": "Conformité", "Probabilité": "Faible", "Impact": "Élevé",
    "Priorité": 3, "Responsable": "x",
    "Atténuation": "Veille réglementaire et audits réguliers", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Scope Creep",
    "Description": "Risque de dérive du périmètre du projet",
    "Catégorie": "Scope", "Probabilité": "Moyenne", "Impact": "Moyen",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Contrôle strict des changements de périmètre", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Communication",
    "Description": "Risque de mauvaise communication entre les parties prenantes",
    "Catégorie": "Communication", "Probabilité": "Moyenne", "Impact": "Moyen",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Plan de communication clair et réunions régulières", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Qualité des livrables",
    "Description": "Risque de livrables ne répondant pas aux standards de qualité",
    "Catégorie": "Qualité", "Probabilité": "Moyenne", "Impact": "Élevé",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Processus de revue et tests rigoureux", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Technologie incompatible",
    "Description": "Risque d'incompatibilité des technologies utilisées",
    "Catégorie": "Technologie", "Probabilité": "Faible", "Impact": "Moyen",
    "Priorité": 3, "Responsable": "x",
    "Atténuation": "Évaluation technologique et tests de compatibilité", "Statut": "Ouvert"},
    
    {"id": str(uuid.uuid4()), "Identifiant": "Resistance au changement",
    "Description": "Risque de résistance des employés aux changements",
    "Catégorie": "Changement", "Probabilité": "Élevée", "Impact": "Moyen",
    "Priorité": 2, "Responsable": "x",
    "Atténuation": "Plan de gestion du changement (communication) et formation", "Statut": "Ouvert"}
]

# ── State : charger depuis DB (ou CSV en fallback) ───────────────────────────
if "risques" not in st.session_state:
    if _db.use_db():
        df_load = _db.load_risques()
        if df_load.empty:
            st.session_state.risques = pd.DataFrame(MOCK_DATA, columns=COLONNES)
            sauvegarder()
        else:
            st.session_state.risques = df_load
    elif CSV_PATH.exists():
        df_load = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
        df_load["id"] = [str(uuid.uuid4()) for _ in range(len(df_load))]
        st.session_state.risques = df_load[[c for c in COLONNES if c in df_load.columns or c == "id"]]
    else:
        st.session_state.risques = pd.DataFrame(MOCK_DATA, columns=COLONNES)
        sauvegarder()

# ── Tâches : constantes et state ─────────────────────────────────────────────
IMPORTANCES = ["Faible", "Moyenne", "Élevée", "Critique"]
TACHE_COLONNES = ["id", "Nom", "Description", "Importance", "Avancement", "Assigné", "Jalon"]
EQUIPE_COLONNES = ["id", "Collaborateur", "Poste", "Manager", "Numéro", "Email"]

if "taches" not in st.session_state:
    if _db.use_db():
        df_t = _db.load_taches()
        st.session_state.taches = df_t if not df_t.empty else pd.DataFrame(columns=TACHE_COLONNES)
    elif TACHES_CSV_PATH.exists():
        df_t = pd.read_csv(TACHES_CSV_PATH, encoding="utf-8-sig")
        df_t["id"] = [str(uuid.uuid4()) for _ in range(len(df_t))]
        if "Jalon" not in df_t.columns:
            df_t["Jalon"] = ""
        st.session_state.taches = df_t[[c for c in TACHE_COLONNES if c in df_t.columns or c == "id"]]
    else:
        st.session_state.taches = pd.DataFrame(columns=TACHE_COLONNES)
        sauvegarder_taches()

if "equipe" not in st.session_state:
    if _db.use_db():
        df_equipe = _db.load_equipe()
        st.session_state.equipe = df_equipe if not df_equipe.empty else pd.DataFrame(columns=EQUIPE_COLONNES)
    elif EQUIPE_CSV_PATH.exists():
        df_equipe = pd.read_csv(EQUIPE_CSV_PATH, encoding="utf-8-sig")
        df_equipe["id"] = [str(uuid.uuid4()) for _ in range(len(df_equipe))]
        st.session_state.equipe = df_equipe[[c for c in EQUIPE_COLONNES if c in df_equipe.columns or c == "id"]]
        for _col in ["Collaborateur", "Poste", "Manager", "Numéro", "Email"]:
            if _col not in st.session_state.equipe.columns:
                st.session_state.equipe[_col] = ""
    else:
        st.session_state.equipe = pd.DataFrame(columns=EQUIPE_COLONNES)
        sauvegarder_equipe()

# ── Sélection depuis le tableau ──────────────────────────────────────────────
if "selected_risque_id" not in st.session_state:
    st.session_state.selected_risque_id = None
if "selected_tache_id" not in st.session_state:
    st.session_state.selected_tache_id = None
if "page_active" not in st.session_state:
    st.session_state.page_active = PAGES[0]
# Ces deux flags pilotent l'ouverture automatique des formulaires d'ajout
# lors d'un clic sur le bouton flottant "+" en bas de page.
if "open_add_risque" not in st.session_state:
    st.session_state.open_add_risque = False
if "open_add_tache" not in st.session_state:
    st.session_state.open_add_tache = False


# ── Icônes SVG inline (Lucide-style) ────────────────────────────────────────
ICO = {
    "shield": '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    "download": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    "upload": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    "plus": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    "chart": '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    "search": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    "edit": '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    "save": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    "trash": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    "tasks": '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
}


# ── CSS compatible thème clair ET sombre ─────────────────────────────────────
st.markdown("""
<style>
/* Icônes SVG inline */
.ico { display: inline-flex; align-items: center; vertical-align: middle; margin-right: 6px; }
.section-title { display: flex; align-items: center; gap: 8px; margin: 0; }
.section-title svg { flex-shrink: 0; }

/* Badges — couleurs fixes, lisibles dans tous les thèmes */
.badge {
    display: inline-block; padding: 3px 14px; border-radius: 20px;
    font-size: 0.82rem; font-weight: 600; text-align: center; min-width: 70px;
}
.badge-green  { background: #d1fae5; color: #065f46; }
.badge-orange { background: #ffedd5; color: #9a3412; }
.badge-red    { background: #ffe4e6; color: #9f1239; }
.badge-blue   { background: #dbeafe; color: #1e40af; }
.badge-gray   { background: #e2e8f0; color: #334155; }
.badge-purple { background: #ede9fe; color: #5b21b6; }

/* Priorité circulaire */
.prio {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 50%;
    font-weight: 700; font-size: 0.85rem; color: #fff;
}
.prio-1 { background: #22c55e; }
.prio-2 { background: #f59e0b; }
.prio-3 { background: #ef4444; }

/* Tableau — hérite les couleurs du thème Streamlit */
.risk-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.risk-table th {
    text-align: left; padding: 12px 14px; font-weight: 600;
    border-bottom: 2px solid rgba(128,128,128,0.3); font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.04em;
    opacity: 0.7;
}
.risk-table td {
    padding: 12px 14px; border-bottom: 1px solid rgba(128,128,128,0.15);
    vertical-align: middle;
}
.risk-table tr:hover td { background: rgba(128,128,128,0.08); }
.risk-table .desc { font-size: 0.78rem; opacity: 0.55; }

/* Barre de progression */
.progress-bar {
    width: 100%; height: 8px; border-radius: 4px;
    background: rgba(128,128,128,0.2); overflow: hidden;
}
.progress-bar .fill {
    height: 100%; border-radius: 4px; transition: width 0.3s;
}
.progress-bar .fill.low    { background: #ef4444; }
.progress-bar .fill.mid    { background: #f59e0b; }
.progress-bar .fill.high   { background: #22c55e; }
.progress-text { font-size: 0.8rem; font-weight: 600; margin-top: 2px; }

/* Description tronquée (hors table HTML) */
.desc { font-size: 0.78rem; opacity: 0.55; display: block; margin-top: 2px; }

/* En-tête de tableau interactif */
.table-header {
    font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; opacity: 0.55; padding-bottom: 10px;
    border-bottom: 2px solid rgba(128,128,128,0.25);
    margin-bottom: 0;
}

/* Lignes du tableau st.columns — alignement, espacement & séparateurs */
[data-testid="stHorizontalBlock"] {
    align-items: center;
    gap: 0.5rem !important;
}
/* Séparateur de ligne de tableau */
.row-sep hr {
    margin: 0; padding: 0; border: none;
    border-top: 1px solid rgba(128,128,128,0.22);
}
/* Colonnes internes : pas de padding excessif */
[data-testid="stColumn"] > div {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}
/* Markdown dans les colonnes : resserrer */
[data-testid="stColumn"] [data-testid="stMarkdown"] {
    line-height: 1.4;
}
/* Badges : centrage vertical */
.badge {
    vertical-align: middle;
}

/* Boutons action ligne */
.row-action-btn button { padding: 4px 8px !important; min-height: 0 !important; }

/* Bouton flottant d'ajout */
.st-key-floating_add button {
    position: fixed;
    right: 2rem;
    bottom: 2rem;
    z-index: 999;
    border-radius: 999px;
    width: 3rem;
    height: 3rem;
    min-height: 3rem;
    padding: 0 !important;
    font-size: 1.35rem;
    line-height: 1;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
}

.page-bottom-spacing {
    height: 5rem;
}

@media (max-width: 768px) {
    .st-key-floating_add button {
        right: 1rem;
        bottom: 1rem;
        width: 2.75rem;
        height: 2.75rem;
        min-height: 2.75rem;
    }
}
</style>
""", unsafe_allow_html=True)


# ── Helpers badges ───────────────────────────────────────────────────────────
def _badge(val, mapping):
    cls = mapping.get(val, "badge-gray")
    return f'<span class="badge {cls}">{val}</span>'

def badge_proba(v):
    return _badge(v, {"Faible": "badge-green", "Moyenne": "badge-orange", "Élevée": "badge-red"})

def badge_impact(v):
    return _badge(v, {"Faible": "badge-green", "Moyen": "badge-orange", "Élevé": "badge-red"})

def badge_statut(v):
    """Retourne le HTML d'un badge coloré pour le statut d'un risque.

    La convention couleur est inversée par rapport aux badges priorité :
    "Ouvert" est rouge (alerte), "Fermé" est vert (résolu).

    Args:
        v: Valeur parmi {"Ouvert", "En cours", "Fermé"}.

    Returns:
        str: Fragment HTML du badge (rouge / orange / vert).
    """
    return _badge(v, {"Ouvert": "badge-red", "En cours": "badge-orange", "Fermé": "badge-green"})

def badge_categorie(v):
    return _badge(v, {"Opérations": "badge-blue", "Budget": "badge-orange", "Planning": "badge-purple", "Technologie": "badge-gray", "Sécurité": "badge-red"})

def badge_priorite(val):
    v = int(val) if int(val) in (1, 2, 3) else 1
    return f'<span class="prio prio-{v}">{v}</span>'

def badge_importance(v):
    return _badge(v, {"Faible": "badge-green", "Moyenne": "badge-orange", "Élevée": "badge-red", "Critique": "badge-purple"})

def progress_bar(pct):
    pct = max(0, min(100, int(pct)))
    cls = "high" if pct >= 70 else ("mid" if pct >= 30 else "low")
    return (f'<div class="progress-bar"><div class="fill {cls}" style="width:{pct}%"></div></div>'
            f'<div class="progress-text">{pct} %</div>')


# ═══════════════════════════════════════════════════════════════════════════════
# NAVIGATION — boutons injectés dans la toolbar native du header Streamlit
# ═══════════════════════════════════════════════════════════════════════════════
page_param = st.query_params.get("page", "risques")
if isinstance(page_param, list):
    page_param = page_param[0] if page_param else "risques"
_PAGE_MAP = {"taches": "Suivi des Tâches", "planning": "Planning", "cahier": "Cahier des Charges", "aide": "Aide Pilotage", "risques": "Registre des Risques", "equipe": "Équipe"}
page_active = _PAGE_MAP.get(page_param, "Registre des Risques")
st.session_state.page_active = page_active

# Injecter les boutons dans le header Streamlit (alignés à gauche, deploy masqué)
components.html("""
<script>
(function() {
    var doc = window.parent.document;

    // Script persistant dans le parent (une seule fois)
    if (doc.getElementById('topnav-toolbar-script')) return;

    var tag = doc.createElement('script');
    tag.id = 'topnav-toolbar-script';
    tag.textContent = '(' + function() {

        // Injecter le style une seule fois
        if (!document.getElementById('topnav-toolbar-style')) {
            var s = document.createElement('style');
            s.id = 'topnav-toolbar-style';
            s.textContent = [
                /* Masquer le bouton Deploy */
                '[data-testid="stAppDeployButton"] { display: none !important; }',
                /* Forcer la toolbar à s'aligner à gauche */
                '[data-testid="stToolbarActions"] {',
                '  position: absolute !important;',
                '  left: 3.5rem !important;',
                '  right: auto !important;',
                '  justify-content: flex-start !important;',
                '}',
                '.topnav-btn {',
                '  display: inline-flex;',
                '  align-items: center;',
                '  justify-content: center;',
                '  height: 2rem;',
                '  padding: 0 0.75rem;',
                '  border-radius: 0.5rem;',
                '  border: none;',
                '  font-family: inherit;',
                '  font-size: 0.8rem;',
                '  font-weight: 600;',
                '  color: inherit;',
                '  background: transparent;',
                '  cursor: pointer;',
                '  white-space: nowrap;',
                '  transition: background 0.15s;',
                '  margin-right: 0.25rem;',
                '  opacity: 0.7;',
                '}',
                '.topnav-btn:hover {',
                '  background: rgba(128,128,128,0.1);',
                '  opacity: 1;',
                '}',
                '.topnav-btn.is-active {',
                '  background: rgba(37, 99, 235, 0.12);',
                '  color: rgb(37, 99, 235);',
                '  opacity: 1;',
                '}',
            ].join('\\n');
            document.head.appendChild(s);
        }

        // Polling : injecter/mettre à jour les boutons dans la toolbar
        setInterval(function() {
            var toolbar = document.querySelector('[data-testid="stToolbarActions"]');
            if (!toolbar) return;

            // Lire la page active depuis l'URL
            var params = new URLSearchParams(window.location.search);
            var active = params.get('page') || 'risques';

            var existing = toolbar.querySelector('.topnav-btn-group');
            if (!existing) {
                var group = document.createElement('span');
                group.className = 'topnav-btn-group';
                group.style.display = 'inline-flex';
                group.style.alignItems = 'center';
                group.style.marginRight = '0.5rem';

                var pages = [
                    {label: 'Cahier des Charges', key: 'cahier'},
                    {label: 'Risques', key: 'risques'},
                    {label: 'Tâches', key: 'taches'},
                    {label: 'Planning', key: 'planning'},
                    {label: 'Équipe', key: 'equipe'},
                    {label: 'Aide Pilotage', key: 'aide'}
                ];
                pages.forEach(function(p) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'topnav-btn';
                    btn.dataset.page = p.key;
                    btn.textContent = p.label;
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var params = new URLSearchParams(window.location.search);
                        params.set('page', p.key);
                        window.location.href = window.location.pathname + '?' + params.toString();
                    });
                    group.appendChild(btn);
                });
                toolbar.prepend(group);
            }

            // Mettre à jour l'état actif
            var btns = toolbar.querySelectorAll('.topnav-btn');
            btns.forEach(function(b) {
                var isActive = b.dataset.page === active;
                b.className = 'topnav-btn' + (isActive ? ' is-active' : '');
            });
        }, 300);

    }.toString() + ')();';
    doc.head.appendChild(tag);
})();
</script>
""", height=0)

# Raccourcis clavier
components.html("""
<script>
(function() {
    var doc = window.parent.document;
    if (doc.getElementById('kbd-shortcuts')) return;
    var tag = doc.createElement('script');
    tag.id = 'kbd-shortcuts';
    tag.textContent = '(' + function() {
        var SHORTCUTS = { r: 'risques', t: 'taches', c: 'cahier', p: 'planning', e: 'equipe' };
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            var key = e.key.toLowerCase();
            if (SHORTCUTS[key]) {
                e.preventDefault();
                var params = new URLSearchParams(window.location.search);
                params.set('page', SHORTCUTS[key]);
                window.location.href = window.location.pathname + '?' + params.toString();
            }
        });
    }.toString() + ')();';
    doc.head.appendChild(tag);
})();
</script>
""", height=0)

# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    # ── Sauvegarde ZIP ──────────────────────────────────────────
    st.markdown("---")
    ico_zip = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    ico_restore = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>'
    st.markdown(f'<h4 class="section-title">{ico_zip} Sauvegarde ZIP</h4>', unsafe_allow_html=True)
    zip_bytes = creer_zip_sauvegarde()
    st.download_button(
        label="Télécharger la sauvegarde",
        data=zip_bytes,
        file_name=f"sauvegarde_projet_{date.today().isoformat()}.zip",
        mime="application/zip",
        use_container_width=True,
        key="dl_zip",
    )

    # Restauration depuis un ZIP
    st.markdown(f'<h4 class="section-title">{ico_restore} Restaurer depuis ZIP</h4>', unsafe_allow_html=True)
    zip_upload = st.file_uploader("Importer un ZIP de sauvegarde", type=["zip"], label_visibility="collapsed", key="zip_upload")
    if zip_upload is not None:
        # Signature unique du fichier pour éviter de retraiter le même ZIP à chaque rerun
        _zip_sig = f"{zip_upload.name}|{zip_upload.size}"
        if st.session_state.get("_processed_zip") != _zip_sig:
            try:
                with zipfile.ZipFile(io.BytesIO(zip_upload.read())) as zf:
                    noms = zf.namelist()
                    restored = []

                    if "data/registre_risques.csv" in noms:
                        df_r = pd.read_csv(io.BytesIO(zf.read("data/registre_risques.csv")))
                        df_r["id"] = [str(uuid.uuid4()) for _ in range(len(df_r))]
                        df_r = df_r[[c for c in COLONNES if c in df_r.columns or c == "id"]]
                        st.session_state.risques = df_r
                        sauvegarder()
                        restored.append("registre_risques.csv")

                    if "data/suivi_taches.csv" in noms:
                        df_t = pd.read_csv(io.BytesIO(zf.read("data/suivi_taches.csv")))
                        df_t["id"] = [str(uuid.uuid4()) for _ in range(len(df_t))]
                        if "Jalon" not in df_t.columns:
                            df_t["Jalon"] = ""
                        st.session_state.taches = df_t[[c for c in TACHE_COLONNES if c in df_t.columns or c == "id"]]
                        sauvegarder_taches()
                        restored.append("suivi_taches.csv")

                    if "data/equipe_completions.csv" in noms:
                        df_e = pd.read_csv(io.BytesIO(zf.read("data/equipe_completions.csv")))
                        df_e["id"] = [str(uuid.uuid4()) for _ in range(len(df_e))]
                        for _col in ["Collaborateur", "Poste", "Manager", "Numéro", "Email"]:
                            if _col not in df_e.columns:
                                df_e[_col] = ""
                        st.session_state.equipe = df_e[[c for c in EQUIPE_COLONNES if c in df_e.columns or c == "id"]]
                        sauvegarder_equipe()
                        restored.append("equipe_completions.csv")

                    if "data/cahier_des_charges.json" in noms:
                        _cdc_bytes = zf.read("data/cahier_des_charges.json")
                        if _db.use_db():
                            _db.save_cdc(json.loads(_cdc_bytes.decode("utf-8")))
                        else:
                            CDC_JSON_PATH.write_bytes(_cdc_bytes)
                        restored.append("cahier_des_charges.json")

                    if restored:
                        st.session_state._processed_zip = _zip_sig
                        _cdc_restored = "cahier_des_charges.json" in restored
                        st.toast(f"✅ Restauré : {', '.join(restored)}")
                        if _cdc_restored:
                            # Force le rechargement de l'iframe CDC avec les nouvelles données
                            st.rerun()
                    else:
                        st.warning("Aucun fichier reconnu dans ce ZIP.")
            except Exception as exc:
                st.error(f"Erreur lors de la restauration : {exc}")

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — REGISTRE DES RISQUES
# ═══════════════════════════════════════════════════════════════════════════════
if page_active == "Registre des Risques":
    df: pd.DataFrame = st.session_state.risques
    responsables_connus = sorted(
        {
            str(r).strip()
            for r in df["Responsable"].dropna().tolist()
            if str(r).strip()
        }
    )

    st.markdown(f'<h1 class="section-title">{ICO["chart"]} Registre des Risques</h1>', unsafe_allow_html=True)

    # ── KPIs (composants natifs Streamlit) ───────────────────────────────────
    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Total", len(df))
    k2.metric("Ouverts", len(df[df["Statut"] == "Ouvert"]))
    k3.metric("En cours", len(df[df["Statut"] == "En cours"]))
    k4.metric("Fermés", len(df[df["Statut"] == "Fermé"]))
    k5.metric("Critiques (P3)", len(df[df["Priorité"] == 3]))

    # ── Filtres ──────────────────────────────────────────────────────────────
    with st.expander("Filtres"):
        fc1, fc2, fc3, fc4 = st.columns(4)
        with fc1:
            f_prob = st.multiselect("Probabilité", PROBABILITES, default=PROBABILITES)
        with fc2:
            f_imp = st.multiselect("Impact", IMPACTS, default=IMPACTS)
        with fc3:
            f_stat = st.multiselect("Statut", STATUTS, default=STATUTS)
        with fc4:
            f_prio = st.multiselect("Priorité", PRIORITES, default=PRIORITES)
        f_identifiant = st.text_input("Recherche identifiant", placeholder="Ex: Budget, RISK-001...")

    df_filtre = df[
        df["Probabilité"].isin(f_prob) & df["Impact"].isin(f_imp)
        & df["Statut"].isin(f_stat)
        & df["Priorité"].isin(f_prio)
        & df["Identifiant"].astype(str).str.contains(f_identifiant.strip(), case=False, na=False)
    ]

    # ── Tableau interactif ───────────────────────────────────────────────────
    if df_filtre.empty:
        st.info("Aucun risque ne correspond aux filtres.")
    else:
        hdr = st.columns([3, 1.3, 1.1, 1, 0.7, 1.3, 2.5, 1.1, 1])
        for col, label in zip(hdr, ["Identifiant", "Catégorie", "Probabilité", "Impact", "Prio.", "Responsable", "Atténuation", "Statut", ""]):
            col.markdown(f"<div class='table-header'>{label}</div>", unsafe_allow_html=True)

        for _, r in df_filtre.iterrows():
            cols = st.columns([3, 1.3, 1.1, 1, 0.7, 1.3, 2.5, 1.1, 1])
            desc = str(r["Description"])
            desc_short = desc[:80] + ("…" if len(desc) > 80 else "")
            cols[0].markdown(f"<strong>{r['Identifiant']}</strong><br><span class='desc'>{desc_short}</span>", unsafe_allow_html=True)
            cols[1].markdown(badge_categorie(r['Catégorie']), unsafe_allow_html=True)
            cols[2].markdown(badge_proba(r['Probabilité']), unsafe_allow_html=True)
            cols[3].markdown(badge_impact(r['Impact']), unsafe_allow_html=True)
            cols[4].markdown(badge_priorite(r['Priorité']), unsafe_allow_html=True)
            cols[5].markdown(r['Responsable'])
            cols[6].markdown(f"<span style='font-size:0.85rem'>{r['Atténuation']}</span>", unsafe_allow_html=True)
            cols[7].markdown(badge_statut(r['Statut']), unsafe_allow_html=True)
            with cols[8]:
                if st.button("", key=f"edit_r_{r['id']}", help="Modifier", icon=":material/edit:"):
                    st.session_state.selected_risque_id = r['id']
                    st.rerun()
            st.markdown('<div class="row-sep"><hr></div>', unsafe_allow_html=True)

    st.divider()

    # ── Ajout de risque (dépliable) ──────────────────────────────────────────
    st.markdown('<div id="add-risque-anchor"></div>', unsafe_allow_html=True)
    if st.session_state.open_add_risque:
        components.html(
            f'''<script>
            const root = window.parent.document;
            const anchor = root.getElementById("add-risque-anchor");
            if (anchor) {{
                anchor.scrollIntoView({{behavior:"smooth", block:"start"}});
                window.setTimeout(() => {{
                    const firstField = anchor.parentElement?.querySelector('input:not([type="hidden"]), textarea');
                    if (firstField) firstField.focus();
                }}, 250);
            }}
            </script>''',
            height=0,
        )
    with st.expander(
        "Nouveau risque",
        icon=":material/add:",
        expanded=st.session_state.open_add_risque,
    ):
        with st.form("form_ajout", clear_on_submit=True):
            a_c1, a_c2 = st.columns(2)
            with a_c1:
                nom = st.text_input("Identifiant*")
                categorie = st.selectbox("Catégorie", CATEGORIES)
                probabilite = st.selectbox("Probabilité", PROBABILITES)
            with a_c2:
                responsable = st.text_input("Responsable*")
                resp_ajout_opts = ["(Aucun)"] + responsables_connus
                responsable_existant = st.selectbox("Ou choisir un responsable déjà assigné", resp_ajout_opts, index=0)
                statut = st.selectbox("Statut", STATUTS)
                impact = st.selectbox("Impact", IMPACTS)
            priorite_auto = calculer_priorite(probabilite, impact)
            priorite = st.selectbox(
                f"Priorité (auto : {priorite_auto})", PRIORITES,
                index=PRIORITES.index(priorite_auto),
            )
            description = st.text_area("Description", height=68)
            attenuation = st.text_area("Atténuation", height=68)
            if st.form_submit_button("Ajouter le risque", use_container_width=True):
                responsable_final = responsable.strip() or ("" if responsable_existant == "(Aucun)" else responsable_existant)
                if not nom.strip() or not responsable_final.strip():
                    st.warning("Identifiant et Responsable obligatoires.")
                else:
                    nouveau = pd.DataFrame([{
                        "id": str(uuid.uuid4()), "Identifiant": nom.strip(),
                        "Description": description.strip(), "Catégorie": categorie,
                        "Probabilité": probabilite, "Impact": impact, "Priorité": priorite,
                        "Responsable": responsable_final, "Atténuation": attenuation.strip(),
                        "Statut": statut,
                    }], columns=COLONNES)
                    st.session_state.risques = pd.concat(
                        [st.session_state.risques, nouveau], ignore_index=True)
                    st.session_state.open_add_risque = False
                    sauvegarder()
                    st.success(f"« {nom} » ajouté !")
                    st.rerun()

    st.session_state.open_add_risque = False

    # ── Édition / Suppression ─────────────────────────────────
    _open_risque_edit = st.session_state.get("selected_risque_id") is not None
    if _open_risque_edit:
        st.session_state["_pending_risque_id"] = st.session_state.selected_risque_id
        st.session_state.selected_risque_id = None
    st.markdown('<div id="edit-risque-anchor"></div>', unsafe_allow_html=True)
    if _open_risque_edit:
        components.html(f'<script>/* {uuid.uuid4()} */window.parent.document.getElementById("edit-risque-anchor").scrollIntoView({{behavior:"smooth",block:"start"}});</script>', height=0)
    with st.expander("Modifier ou supprimer un risque", icon=":material/edit:", expanded=_open_risque_edit):
        if df.empty:
            st.info("Aucun risque dans le registre.")
        else:
            options = {row["id"]: f"{row['Identifiant']}  —  {row['Statut']}" for _, row in df.iterrows()}
            if "_sel_risque_key" in st.session_state and st.session_state["_sel_risque_key"] not in options:
                del st.session_state["_sel_risque_key"]
            _risk_ids = list(options.keys())
            _pending_risk = st.session_state.pop("_pending_risque_id", None)
            _risk_default = st.session_state.get("_sel_risque_key")
            if _risk_default not in options:
                _risk_default = _pending_risk if _pending_risk in options else _risk_ids[0]
            choix_id = st.selectbox(
                "Sélectionner un risque", _risk_ids,
                format_func=lambda x: options[x],
                index=_risk_ids.index(_risk_default),
                key="_sel_risque_key",
            )
            risque = df[df["id"] == choix_id].iloc[0]

            col_edit, col_del = st.columns([5, 1])

            with col_edit:
                with st.form("form_edit"):
                    e_c1, e_c2 = st.columns(2)
                    with e_c1:
                        e_nom = st.text_input("Identifiant", value=risque["Identifiant"])
                        cat_opts = CATEGORIES if risque["Catégorie"] in CATEGORIES else [risque["Catégorie"]] + CATEGORIES
                        e_cat = st.selectbox("Catégorie", cat_opts, index=cat_opts.index(risque["Catégorie"]))
                        prob_opts = PROBABILITES if risque["Probabilité"] in PROBABILITES else [risque["Probabilité"]] + PROBABILITES
                        e_prob = st.selectbox("Probabilité", prob_opts, index=prob_opts.index(risque["Probabilité"]))
                    with e_c2:
                        current_resp = str(risque["Responsable"]).strip()
                        e_resp = st.text_input("Responsable", value=current_resp)
                        resp_opts_edit = ["(Aucun)"] + responsables_connus
                        default_resp = current_resp if current_resp in responsables_connus else "(Aucun)"
                        e_resp_choice = st.selectbox("Ou choisir un responsable déjà assigné", resp_opts_edit, index=resp_opts_edit.index(default_resp))
                        e_resp_final = e_resp.strip() or ("" if e_resp_choice == "(Aucun)" else e_resp_choice)
                        stat_opts = STATUTS if risque["Statut"] in STATUTS else [risque["Statut"]] + STATUTS
                        e_stat = st.selectbox("Statut", stat_opts, index=stat_opts.index(risque["Statut"]))
                        imp_opts = IMPACTS if risque["Impact"] in IMPACTS else [risque["Impact"]] + IMPACTS
                        e_imp = st.selectbox("Impact", imp_opts, index=imp_opts.index(risque["Impact"]))
                    e_prio_auto = calculer_priorite(e_prob, e_imp)
                    current_prio = int(risque["Priorité"]) if int(risque["Priorité"]) in PRIORITES else 1
                    e_prio = st.selectbox(
                        f"Priorité (auto : {e_prio_auto})", PRIORITES,
                        index=PRIORITES.index(current_prio),
                    )
                    e_desc = st.text_area("Description", value=risque["Description"], height=68)
                    e_att = st.text_area("Atténuation", value=risque["Atténuation"], height=68)

                    if st.form_submit_button("Enregistrer", use_container_width=True):
                        idx = df.index[df["id"] == choix_id][0]
                        st.session_state.risques.at[idx, "Identifiant"] = e_nom.strip()
                        st.session_state.risques.at[idx, "Description"] = e_desc.strip()
                        st.session_state.risques.at[idx, "Catégorie"] = e_cat
                        st.session_state.risques.at[idx, "Probabilité"] = e_prob
                        st.session_state.risques.at[idx, "Impact"] = e_imp
                        st.session_state.risques.at[idx, "Priorité"] = e_prio
                        st.session_state.risques.at[idx, "Responsable"] = e_resp_final.strip()
                        st.session_state.risques.at[idx, "Atténuation"] = e_att.strip()
                        st.session_state.risques.at[idx, "Statut"] = e_stat
                        sauvegarder()
                        st.success("Enregistré !")
                        st.rerun()

            with col_del:
                st.markdown("<br><br>", unsafe_allow_html=True)
                if st.button("Supprimer", use_container_width=True, type="primary"):
                    st.session_state.risques = df[df["id"] != choix_id].reset_index(drop=True)
                    sauvegarder()
                    st.success("Supprimé.")
                    st.rerun()

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — SUIVI DES TÂCHES
# ═══════════════════════════════════════════════════════════════════════════════
if page_active == "Suivi des Tâches":
    df_t: pd.DataFrame = st.session_state.taches

    st.markdown(f'<h1 class="section-title">{ICO["tasks"]} Suivi des Tâches</h1>', unsafe_allow_html=True)

    # ── KPIs tâches ──────────────────────────────────────────────────────────
    tk1, tk2, tk3 = st.columns(3)
    tk1.metric("Total tâches", len(df_t))
    if not df_t.empty:
        tk2.metric("Avancement moyen", f"{int(df_t['Avancement'].mean())} %")
        tk3.metric("Terminées", len(df_t[df_t["Avancement"] >= 100]))
    else:
        tk2.metric("Avancement moyen", "—")
        tk3.metric("Terminées", 0)

    # ── Filtres tâches ───────────────────────────────────────────────────────
    with st.expander("Filtres"):
        tf1, tf2, tf3 = st.columns(3)
        with tf1:
            t_search = st.text_input("Recherche par nom", placeholder="Ex: Rédiger, Sprint…")
        with tf2:
            t_f_imp = st.multiselect("Importance", IMPORTANCES, default=IMPORTANCES)
        with tf3:
            assignes_connus = sorted({str(a).strip() for a in df_t["Assigné"].dropna().tolist() if str(a).strip()})
            t_f_assigne = st.multiselect("Assigné à", assignes_connus, default=assignes_connus)

    df_t_filtre = df_t[
        df_t["Nom"].astype(str).str.contains(t_search.strip(), case=False, na=False)
        & df_t["Importance"].isin(t_f_imp)
        & (df_t["Assigné"].isin(t_f_assigne) if t_f_assigne else pd.Series(True, index=df_t.index))
    ]

    # ── Tableau des tâches ──────────────────────────────────────
    if df_t_filtre.empty:
        st.info("Aucune tâche ne correspond aux filtres.")
    else:
        t_hdr = st.columns([2.1, 1.7, 1.1, 1.8, 1.3, 1.1, 0.7])
        for col, label in zip(t_hdr, ["Nom", "Description", "Importance", "Jalon", "Avancement", "Assigné", ""]):
            col.markdown(f"<div class='table-header'>{label}</div>", unsafe_allow_html=True)

        for _, t in df_t_filtre.iterrows():
            t_cols = st.columns([2.1, 1.7, 1.1, 1.8, 1.3, 1.1, 0.7])
            t_cols[0].markdown(f"<strong>{t['Nom']}</strong>", unsafe_allow_html=True)
            t_cols[1].markdown(f"<span style='font-size:0.85rem'>{t['Description']}</span>", unsafe_allow_html=True)
            t_cols[2].markdown(badge_importance(t['Importance']), unsafe_allow_html=True)
            _t_jv = str(t["Jalon"]) if "Jalon" in t.index else ""
            _t_jd = (_t_jv[:15] + "\u2026") if len(_t_jv) > 15 else (_t_jv or "\u2014")
            t_cols[3].markdown(f"<span style='font-size:0.78rem;color:#64748b;'>{_t_jd}</span>", unsafe_allow_html=True)
            t_cols[4].markdown(progress_bar(t['Avancement']), unsafe_allow_html=True)
            t_cols[5].markdown(t['Assigné'])
            with t_cols[6]:
                if st.button("", key=f"edit_t_{t['id']}", help="Modifier", icon=":material/edit:"):
                    st.session_state.selected_tache_id = t['id']
                    st.rerun()
            st.markdown('<div class="row-sep"><hr></div>', unsafe_allow_html=True)

    # ── Liste des jalons depuis le CDC ────────────────
    _t_jalon_opts = ["(Sans jalon)"]
    try:
        if _db.use_db():
            _cj = _db.load_cdc() or {}
        elif CDC_JSON_PATH.exists():
            _cj = json.loads(CDC_JSON_PATH.read_text(encoding="utf-8"))
        else:
            _cj = {}
        _t_jalon_opts += [str(j[0]) for j in _cj.get("jalons", []) if j and str(j[0]).strip()]
    except Exception:
        pass

    st.divider()

    # ── Ajout de tâche ────────────────────────────────────────
    st.markdown('<div id="add-tache-anchor"></div>', unsafe_allow_html=True)
    if st.session_state.open_add_tache:
        components.html(
            f'''<script>
            const root = window.parent.document;
            const anchor = root.getElementById("add-tache-anchor");
            if (anchor) {{
                anchor.scrollIntoView({{behavior:"smooth", block:"start"}});
                window.setTimeout(() => {{
                    const firstField = anchor.parentElement?.querySelector('input:not([type="hidden"]), textarea');
                    if (firstField) firstField.focus();
                }}, 250);
            }}
            </script>''',
            height=0,
        )
    with st.expander(
        "Nouvelle tâche",
        icon=":material/add:",
        expanded=st.session_state.open_add_tache,
    ):
        with st.form("form_ajout_tache", clear_on_submit=True):
            t_c1, t_c2 = st.columns(2)
            with t_c1:
                t_nom = st.text_input("Nom de la tâche*")
                t_imp = st.selectbox("Importance", IMPORTANCES)
            with t_c2:
                t_assigne = st.text_input("Assigné à*")
                t_avancement = st.slider("Avancement (%)", 0, 100, 0, 5)
            t_desc = st.text_area("Description courte", height=68)
            t_jalon = st.selectbox("Jalon associé", _t_jalon_opts)
            if st.form_submit_button("Ajouter la tâche", use_container_width=True):
                if not t_nom.strip() or not t_assigne.strip():
                    st.warning("Nom et Assigné obligatoires.")
                else:
                    new_t = pd.DataFrame([{
                        "id": str(uuid.uuid4()), "Nom": t_nom.strip(),
                        "Description": t_desc.strip(), "Importance": t_imp,
                        "Avancement": t_avancement, "Assigné": t_assigne.strip(),
                        "Jalon": "" if t_jalon == "(Sans jalon)" else t_jalon,
                    }], columns=TACHE_COLONNES)
                    st.session_state.taches = pd.concat(
                        [st.session_state.taches, new_t], ignore_index=True)
                    st.session_state.open_add_tache = False
                    sauvegarder_taches()
                    st.success(f"Tâche « {t_nom} » ajoutée !")
                    st.rerun()

    st.session_state.open_add_tache = False

    # ── Édition / Suppression de tâche ──────────────────────────
    _open_tache_edit = st.session_state.get("selected_tache_id") is not None
    if _open_tache_edit:
        st.session_state["_pending_tache_id"] = st.session_state.selected_tache_id
        st.session_state.selected_tache_id = None
    st.markdown('<div id="edit-tache-anchor"></div>', unsafe_allow_html=True)
    if _open_tache_edit:
        components.html(f'<script>/* {uuid.uuid4()} */window.parent.document.getElementById("edit-tache-anchor").scrollIntoView({{behavior:"smooth",block:"start"}});</script>', height=0)
    with st.expander("Modifier ou supprimer une tâche", icon=":material/edit:", expanded=_open_tache_edit):
        if df_t.empty:
            st.info("Aucune tâche à modifier.")
        else:
            t_options = {row["id"]: f"{row['Nom']}  —  {row['Avancement']}%" for _, row in df_t.iterrows()}
            if "_sel_tache_key" in st.session_state and st.session_state["_sel_tache_key"] not in t_options:
                del st.session_state["_sel_tache_key"]
            _task_ids = list(t_options.keys())
            _pending_task = st.session_state.pop("_pending_tache_id", None)
            _task_default = st.session_state.get("_sel_tache_key")
            if _task_default not in t_options:
                _task_default = _pending_task if _pending_task in t_options else _task_ids[0]
            t_choix = st.selectbox(
                "Sélectionner une tâche", _task_ids,
                format_func=lambda x: t_options[x],
                index=_task_ids.index(_task_default),
                key="_sel_tache_key",
            )
            tache = df_t[df_t["id"] == t_choix].iloc[0]

            te_col, td_col = st.columns([5, 1])

            with te_col:
                with st.form("form_edit_tache"):
                    te_c1, te_c2 = st.columns(2)
                    with te_c1:
                        te_nom = st.text_input("Nom", value=tache["Nom"])
                        imp_opts = IMPORTANCES if tache["Importance"] in IMPORTANCES else [tache["Importance"]] + IMPORTANCES
                        te_imp = st.selectbox("Importance", imp_opts, index=imp_opts.index(tache["Importance"]))
                    with te_c2:
                        te_ass = st.text_input("Assigné", value=tache["Assigné"])
                        te_av = st.slider("Avancement (%)", 0, 100, int(tache["Avancement"]), 5)
                    te_desc = st.text_area("Description", value=tache["Description"], height=68)
                    _cur_jalon = str(tache["Jalon"]) if "Jalon" in tache.index else ""
                    _j_idx = _t_jalon_opts.index(_cur_jalon) if _cur_jalon in _t_jalon_opts else 0
                    te_jalon = st.selectbox("Jalon associé", _t_jalon_opts, index=_j_idx)

                    if st.form_submit_button("Enregistrer", use_container_width=True):
                        idx_t = df_t.index[df_t["id"] == t_choix][0]
                        st.session_state.taches.at[idx_t, "Nom"] = te_nom.strip()
                        st.session_state.taches.at[idx_t, "Description"] = te_desc.strip()
                        st.session_state.taches.at[idx_t, "Importance"] = te_imp
                        st.session_state.taches.at[idx_t, "Avancement"] = te_av
                        st.session_state.taches.at[idx_t, "Assigné"] = te_ass.strip()
                        st.session_state.taches.at[idx_t, "Jalon"] = "" if te_jalon == "(Sans jalon)" else te_jalon
                        sauvegarder_taches()
                        st.success("Tâche mise à jour !")
                        st.rerun()

            with td_col:
                st.markdown("<br><br>", unsafe_allow_html=True)
                if st.button("Supprimer", use_container_width=True, type="primary", key="del_tache"):
                    st.session_state.taches = df_t[df_t["id"] != t_choix].reset_index(drop=True)
                    sauvegarder_taches()
                    st.success("Tâche supprimée.")
                    st.rerun()

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 3 — PLANNING
# ═══════════════════════════════════════════════════════════════════════════════
if page_active == "Planning":
    # ── Lecture des jalons depuis le CDC ────────────────────────────────────
    _jalons_data = []
    _nom_projet  = ""
    _chef_projet = ""
    _date_debut  = ""
    try:
        if _db.use_db():
            _cdc = _db.load_cdc() or {}
        elif CDC_JSON_PATH.exists():
            _cdc = json.loads(CDC_JSON_PATH.read_text(encoding="utf-8"))
        else:
            _cdc = {}
        _nom_projet  = _cdc.get("nom_projet", "")
        _chef_projet = _cdc.get("chef_projet", "")
        _date_debut  = _cdc.get("date_debut", "")
        for _j in _cdc.get("jalons", []):
            if len(_j) >= 2 and str(_j[1]).strip():
                _jalons_data.append([
                    str(_j[0]) if len(_j) > 0 else "",
                    str(_j[1]),
                    str(_j[2]) if len(_j) > 2 else ""
                ])
    except Exception:
        pass

    # ── Tâches liées aux jalons ──────────────────────────────────────
    _tasks_data = []
    if "taches" in st.session_state:
        for _, _trow in st.session_state.taches.iterrows():
            _av = _trow.get("Avancement", 0)
            _tasks_data.append({
                "nom":        str(_trow.get("Nom", "")),
                "jalon":      str(_trow.get("Jalon", "")) if "Jalon" in _trow.index else "",
                "avancement": int(_av) if pd.notna(_av) else 0,
            })

    _jalons_json     = json.dumps(_jalons_data, ensure_ascii=False)
    _nom_json        = json.dumps(_nom_projet,  ensure_ascii=False)
    _chef_json       = json.dumps(_chef_projet, ensure_ascii=False)
    _date_debut_json = json.dumps(_date_debut,  ensure_ascii=False)
    _tasks_json      = json.dumps(_tasks_data,  ensure_ascii=False)

    _planning_html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
:root {{
    --bg-page:    transparent;
    --bg-card:    #fff;
    --bg-mcard:   #fff;
    --border-card:#e9eef5;
    --border-mc:  #e9eef5;
    --text-body:  #1e293b;
    --text-muted: #64748b;
    --text-num:   #94a3b8;
    --svg-label:  #1e293b;
    --svg-tick:   #94a3b8;
    --svg-bar-bg: #f1f5f9;
    --svg-bar-past:#94a3b8;
    --prog-bg:    #f1f5f9;
    --sep:        #f1f5f9;
    --task-text:  #374151;
}}
:root.dark {{
    --bg-page:    #0f172a;
    --bg-card:    #1e293b;
    --bg-mcard:   #263348;
    --border-card:#334155;
    --border-mc:  #334155;
    --text-body:  #f1f5f9;
    --text-muted: #94a3b8;
    --text-num:   #64748b;
    --svg-label:  #e2e8f0;
    --svg-tick:   #475569;
    --svg-bar-bg: #263348;
    --svg-bar-past:#475569;
    --prog-bg:    #263348;
    --sep:        #334155;
    --task-text:  #cbd5e1;
}}
*{{font-family:'Inter',sans-serif;box-sizing:border-box;margin:0;padding:0;}}
body{{background:var(--bg-page);padding:6px 4px 28px;color:var(--text-body);font-size:13px;transition:background .25s,color .25s;}}
.hdr{{background:#0f172a;border-radius:14px;padding:18px 26px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}}
.hdr-title{{color:#fff;font-size:17px;font-weight:800;letter-spacing:-.3px;}}
.hdr-sub{{color:#64748b;font-size:10px;margin-top:3px;}}
.hdr-meta{{display:flex;gap:18px;}}
.hm-label{{color:#475569;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;}}
.hm-value{{color:#94a3b8;font-size:11px;font-weight:600;margin-top:2px;}}
.card{{background:var(--bg-card);border:1px solid var(--border-card);border-radius:14px;padding:20px 28px;margin-bottom:14px;transition:background .25s,border-color .25s;}}
.section-label{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:14px;}}
.cards-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:11px;}}
.mcard{{border:1px solid var(--border-mc);border-radius:11px;padding:14px 16px 14px 20px;background:var(--bg-mcard);position:relative;overflow:hidden;transition:box-shadow .2s,background .25s,border-color .25s;}}
.mcard:hover{{box-shadow:0 4px 16px rgba(0,0,0,.14);}}
.mcard-accent{{position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px;}}
.mcard-num{{font-size:8.5px;font-weight:700;color:var(--text-num);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;}}
.mcard-label{{font-size:12.5px;font-weight:700;color:var(--text-body);margin-bottom:5px;line-height:1.3;}}
.mcard-date{{font-size:11px;font-weight:600;margin-bottom:6px;}}
.mcard-desc{{font-size:10.5px;color:var(--text-muted);line-height:1.55;}}
.badge{{display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:20px;padding:2px 8px;margin-bottom:7px;}}
.empty{{text-align:center;padding:60px 20px;color:var(--text-num);}}
</style>
</head>
<body>
<div id="app"></div>
<script>
const JALONS     = {_jalons_json};
const NOM_PROJET = {_nom_json};
const CHEF       = {_chef_json};
const DATE_DEBUT = {_date_debut_json};
const TASKS      = {_tasks_json};
const TODAY      = new Date(); TODAY.setHours(0,0,0,0);

// ── Données vivantes : localStorage CDC prioritaire sur données serveur ───────
let LIVE_JALONS = JALONS;
let LIVE_NOM    = NOM_PROJET;
let LIVE_CHEF   = CHEF;
let LIVE_DEBUT  = DATE_DEBUT;
(function syncCDC() {{
    try {{
    const raw = localStorage.getItem('cdc_data_v2');
    if (!raw) return;
    const cdc = JSON.parse(raw);
    if (cdc.jalons   && cdc.jalons.length)  LIVE_JALONS = cdc.jalons;
    if (cdc.nom_projet)                     LIVE_NOM    = cdc.nom_projet;
    if (cdc.chef_projet)                    LIVE_CHEF   = cdc.chef_projet;
    if (cdc.date_debut)                     LIVE_DEBUT  = cdc.date_debut;
    }} catch(e) {{}}
}})();
// Rebuild automatique si le CDC modifie les jalons dans un autre onglet/iframe
window.addEventListener('storage', function(e) {{
    if (e.key !== 'cdc_data_v2') return;
    try {{
    const cdc = JSON.parse(e.newValue || '{{}}');
    if (cdc.jalons   && cdc.jalons.length)  LIVE_JALONS = cdc.jalons;
    if (cdc.nom_projet)                     LIVE_NOM    = cdc.nom_projet;
    if (cdc.chef_projet)                    LIVE_CHEF   = cdc.chef_projet;
    if (cdc.date_debut)                     LIVE_DEBUT  = cdc.date_debut;
    buildApp();
    }} catch(e) {{}}
}});

function fmtDate(d) {{ return d.toLocaleDateString('fr-FR',{{day:'2-digit',month:'short',year:'numeric'}}); }}
function fmtShort(d) {{ return d.toLocaleDateString('fr-FR',{{day:'2-digit',month:'short'}}); }}
function escH(s) {{ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }}

// ── Détection thème Streamlit (identique au CDC) ─────────────────────────────
function luminanceFromColor(str) {{
    if (!str) return null;
    const rgb = str.match(/(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)/);
    if (rgb) return 0.299*parseInt(rgb[1])+0.587*parseInt(rgb[2])+0.114*parseInt(rgb[3]);
    const hex = str.trim().replace('#','');
    if (hex.length >= 6) return 0.299*parseInt(hex.substring(0,2),16)+0.587*parseInt(hex.substring(2,4),16)+0.114*parseInt(hex.substring(4,6),16);
    return null;
}}
function applyTheme(dark) {{
    document.documentElement.classList.toggle('dark', dark);
}}
let _lastDark = null;
function onThemeChange() {{
    try {{
    const parentDoc  = window.parent.document;
    const parentHtml = parentDoc.documentElement;
    let isDark = null;
    const attr = parentHtml.getAttribute('data-theme');
    if (attr) {{ isDark = (attr === 'dark'); }}
    if (isDark === null) {{
        const cssVar = window.parent.getComputedStyle(parentHtml).getPropertyValue('--background-color').trim();
        if (cssVar) {{ const lum = luminanceFromColor(cssVar); if (lum !== null) isDark = lum < 128; }}
    }}
    if (isDark === null) {{
        for (const el of [parentDoc.querySelector('[data-testid="stApp"]'), parentDoc.body, parentHtml]) {{
        if (!el) continue;
        const bg = window.parent.getComputedStyle(el).backgroundColor;
        if (!bg || bg === 'transparent' || bg.includes('0, 0, 0, 0')) continue;
        const lum = luminanceFromColor(bg);
        if (lum !== null) {{ isDark = lum < 128; break; }}
        }}
    }}
    if (isDark === null) isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark !== _lastDark) {{ _lastDark = isDark; applyTheme(isDark); buildApp(); }}
    }} catch(e) {{}}
}}
try {{
    const parentDoc = window.parent.document;
    const obs = new MutationObserver(onThemeChange);
    obs.observe(parentDoc.documentElement, {{attributes:true,attributeFilter:['data-theme','class','style']}});
    obs.observe(parentDoc.body, {{attributes:true,attributeFilter:['class','style']}});
    new MutationObserver(onThemeChange).observe(parentDoc.head, {{childList:true,subtree:true}});
}} catch(e) {{}}
setInterval(onThemeChange, 500);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onThemeChange);
onThemeChange();

function buildApp() {{
  // Lire les variables CSS du thème courant
    const CS       = getComputedStyle(document.documentElement);
    const C_MUTED  = CS.getPropertyValue('--text-muted').trim()   || '#64748b';
    const C_BODY   = CS.getPropertyValue('--text-body').trim()    || '#1e293b';
    const C_SVG_LB = CS.getPropertyValue('--svg-label').trim()   || '#1e293b';
    const C_SVG_TK = CS.getPropertyValue('--svg-tick').trim()    || '#94a3b8';
    const C_BAR_BG = CS.getPropertyValue('--svg-bar-bg').trim()  || '#f1f5f9';
    const C_BAR_PS = CS.getPropertyValue('--svg-bar-past').trim()|| '#94a3b8';
    const C_PROG   = CS.getPropertyValue('--prog-bg').trim()     || '#f1f5f9';
    const C_SEP    = CS.getPropertyValue('--sep').trim()         || '#f1f5f9';
    const C_TASK   = CS.getPropertyValue('--task-text').trim()   || '#374151';
    const app = document.getElementById('app');
    if (!LIVE_JALONS.length) {{
    app.innerHTML = '<div class="empty"><div style="font-size:36px;margin-bottom:12px;">📅</div><div style="font-weight:600;margin-bottom:6px;">Aucun jalon défini</div><div>Renseignez des jalons dans le Cahier des Charges pour visualiser le planning.</div></div>';
    return;
    }}

    const jalons = LIVE_JALONS.map((j,i) => ({{ label:j[0]||('Jalon '+(i+1)), date:j[1]?new Date(j[1]):null, desc:j[2]||'', idx:i }})).filter(j=>j.date);
    jalons.sort((a,b)=>a.date-b.date);

  // Date de début : champ date_debut du CDC, sinon premier jalon
    const rawDebut = LIVE_DEBUT ? new Date(LIVE_DEBUT) : null;
    const startDate = (rawDebut && !isNaN(rawDebut)) ? rawDebut : jalons[0].date;
    const endDate    = jalons[jalons.length-1].date;
    const totalDays  = Math.max(1,(endDate-startDate)/86400000);
    const totalMonths= Math.round(totalDays/30);
    const durationStr= totalMonths>=12
    ? Math.floor(totalMonths/12)+'an'+(Math.floor(totalMonths/12)>1?'s':'')+(totalMonths%12?' '+totalMonths%12+' mois':'')
    : totalMonths+' mois';

    const todayDays  = Math.max(0,Math.min(totalDays,(TODAY-startDate)/86400000));
    const progressPct= Math.round(todayDays/totalDays*100);

  // Calcul de l'avancement moyen d'un jalon à partir des tâches liées
    function jalonPct(j) {{
    const t=TASKS.filter(t=>t.jalon===j.label);
    return t.length>0?Math.round(t.reduce((s,t)=>s+t.avancement,0)/t.length):null;
    }}
  // Couleur selon avancement (si tâches) ou date (sinon)
    function jalonColor(j) {{
    const pct=jalonPct(j);
    if(pct!==null) {{
      if(pct>=100) return '#16a34a';       // vert  — terminé
      if(pct>=50)  return '#2563eb';       // bleu  — en cours
      if(pct>0)    return '#f59e0b';       // orange — démarré
      return '#ef4444';                    // rouge  — non démarré
    }}
    // fallback date
    const diff=(j.date-TODAY)/86400000;
    if(diff<0)   return '#94a3b8';         // gris  — passé
    if(diff<=30) return '#f59e0b';         // orange — proche
    return '#2563eb';                      // bleu  — futur
    }}
    function jalonBg(col) {{
    const light={{['#16a34a']:'#f0fdf4',['#2563eb']:'#eff6ff',['#f59e0b']:'#fffbeb',['#ef4444']:'#fef2f2',['#94a3b8']:'#f1f5f9'}};
    const dark ={{['#16a34a']:'#14532d',['#2563eb']:'#1e3a8a',['#f59e0b']:'#78350f',['#ef4444']:'#7f1d1d',['#94a3b8']:'#263348'}};
    const m=_lastDark?dark:light;
    return m[col]||(_lastDark?'#1e293b':'#f8fafc');
    }}
    function jalonLabel(j) {{
    const pct=jalonPct(j);
    if(pct!==null) {{
        if(pct>=100) return '✓ Terminé';
        if(pct>=50)  return '▶ En cours';
        if(pct>0)    return '◐ Démarré';
        return '○ Non démarré';
    }}
    const diff=(j.date-TODAY)/86400000;
    if(diff<0)   return '✓ Passé';
    if(diff<=30) return '⚡ Prochain';
    return '→ À venir';
    }}

  // ── Header ─────────────────────────────────────────────────────────────────
    let html = `<div class="hdr">
        <div>
            <div class="hdr-title">${{escH(LIVE_NOM||'Planning Projet')}}</div>
            <div class="hdr-sub">${{jalons.length}} jalon${{jalons.length>1?'s':''}} &nbsp;·&nbsp; Durée\u00a0: ${{durationStr}}${{LIVE_CHEF?' &nbsp;·&nbsp; Chef&nbsp;: '+escH(LIVE_CHEF):''}}</div>
        </div>
        <div class="hdr-meta">
            <div><div class="hm-label">Début</div><div class="hm-value">${{fmtDate(startDate)}}</div></div>
            <div><div class="hm-label">Fin prévue</div><div class="hm-value">${{fmtDate(endDate)}}</div></div>
            <div><div class="hm-label">Avancement</div><div class="hm-value">${{progressPct}}\u00a0%</div></div>
        </div>
    </div>`;

  // ── Barre de progression globale ───────────────────────────────────────────
    html += `<div class="card" style="padding:14px 28px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${{C_MUTED}}">Avancement global du projet</span>
        <span style="font-size:11px;font-weight:700;color:#2563eb;">${{progressPct}}\u00a0%</span>
    </div>
    <div style="background:${{C_PROG}};border-radius:8px;height:10px;overflow:hidden;">
        <div style="height:10px;background:linear-gradient(90deg,#2563eb,${{progressPct>=100?'#16a34a':'#3b82f6'}});border-radius:8px;width:${{progressPct}}%;transition:width .5s;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:9px;color:${{C_MUTED}};">
        <span>${{fmtDate(startDate)}}</span>
        <span style="color:#ef4444;font-weight:600;">Aujourd'hui&nbsp;: ${{fmtDate(TODAY)}}</span>
        <span>${{fmtDate(endDate)}}</span>
    </div>
    </div>`;

  // ── Timeline SVG ───────────────────────────────────────────────────────────
    const W=920, H=230, PL=80, PR=80, TW=W-PL-PR;
    const BAR_Y=120, BAR_H=10;
    function xOf(d){{ return PL+(d-startDate)/86400000/totalDays*TW; }}
    const todayX=Math.max(PL+1,Math.min(PL+TW-1,xOf(TODAY)));
    const pastW =Math.max(0,todayX-PL);
    const futW  =Math.max(0,PL+TW-todayX);

  // Month ticks
    let ticks='';
    const td=new Date(startDate); td.setDate(1); td.setMonth(td.getMonth()+1);
    while(td<=endDate){{
    const tx=xOf(td);
    const lbl=td.toLocaleDateString('fr-FR',{{month:'short',year:'2-digit'}});
    ticks+=`<line x1="${{tx}}" y1="${{BAR_Y-6}}" x2="${{tx}}" y2="${{BAR_Y+BAR_H+6}}" stroke="${{C_BAR_BG}}" stroke-width="1"/>`;
    ticks+=`<text x="${{tx}}" y="${{BAR_Y+BAR_H+18}}" text-anchor="middle" font-size="8.5" fill="${{C_SVG_TK}}">${{lbl}}</text>`;
    td.setMonth(td.getMonth()+1);
    }}

  // Milestones
    let ms='';
    jalons.forEach((j,i)=>{{
    const x=xOf(j.date);
    const col=jalonColor(j);
    const above=i%2===0;
    const sy1=above?BAR_Y:BAR_Y+BAR_H;
    const sy2=above?BAR_Y-52:BAR_Y+BAR_H+52;
    const ly =above?BAR_Y-60:BAR_Y+BAR_H+64;
    const dy =above?BAR_Y-71:BAR_Y+BAR_H+76;
    const DS=7;
    ms+=`<line x1="${{x}}" y1="${{sy1}}" x2="${{x}}" y2="${{sy2}}" stroke="${{col}}" stroke-width="1.5" stroke-dasharray="3,2" opacity=".8"/>`;
    ms+=`<polygon points="${{x}},${{BAR_Y-DS}} ${{x+DS}},${{BAR_Y}} ${{x}},${{BAR_Y+DS}} ${{x-DS}},${{BAR_Y}}" fill="${{col}}"/>`;
    ms+=`<text x="${{x}}" y="${{ly}}" text-anchor="middle" font-size="9" font-weight="700" fill="${{C_SVG_LB}}">${{escH(j.label)}}</text>`;
    ms+=`<text x="${{x}}" y="${{dy}}" text-anchor="middle" font-size="8" fill="${{col}}">${{fmtShort(j.date)}}</text>`;
    }});

    const todayEl=`
    <line x1="${{todayX}}" y1="${{BAR_Y-55}}" x2="${{todayX}}" y2="${{BAR_Y+BAR_H+50}}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
    <rect x="${{todayX-16}}" y="${{BAR_Y+BAR_H+50}}" width="32" height="14" rx="4" fill="#ef4444"/>
    <text x="${{todayX}}" y="${{BAR_Y+BAR_H+60}}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">Auj.</text>`;

    html+=`<div class="card" style="overflow-x:auto;padding:20px 24px;">
        <div class="section-label">Timeline</div>
            <svg viewBox="0 0 ${{W}} ${{H}}" style="width:100%;min-width:580px;" xmlns="http://www.w3.org/2000/svg">
                ${{ticks}}
                <rect x="${{PL}}" y="${{BAR_Y}}" width="${{TW}}" height="${{BAR_H}}" rx="5" fill="${{C_BAR_BG}}"/>
                <rect x="${{PL}}" y="${{BAR_Y}}" width="${{pastW}}" height="${{BAR_H}}" rx="5" fill="${{C_BAR_PS}}"/>
                <rect x="${{todayX}}" y="${{BAR_Y}}" width="${{futW}}" height="${{BAR_H}}" rx="5" fill="#2563eb" opacity=".25"/>
                ${{ms}}
                ${{todayEl}}
            </svg>
        </div>`;

  // ── Cartes jalons ──────────────────────────────────────────────────────────
    html+=`<div class="section-label">Détail des jalons</div><div class="cards-grid">`;
    jalons.forEach((j,i)=>{{
    const col=jalonColor(j);
    const bg=jalonBg(col);
    const lbl=jalonLabel(j);
    const diff=Math.round((j.date-TODAY)/86400000);
    const diffStr=diff<0?Math.abs(diff)+'\u00a0j. écoulés':(diff===0?"Aujourd'hui":'Dans\u00a0'+diff+'\u00a0j.');
    const jTasks=TASKS.filter(t=>t.jalon===j.label);
    const jPct=jTasks.length>0?Math.round(jTasks.reduce((s,t)=>s+t.avancement,0)/jTasks.length):null;
    const pBar=jPct!==null
        ?('<div style="margin:8px 0 3px;"><div style="display:flex;justify-content:space-between;font-size:9px;color:'+C_MUTED+';margin-bottom:3px;"><span>Avancement tâches</span><span style="font-weight:700;color:'+col+';">'+(jPct>=100?'✓\u00a0':'')+jPct+'\u00a0%</span></div><div style="background:'+C_PROG+';border-radius:4px;height:6px;overflow:hidden;"><div style="height:6px;background:'+(jPct>=100?'#16a34a':col)+';border-radius:4px;width:'+jPct+'%;"></div></div></div>')
        :'<div style="margin:6px 0 2px;font-size:9px;color:'+C_MUTED+';opacity:.6;font-style:italic;">Aucune tâche associée</div>';
    const tList=jTasks.length>0
        ?('<div style="margin-top:8px;border-top:1px solid '+C_SEP+';padding-top:7px;">'+jTasks.map(t=>'<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;"><span style="font-size:8px;font-weight:700;color:'+(t.avancement>=100?'#16a34a':C_MUTED)+';width:24px;text-align:right;flex-shrink:0;">'+t.avancement+'%</span><div style="flex:0 0 54px;background:'+C_PROG+';border-radius:3px;height:4px;overflow:hidden;"><div style="height:4px;background:'+(t.avancement>=100?'#16a34a':'#3b82f6')+';border-radius:3px;width:'+t.avancement+'%;"></div></div><span style="font-size:10px;color:'+C_TASK+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escH(t.nom)+'</span></div>').join('')+'</div>')
        :'';
    html+=`<div class="mcard">
        <div class="mcard-accent" style="background:${{col}};"></div>
        <div class="mcard-num">Jalon ${{i+1}}${{jTasks.length>0?' · '+jTasks.length+' t\u00e2che'+(jTasks.length>1?'s':''):''}}</div>
        <div class="mcard-label">${{escH(j.label)}}</div>
        <span class="badge" style="background:${{bg}};color:${{col}};">${{lbl}}</span>
        <div class="mcard-date" style="color:${{col}};">${{fmtDate(j.date)}} <span style="color:${{C_MUTED}};font-weight:400;">(${{diffStr}})</span></div>
        ${{j.desc?'<div class="mcard-desc">'+escH(j.desc)+'</div>':''}}
        ${{pBar}}
        ${{tList}}
    </div>`;
    }});
    html+=`</div>`;
    app.innerHTML=html;
}}
buildApp();
</script>
</body>
</html>"""

    components.html(_planning_html, height=880, scrolling=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 4 — CAHIER DES CHARGES
# ═══════════════════════════════════════════════════════════════════════════════
if page_active == "Cahier des Charges":
    _cdc_path = Path(__file__).parent / "assets" / "cahier_des_charges.html"
    if _cdc_path.exists():

        # ── Injection des données CDC dans le HTML ──────────────────────
        _cdc_initial = "null"
        _cdc_sync_token = "0"
        try:
            if _db.use_db():
                _raw_bytes = _db.load_cdc_raw()
                if _raw_bytes:
                    _raw = _raw_bytes.decode("utf-8")
                    json.loads(_raw)  # validation
                    _cdc_initial = _raw
                    _cdc_sync_token = hashlib.sha256(_raw_bytes).hexdigest()[:16]
            elif CDC_JSON_PATH.exists():
                _raw = CDC_JSON_PATH.read_text(encoding="utf-8")
                json.loads(_raw)
                _cdc_initial = _raw
                _cdc_sync_token = hashlib.sha256(_raw.encode("utf-8")).hexdigest()[:16]
        except Exception:
            pass

        _cdc_html = _cdc_path.read_text(encoding="utf-8")
        _cdc_html = _cdc_html.replace(
            "const _CDC_FILE_DATA = null;",
            f"const _CDC_FILE_DATA = {_cdc_initial};",
            1,
        )
        _cdc_html = _cdc_html.replace(
            "const _CDC_SYNC_TOKEN = '0';",
            f"const _CDC_SYNC_TOKEN = '{_cdc_sync_token}';",
            1,
        )
        _cdc_html = _cdc_html.replace(
            "const _CDC_SAVE_PORT = 0;",
            f"const _CDC_SAVE_PORT = {_get_cdc_save_port()};",
            1,
        )
        components.html(_cdc_html, height=2400, scrolling=True)
    else:
        st.error("Fichier cahier_des_charges.html introuvable.")

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE ÉQUIPE
# ═══════════════════════════════════════════════════════════════════════════════
if page_active == "Équipe":
    st.header("Équipe")
    tab_org, tab_table = st.tabs(["Organigramme", "Tableau de complétion"])

    with tab_table:
        st.caption("Le tableau ci-dessous est la source de vérité. L'organigramme est généré automatiquement à partir de ces données.")
        _table = st.session_state.equipe.drop(columns=["id"], errors="ignore")
        # Normalise les types pour éviter les incompatibilités data_editor (ex: Manager lu en float)
        for _col in ["Collaborateur", "Poste", "Manager", "Numéro", "Email"]:
            if _col not in _table.columns:
                _table[_col] = ""
            _table[_col] = _table[_col].fillna("").astype(str)
        edited = st.data_editor(
            _table,
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            key="equipe_editor",
            column_config={
                "Collaborateur": st.column_config.TextColumn("Collaborateur"),
                "Poste": st.column_config.TextColumn("Poste"),
                "Manager": st.column_config.TextColumn("Manager"),
                "Numéro": st.column_config.TextColumn("Numéro"),
                "Email": st.column_config.TextColumn("Email"),
            },
        )

        c_save, c_info = st.columns([1, 2])
        with c_save:
            if st.button("Enregistrer le tableau", use_container_width=True, type="primary"):
                _clean = edited.copy()
                _clean["Collaborateur"] = _clean["Collaborateur"].astype(str).str.strip()
                _clean["Poste"] = _clean["Poste"].fillna("").astype(str).str.strip()
                _clean["Manager"] = _clean["Manager"].fillna("").astype(str).str.strip()
                _clean["Numéro"] = _clean["Numéro"].fillna("").astype(str).str.strip()
                _clean["Email"] = _clean["Email"].fillna("").astype(str).str.strip()
                _clean = _clean[_clean["Collaborateur"] != ""].reset_index(drop=True)
                _clean.insert(0, "id", [str(uuid.uuid4()) for _ in range(len(_clean))])
                st.session_state.equipe = _clean[EQUIPE_COLONNES]
                sauvegarder_equipe()
                st.success("Tableau équipe enregistré.")
                st.rerun()
        with c_info:
            st.caption("Astuce: renseignez la colonne Manager avec le nom exact d'un collaborateur pour créer un lien hiérarchique dans l'organigramme.")

    with tab_org:
        st.caption("Vue initiale ajustée à l'écran. Utilisez la molette, les boutons +/− et le glisser-déposer pour naviguer.")
        eq = st.session_state.equipe.copy()
        if eq.empty:
            st.info("Aucune donnée équipe. Ajoutez des lignes dans le tableau de complétion.")
        else:
            eq["Collaborateur"] = eq["Collaborateur"].fillna("").astype(str).str.strip()
            eq["Poste"] = eq["Poste"].fillna("").astype(str).str.strip()
            eq["Manager"] = eq["Manager"].fillna("").astype(str).str.strip()
            if "Numéro" not in eq.columns:
                eq["Numéro"] = ""
            if "Email" not in eq.columns:
                eq["Email"] = ""
            eq["Numéro"] = eq["Numéro"].fillna("").astype(str).str.strip()
            eq["Email"] = eq["Email"].fillna("").astype(str).str.strip()
            eq = eq[eq["Collaborateur"] != ""]

            if eq.empty:
                st.info("Aucune donnée valide pour l'organigramme.")
            else:
                nodes = []
                names = []
                for _, r in eq.iterrows():
                    nm = str(r.get("Collaborateur", "")).strip()
                    if not nm:
                        continue
                    names.append(nm)
                    nodes.append({
                        "name": nm,
                        "role": str(r.get("Poste", "")).strip(),
                        "manager": str(r.get("Manager", "")).strip(),
                        "phone": str(r.get("Numéro", "")).strip(),
                        "email": str(r.get("Email", "")).strip(),
                    })

                if not nodes:
                    st.info("Aucune donnée valide pour l'organigramme.")
                else:
                    name_set = set(names)
                    children = {n: [] for n in names}
                    edges = []
                    roots = []
                    for n in nodes:
                        child = n["name"]
                        manager = n["manager"]
                        if manager and manager in name_set and manager != child:
                            children[manager].append(child)
                            edges.append((manager, child))
                        else:
                            roots.append(child)

                    roots = list(dict.fromkeys(roots))
                    if not roots and names:
                        roots = [names[0]]

                    depth = {}
                    stack = [(r, 0) for r in roots]
                    seen = set()
                    while stack:
                        cur, d = stack.pop(0)
                        if cur in seen:
                            continue
                        seen.add(cur)
                        depth[cur] = d
                        for ch in children.get(cur, []):
                            stack.append((ch, d + 1))
                    for n in names:
                        if n not in depth:
                            depth[n] = max(depth.values(), default=0) + 1

                    x_index = {}
                    _cursor = [0]

                    def _place(name, trail=None):
                        if trail is None:
                            trail = set()
                        if name in trail:
                            if name not in x_index:
                                x_index[name] = _cursor[0]
                                _cursor[0] += 1
                            return x_index[name]
                        if name in x_index:
                            return x_index[name]
                        kids = [k for k in children.get(name, []) if k != name]
                        if not kids:
                            # Nœud feuille : position séquentielle suivante
                            x_index[name] = _cursor[0]
                            _cursor[0] += 1
                            return x_index[name]
                        vals = []
                        for k in kids:
                            vals.append(_place(k, trail | {name}))
                        # Nœud parent : centrage sur ses enfants
                        x_index[name] = sum(vals) / len(vals)
                        return x_index[name]

                    for r in roots:
                        _place(r)
                    for n in names:
                        _place(n)

                    node_w = 220
                    node_h = 108
                    gap_x = 80
                    gap_y = 120
                    top_space = 90
                    margin = 36

                    pos = {}
                    for n in names:
                        px = margin + int(x_index[n] * (node_w + gap_x))
                        py = top_space + int(depth[n] * (node_h + gap_y))
                        pos[n] = (px, py)

                    min_x = min(p[0] for p in pos.values())
                    min_y = min(p[1] for p in pos.values())
                    max_x = max(p[0] for p in pos.values()) + node_w
                    max_y = max(p[1] for p in pos.values()) + node_h

                    panel_pad = 28
                    panel_x = min_x - panel_pad
                    panel_y = min_y - panel_pad
                    panel_w = (max_x - min_x) + panel_pad * 2
                    panel_h = (max_y - min_y) + panel_pad * 2

                    svg_w = max(1100, panel_x + panel_w + margin)
                    svg_h = panel_y + panel_h + margin

                    def _eh(s: str) -> str:
                        return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

                    elems = []
                    elems.append(f'<rect class="org-panel" x="{panel_x}" y="{panel_y}" width="{panel_w}" height="{panel_h}" rx="20" fill="#d6d6d8"/>')

                    for parent, child in edges:
                        if parent not in pos or child not in pos:
                            continue
                        x1 = pos[parent][0] + node_w / 2
                        y1 = pos[parent][1] + node_h
                        x2 = pos[child][0] + node_w / 2
                        y2 = pos[child][1]
                        mid = (y1 + y2) / 2
                        elems.append(f'<path class="org-edge" d="M{x1},{y1} V{mid} H{x2} V{y2}" fill="none" stroke="#7c7c7c" stroke-width="1.5"/>')

                    by_name = {n["name"]: n for n in nodes}
                    for n in names:
                        x, y = pos[n]
                        data = by_name[n]
                        name_txt = _eh(data["name"])[:42]
                        role_txt = _eh(data["role"] or "Poste")[:42]
                        phone_txt = _eh(data["phone"] or "Numéro non renseigné")[:42]
                        mail_txt = _eh(data["email"] or "Email non renseigné")[:42]
                        elems.append(f'<rect class="org-node" x="{x}" y="{y}" width="{node_w}" height="{node_h}" rx="12" fill="#e8e2db" stroke="#7c7c7c" stroke-width="1.2"/>')
                        elems.append(f'<text x="{x + node_w/2}" y="{y + 26}" text-anchor="middle" font-size="13" font-weight="700" fill="#111">{name_txt}</text>')
                        elems.append(f'<text x="{x + node_w/2}" y="{y + 46}" text-anchor="middle" font-size="12" fill="#111">{role_txt}</text>')
                        elems.append(f'<text x="{x + node_w/2}" y="{y + 68}" text-anchor="middle" font-size="11" fill="#111">{phone_txt}</text>')
                        elems.append(f'<text x="{x + node_w/2}" y="{y + 90}" text-anchor="middle" font-size="11" fill="#111">{mail_txt}</text>')

                    svg_markup = (
                        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}" style="display:block;max-width:none;">'
                        + "".join(elems)
                        + "</svg>"
                    )

                    components.html(
                        f"""
                        <style>
                        :root {{
                            --org-bg: #efefef;
                            --org-border: #e2e8f0;
                            --org-panel: #d6d6d8;
                            --org-node-bg: #e8e2db;
                            --org-node-stroke: #7c7c7c;
                            --org-edge: #7c7c7c;
                            --org-text: #111111;
                            --org-title-color: #1f2937;
                            --org-toolbar-bg: rgba(255,255,255,.92);
                            --org-toolbar-border: #d1d5db;
                            --org-btn-bg: #fff;
                            --org-btn-border: #cbd5e1;
                            --org-zoom-color: #334155;
                        }}
                        :root.dark {{
                            --org-bg: #0f172a;
                            --org-border: #334155;
                            --org-panel: #1e293b;
                            --org-node-bg: #263348;
                            --org-node-stroke: #475569;
                            --org-edge: #64748b;
                            --org-text: #f1f5f9;
                            --org-title-color: #f1f5f9;
                            --org-toolbar-bg: rgba(30,41,59,.95);
                            --org-toolbar-border: #334155;
                            --org-btn-bg: #1e293b;
                            --org-btn-border: #475569;
                            --org-zoom-color: #94a3b8;
                        }}
                          * {{ transition: background .25s, color .25s; }}
                        #org-wrap {{ width:100%; height:760px; border:1px solid var(--org-border); border-radius:10px; background:var(--org-bg); overflow:hidden; position:relative; }}
                        #org-title {{ position:absolute; left:20px; top:10px; font:600 22px/1.2 'Segoe UI',sans-serif; letter-spacing:0.08em; color:var(--org-title-color); z-index:10; }}
                        #org-toolbar {{ position:absolute; top:12px; right:12px; z-index:10; display:flex; gap:6px; background:var(--org-toolbar-bg); border:1px solid var(--org-toolbar-border); border-radius:8px; padding:6px; }}
                        #org-toolbar button {{ border:1px solid var(--org-btn-border); background:var(--org-btn-bg); color:var(--org-zoom-color); border-radius:6px; padding:4px 8px; font-size:12px; cursor:pointer; }}
                        #org-toolbar .zoom-label {{ min-width:52px; text-align:center; font-size:12px; color:var(--org-zoom-color); line-height:24px; }}
                        #org-viewport {{ width:100%; height:100%; overflow:hidden; cursor:grab; user-select:none; position:relative; }}
                        #org-viewport.dragging {{ cursor:grabbing; }}
                        #org-canvas {{ transform-origin: 0 0; position:absolute; top:0; left:0; width:max-content; height:max-content; }}
                        .org-panel {{ fill: var(--org-panel) !important; }}
                        .org-node {{ fill: var(--org-node-bg) !important; stroke: var(--org-node-stroke) !important; }}
                        .org-edge {{ stroke: var(--org-edge) !important; }}
                        #org-canvas text {{ fill: var(--org-text) !important; }}
                        </style>
                        <div id="org-wrap">
                        <div id="org-title">ORGANIGRAMME DU PROJET</div>
                        <div id="org-toolbar">
                            <button id="zoom-out" type="button">−</button>
                            <div id="zoom-label" class="zoom-label">100%</div>
                            <button id="zoom-in" type="button">+</button>
                            <button id="zoom-fit" type="button">Ajuster</button>
                            <button id="zoom-reset" type="button">100%</button>
                        </div>
                        <div id="org-viewport"><div id="org-canvas">{svg_markup}</div></div>
                        </div>
                        <script>
                        function luminanceFromColor(str) {{
                            if (!str) return null;
                            const rgb = str.match(/(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)/);
                            if (rgb) return 0.299*parseInt(rgb[1])+0.587*parseInt(rgb[2])+0.114*parseInt(rgb[3]);
                            const hex = str.trim().replace('#','');
                            if (hex.length >= 6) return 0.299*parseInt(hex.substring(0,2),16)+0.587*parseInt(hex.substring(2,4),16)+0.114*parseInt(hex.substring(4,6),16);
                            return null;
                        }}
                        function applyTheme(dark) {{
                            document.documentElement.classList.toggle('dark', dark);
                        }}
                        let _lastDark = null;
                        function onThemeChange() {{
                            try {{
                                const parentDoc  = window.parent.document;
                                const parentHtml = parentDoc.documentElement;
                                let isDark = null;
                                const attr = parentHtml.getAttribute('data-theme');
                                if (attr) {{ isDark = (attr === 'dark'); }}
                                if (isDark === null) {{
                                const cssVar = window.parent.getComputedStyle(parentHtml).getPropertyValue('--background-color').trim();
                                if (cssVar) {{ const lum = luminanceFromColor(cssVar); if (lum !== null) isDark = lum < 128; }}
                              }}
                              if (isDark === null) {{
                                for (const el of [parentDoc.querySelector('[data-testid="stApp"]'), parentDoc.body, parentHtml]) {{
                                  if (!el) continue;
                                  const bg = window.parent.getComputedStyle(el).backgroundColor;
                                  if (!bg || bg === 'transparent' || bg.includes('0, 0, 0, 0')) continue;
                                  const lum = luminanceFromColor(bg);
                                  if (lum !== null) {{ isDark = lum < 128; break; }}
                                }}
                              }}
                              if (isDark === null) isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                              if (isDark !== _lastDark) {{ _lastDark = isDark; applyTheme(isDark); }}
                            }} catch(e) {{}}
                          }}
                          try {{
                            const parentDoc = window.parent.document;
                            const obs = new MutationObserver(onThemeChange);
                            obs.observe(parentDoc.documentElement, {{attributes:true,attributeFilter:['data-theme','class','style']}});
                            obs.observe(parentDoc.body, {{attributes:true,attributeFilter:['class','style']}});
                            new MutationObserver(onThemeChange).observe(parentDoc.head, {{childList:true,subtree:true}});
                          }} catch(e) {{}}
                          setInterval(onThemeChange, 500);
                          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onThemeChange);
                          onThemeChange();

                          (function() {{
                            const viewport = document.getElementById('org-viewport');
                            const canvas = document.getElementById('org-canvas');
                            const label = document.getElementById('zoom-label');
                            if (!viewport || !canvas || !label) return;

                            let scale = 1;
                            let tx = 0, ty = 0;
                            let minScale = 0.08;
                            const maxScale = 4;
                            let dragging = false;
                            let startX = 0, startY = 0, startTx = 0, startTy = 0;

                            const baseW = {svg_w};
                            const baseH = {svg_h};
                            const TOOLBAR_H = 52;

                            function applyTransform() {{
                              canvas.style.transform = `translate(${{tx}}px, ${{ty}}px) scale(${{scale}})`;
                              label.textContent = Math.round(scale * 100) + '%';
                            }}

                            function fitToView() {{
                              const vw = viewport.clientWidth;
                              const vh = viewport.clientHeight;
                              const fit = Math.min(vw / baseW, (vh - TOOLBAR_H) / baseH);
                              minScale = Math.max(0.08, fit * 0.35);
                              scale = Math.min(1, fit);
                              tx = (vw - baseW * scale) / 2;
                              ty = TOOLBAR_H + Math.max(0, (vh - TOOLBAR_H - baseH * scale) / 2);
                              applyTransform();
                            }}

                            document.getElementById('zoom-in').addEventListener('click', function() {{
                              const cx = viewport.clientWidth / 2;
                              const cy = viewport.clientHeight / 2;
                              const prev = scale;
                              scale = Math.min(maxScale, scale * 1.15);
                              tx = cx - (cx - tx) * scale / prev;
                              ty = cy - (cy - ty) * scale / prev;
                              applyTransform();
                            }});

                            document.getElementById('zoom-out').addEventListener('click', function() {{
                              const cx = viewport.clientWidth / 2;
                              const cy = viewport.clientHeight / 2;
                              const prev = scale;
                              scale = Math.max(minScale, scale / 1.15);
                              tx = cx - (cx - tx) * scale / prev;
                              ty = cy - (cy - ty) * scale / prev;
                              applyTransform();
                            }});

                            document.getElementById('zoom-fit').addEventListener('click', fitToView);

                            document.getElementById('zoom-reset').addEventListener('click', function() {{
                              scale = 1;
                              tx = (viewport.clientWidth - baseW) / 2;
                              ty = TOOLBAR_H + Math.max(0, (viewport.clientHeight - TOOLBAR_H - baseH) / 2);
                              applyTransform();
                            }});

                            viewport.addEventListener('wheel', function(e) {{
                              e.preventDefault();
                              const rect = viewport.getBoundingClientRect();
                              const cx = e.clientX - rect.left;
                              const cy = e.clientY - rect.top;
                              const prev = scale;
                              scale = Math.max(minScale, Math.min(maxScale, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
                              tx = cx - (cx - tx) * scale / prev;
                              ty = cy - (cy - ty) * scale / prev;
                              applyTransform();
                            }}, {{ passive: false }});

                            viewport.addEventListener('mousedown', function(e) {{
                              if (e.button !== 0) return;
                              dragging = true;
                              viewport.classList.add('dragging');
                              startX = e.clientX; startY = e.clientY;
                              startTx = tx; startTy = ty;
                            }});

                            window.addEventListener('mousemove', function(e) {{
                              if (!dragging) return;
                              tx = startTx + (e.clientX - startX);
                              ty = startTy + (e.clientY - startY);
                              applyTransform();
                            }});

                            window.addEventListener('mouseup', function() {{
                              dragging = false;
                              viewport.classList.remove('dragging');
                            }});

                            fitToView();
                            window.addEventListener('resize', fitToView);
                          }})();
                        </script>
                        """,
                        height=780,
                        scrolling=False,
                    )

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 5 — AIDE PILOTAGE DE PROJET
# ═══════════════════════════════════════════════════════════════════════════════
if page_active == "Aide Pilotage":
    st.header("Aide Pilotage de Projet")
    pdf_path = Path(__file__).parent / "assets" / "Guide-CDP.pdf"
    if pdf_path.exists():
        with open(pdf_path, "rb") as f:
            st.download_button(
                "Télécharger le Guide CDP",
                data=f,
                file_name="Guide-CDP.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
    else:
        st.error("Le fichier Guide-CDP.pdf est introuvable.")

    docx_path = Path(__file__).parent / "assets" / "Cahier-des-charges.docx"
    if docx_path.exists():
        with open(docx_path, "rb") as f:
            st.download_button(
                "Télécharger le Cahier des Charges",
                data=f,
                file_name="Cahier-des-charges.docx",
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                use_container_width=True,
            )
    else:
        st.error("Le fichier Cahier-des-charges.docx est introuvable.")

    st.markdown("---")
    st.markdown("### Ressources en ligne")
    st.markdown("- [Registre des risques : guide complet (Asana)](https://asana.com/fr/resources/risk-register)")

st.markdown('<div class="page-bottom-spacing"></div>', unsafe_allow_html=True)

if page_active not in ("Planning", "Cahier des Charges", "Aide Pilotage"):
    if st.button(
        "+",
        key="floating_add",
        type="primary",
    ):
        st.session_state.open_add_risque = page_active == "Registre des Risques"
        st.session_state.open_add_tache = page_active == "Suivi des Tâches"
        st.rerun()