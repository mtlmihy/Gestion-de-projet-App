import { useEffect, useState, useCallback } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useProject } from '../context/ProjectContext'
import {
  getLiens, createLien, updateLien, setLienVisible, deleteLien,
} from '../api/liens'

// ─── Types de liens prédéfinis (libre + presets visuels) ─────────────────────
const TYPES = [
  { value: 'jira',       label: 'Jira',                color: 'text-blue-600',                       bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { value: 'miro',       label: 'Miro',                color: 'text-yellow-500',                     bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  { value: 'teams',      label: 'Teams',               color: 'text-purple-600',                     bg: 'bg-purple-50 dark:bg-purple-950/40' },
  { value: 'confluence', label: 'Confluence',          color: 'text-sky-600',                        bg: 'bg-sky-50 dark:bg-sky-950/40' },
  { value: 'github',     label: 'GitHub',              color: 'text-gray-700 dark:text-slate-300',   bg: 'bg-gray-100 dark:bg-slate-700/40' },
  { value: 'drive',      label: 'Drive / SharePoint',  color: 'text-green-600',                      bg: 'bg-green-50 dark:bg-green-950/40' },
  { value: 'autre',      label: 'Autre',               color: 'text-gray-500 dark:text-slate-400',   bg: 'bg-gray-50 dark:bg-slate-700/40' },
]
const TYPE_META = Object.fromEntries(TYPES.map((t) => [t.value, t]))

// Petite icône SVG générique « lien externe »
const LinkIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const EMPTY_FORM = { libelle: '', url: '', type: 'autre', visible: true, ordre: 0 }


// ─── Sections d'aide statiques ───────────────────────────────────────────────
const SECTIONS = [
  {
    title: 'Registre des Risques',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    items: [
      'Ajoutez des risques via le bouton « Ajouter un risque ».',
      'La priorité (P1/P2/P3) est calculée automatiquement : Probabilité × Impact.',
      'Filtrez par statut, priorité, probabilité, impact ou identifiant.',
      'P3 = risque critique (score ≥ 6), P2 = modéré (score ≥ 3), P1 = faible.',
      'Passez les risques traités en statut « Fermé » pour les archiver.',
    ],
  },
  {
    title: 'Suivi des Tâches',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    items: [
      'Créez des tâches et assignez-les à un collaborateur de l\'équipe.',
      'Associez chaque tâche à un jalon pour l\'afficher dans le Planning.',
      'L\'avancement (0–100 %) est mis à jour via le curseur dans le formulaire.',
      'Les tâches « Critique » sont remontées dans les KPIs.',
    ],
  },
  {
    title: 'Planning',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    items: [
      'La timeline est construite à partir des jalons du Cahier des Charges.',
      'Les tâches sont groupées sous leur jalon correspondant.',
      'Un point bleu indique le jalon du jour, vert = passé, gris = futur.',
      'Définissez les jalons dans la page « Cahier des Charges ».',
    ],
  },
  {
    title: 'Cahier des Charges',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    items: [
      'Remplissez le cahier des charges section par section.',
      'Cliquez sur « Sauvegarder » pour enregistrer en base de données.',
      'La section Jalons alimente directement la page Planning.',
      'L\'historique des versions permet de tracer les évolutions du document.',
    ],
  },
  {
    title: 'Équipe',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    items: [
      'Gérez les membres de l\'équipe : collaborateur, poste, manager, contact.',
      'Les noms de collaborateurs peuvent être utilisés dans le champ « Assigné » des tâches.',
      'L\'avatar est généré automatiquement à partir des initiales.',
    ],
  },
  {
    title: 'Accès & Sécurité',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    items: [
      'L\'accès est protégé par un mot de passe (hash SHA-256 en base).',
      'Le JWT est stocké dans un cookie HttpOnly — invisible depuis JavaScript.',
      'La session expire automatiquement après 8 heures.',
      'Utilisez le bouton « Déconnexion » pour mettre fin à la session.',
    ],
  },
]


// ─── Composant principal ─────────────────────────────────────────────────────
export default function AidePage() {
  const { projet, estProprietaire } = useProject()
  const projetId = projet?.id

  const [liens, setLiens]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  const [confirmDel, setConfirmDel] = useState(null)

  // ── Chargement ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!projetId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getLiens(projetId)
      setLiens(data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Impossible de charger les liens.')
    } finally {
      setLoading(false)
    }
  }, [projetId])

  useEffect(() => { refresh() }, [refresh])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit   = (lien) => {
    setEditing(lien)
    setForm({
      libelle: lien.libelle, url: lien.url, type: lien.type,
      visible: lien.visible, ordre: lien.ordre ?? 0,
    })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await updateLien(projetId, editing.id, form)
      else         await createLien(projetId, form)
      setModalOpen(false)
      await refresh()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const toggleVisible = async (lien) => {
    try {
      await setLienVisible(projetId, lien.id, !lien.visible)
      await refresh()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Erreur de mise à jour.')
    }
  }

  const confirmDelete = async () => {
    if (!confirmDel) return
    try {
      await deleteLien(projetId, confirmDel.id)
      setConfirmDel(null)
      await refresh()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Erreur lors de la suppression.')
    }
  }

  // Pas de "champ vide" : si aucun lien visible et qu'on n'est pas propriétaire,
  // la section ne s'affiche pas du tout.
  const visibleLiens     = liens.filter((l) => l.visible)
  const liensAffiches    = estProprietaire ? liens : visibleLiens
  const showLiensSection = estProprietaire || visibleLiens.length > 0

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Aide Pilotage
      </h1>

      {/* ─────────────── Section Liens externes du projet ─────────────── */}
      {showLiensSection && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">{LinkIcon}</span>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Liens externes du projet
              </h2>
            </div>
            {estProprietaire && (
              <button
                onClick={openCreate}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Ajouter un lien
              </button>
            )}
          </div>

          {loading && <p className="text-xs text-gray-500 dark:text-slate-400">Chargement…</p>}
          {error   && <p className="text-xs text-red-500">{error}</p>}

          {!loading && !error && liens.length === 0 && estProprietaire && (
            <p className="text-xs text-gray-500 dark:text-slate-400 italic">
              Aucun lien pour ce projet. Ajoutez ceux qui sont utiles à l'équipe (Jira, Miro, Teams, …).
            </p>
          )}

          {!loading && !error && liensAffiches.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {liensAffiches.map((lien) => {
                const meta = TYPE_META[lien.type] ?? TYPE_META.autre
                const masque = !lien.visible
                return (
                  <li
                    key={lien.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 ${meta.bg} ${masque ? 'opacity-60' : ''}`}
                  >
                    <span className={`shrink-0 ${meta.color}`}>{LinkIcon}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={lien.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm font-medium text-gray-900 dark:text-slate-100 hover:underline truncate"
                        title={lien.url}
                      >
                        {lien.libelle}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {meta.label} · {lien.url}
                      </p>
                    </div>
                    {estProprietaire && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleVisible(lien)}
                          title={lien.visible ? 'Masquer aux autres membres' : 'Rendre visible'}
                          className="p-1.5 rounded hover:bg-white/60 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400"
                        >
                          {lien.visible ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(lien)}
                          title="Modifier"
                          className="p-1.5 rounded hover:bg-white/60 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button
                          onClick={() => setConfirmDel(lien)}
                          title="Supprimer"
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ─────────────── Sections d'aide statiques ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map(({ title, icon, items }) => (
          <div key={title} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600">{icon}</span>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
            </div>
            <ul className="space-y-1.5">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Légende priorités */}
      <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Matrice Probabilité × Impact</h2>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-200 dark:border-slate-600 px-3 py-2 bg-gray-50 dark:bg-slate-700 text-xs font-semibold text-gray-500 dark:text-slate-400"></th>
                {['Faible', 'Moyen', 'Élevé'].map((i) => (
                  <th key={i} className="border border-gray-200 dark:border-slate-600 px-3 py-2 bg-gray-50 dark:bg-slate-700 text-xs font-semibold text-gray-500 dark:text-slate-400">{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Élevée',  '🟡 P2 (6)', '🔴 P3 (6)', '🔴 P3 (9)'],
                ['Moyenne', '🟢 P1 (2)', '🟡 P2 (4)', '🔴 P3 (6)'],
                ['Faible',  '🟢 P1 (1)', '🟢 P1 (2)', '🟡 P2 (3)'],
              ].map(([proba, ...cells]) => (
                <tr key={proba}>
                  <td className="border border-gray-200 dark:border-slate-600 px-3 py-2 bg-gray-50 dark:bg-slate-700 text-xs font-semibold text-gray-500 dark:text-slate-400">{proba}</td>
                  {cells.map((c, ci) => (
                    <td key={ci} className="border border-gray-200 dark:border-slate-600 px-3 py-2 text-center text-xs">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Probabilité (ligne) × Impact (colonne) = Score → P1 (&lt;3) / P2 (3–5) / P3 (≥6)</p>
        </div>
      </div>

      {/* ─────────────── Modal Création / Édition ─────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le lien' : 'Ajouter un lien externe'}
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Libellé <span className="text-red-500">*</span>
            </label>
            <input
              required
              maxLength={100}
              value={form.libelle}
              onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
              placeholder="ex: Tableau Jira du projet"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://…"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Type d'outil
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="lien-visible"
              type="checkbox"
              checked={form.visible}
              onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))}
              className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="lien-visible" className="text-sm text-gray-700 dark:text-slate-300">
              Visible par les autres membres du projet
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────── Confirmation suppression ─────────────── */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Supprimer ce lien ?"
        message={`Le lien « ${confirmDel?.libelle ?? ''} » sera retiré du projet.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}
