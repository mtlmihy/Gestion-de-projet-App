import { useEffect, useState, useCallback } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useProject } from '../context/ProjectContext'
import {
  getLiens, createLien, updateLien, setLienVisible, deleteLien,
} from '../api/liens'

// â”€â”€â”€ Types de liens prÃ©dÃ©finis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

const LinkIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const EMPTY_FORM = { libelle: '', url: '', type: 'autre', visible: true, ordre: 0 }


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

  // â”€â”€ Chargement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (saving) return
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
      alert(e?.response?.data?.detail || 'Erreur de mise Ã  jour.')
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

  // VisibilitÃ© section : toujours visible pour ceux qui peuvent Ã©diter.
  // Pour les autres : seulement s'il y a au moins un lien visible.
  const visibleLiens  = liens.filter((l) => l.visible)
  const liensAffiches = estProprietaire ? liens : visibleLiens

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-2">
        <span className="text-blue-600">{LinkIcon}</span>
        Liens du projet
      </h1>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Liens externes du projet
          </h2>
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

        {loading && <p className="text-xs text-gray-500 dark:text-slate-400">Chargementâ€¦</p>}
        {error   && <p className="text-xs text-red-500">{error}</p>}

        {!loading && !error && liensAffiches.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400 italic">
            {estProprietaire
              ? 'Aucun lien pour ce projet. Ajoutez ceux qui sont utiles Ã  l\'Ã©quipe (Jira, Miro, Teams, â€¦).'
              : 'Aucun lien partagÃ© pour ce projet.'}
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
                      {meta.label} Â· {lien.url}
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

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Modal CrÃ©ation / Ã‰dition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le lien' : 'Ajouter un lien externe'}
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              LibellÃ© <span className="text-red-500">*</span>
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
              placeholder="https://â€¦"
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
              {saving ? 'Enregistrementâ€¦' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Supprimer ce lien ?"
        message={`Le lien Â« ${confirmDel?.libelle ?? ''} Â» sera retirÃ© du projet.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}
