import { useEffect, useMemo, useState } from 'react'

import ConfirmDialog from '../components/ConfirmDialog'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import { useProject } from '../context/ProjectContext'
import { createCopil, deleteCopil, getCopils, updateCopil } from '../api/copils'

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

function CopilForm({ initial, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    date_reunion: initial?.date_reunion ?? new Date().toISOString().slice(0, 10),
    titre: initial?.titre ?? '',
    participants: initial?.participants ?? '',
    notes: initial?.notes ?? '',
    decisions: initial?.decisions ?? '',
    actions: initial?.actions ?? '',
  }))

  const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Date de réunion *</label>
          <input type="date" className={inp} required value={form.date_reunion} onChange={setF('date_reunion')} />
        </div>
        <div>
          <label className={lbl}>Titre *</label>
          <input className={inp} required minLength={3} maxLength={200} value={form.titre} onChange={setF('titre')} placeholder="COPIL #12 - Suivi mensuel" />
        </div>
      </div>

      <div>
        <label className={lbl}>Participants</label>
        <input className={inp} value={form.participants} onChange={setF('participants')} placeholder="Thalïa, Louis-Marie, Client X" />
      </div>

      <div>
        <label className={lbl}>Notes de réunion</label>
        <textarea className={`${inp} min-h-24`} value={form.notes} onChange={setF('notes')} placeholder="Contexte, points clés, blocages..." />
      </div>

      <div>
        <label className={lbl}>Décisions</label>
        <textarea className={`${inp} min-h-20`} value={form.decisions} onChange={setF('decisions')} placeholder="Décisions actées en COPIL..." />
      </div>

      <div>
        <label className={lbl}>Actions de suivi</label>
        <textarea className={`${inp} min-h-20`} value={form.actions} onChange={setF('actions')} placeholder="Qui fait quoi pour quand..." />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-lg py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Annuler</button>
        <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-semibold transition-colors">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export default function CopilPage() {
  const { projet, estLecteur } = useProject()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notif, setNotif] = useState({ msg: '', type: 'ok' })
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getCopils(projet.id)
      setItems(data)
    } catch {
      notify('Erreur lors du chargement des réunions COPIL.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projet.id])

  const kpis = useMemo(() => {
    const total = items.length
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const ceMois = items.filter((i) => {
      const d = new Date(i.date_reunion)
      return d.getFullYear() === y && d.getMonth() === m
    }).length
    const decisions = items.filter((i) => (i.decisions ?? '').trim().length > 0).length
    const actions = items.filter((i) => (i.actions ?? '').trim().length > 0).length
    return { total, ceMois, decisions, actions }
  }, [items])

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const handleAdd = async (data) => {
    setSaving(true)
    try {
      await createCopil(projet.id, data)
      await load()
      setAddOpen(false)
      notify('Réunion COPIL ajoutée.')
    } catch {
      notify('Erreur lors de la création.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data) => {
    setSaving(true)
    try {
      await updateCopil(editItem.id, data)
      await load()
      setEditItem(null)
      notify('Réunion COPIL mise à jour.')
    } catch {
      notify('Erreur lors de la modification.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await deleteCopil(deleteItem.id)
      await load()
      setDeleteItem(null)
      notify('Réunion COPIL supprimée.')
    } catch {
      notify('Erreur lors de la suppression.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M8 10h8M8 14h6"/><rect x="3" y="4" width="18" height="16" rx="2"/>
          </svg>
          Suivi COPIL
        </h1>
        <button
          onClick={() => setAddOpen(true)}
          hidden={estLecteur}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Ajouter une réunion</span>
        </button>
      </div>

      <Notification {...notif} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Réunions" value={kpis.total} />
        <KpiCard label="Ce mois" value={kpis.ceMois} colorClass="text-blue-600" />
        <KpiCard label="Décisions" value={kpis.decisions} colorClass="text-purple-600" />
        <KpiCard label="Actions" value={kpis.actions} colorClass="text-orange-600" />
      </div>

      {loading ? (
        <div className="text-center py-14 text-sm text-gray-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Aucune réunion COPIL enregistrée pour ce projet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDate(it.date_reunion)}</p>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{it.titre}</h3>
                  {it.participants && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Participants : {it.participants}</p>}
                </div>
                {!estLecteur && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditItem(it)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">Modifier</button>
                    <button onClick={() => setDeleteItem(it)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Supprimer</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Notes</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{it.notes || '—'}</p>
                </section>
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Décisions</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{it.decisions || '—'}</p>
                </section>
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Actions</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{it.actions || '—'}</p>
                </section>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal title="Nouvelle réunion COPIL" onClose={() => setAddOpen(false)}>
          <CopilForm initial={null} onSubmit={handleAdd} onCancel={() => setAddOpen(false)} saving={saving} />
        </Modal>
      )}

      {editItem && (
        <Modal title="Modifier la réunion COPIL" onClose={() => setEditItem(null)}>
          <CopilForm initial={editItem} onSubmit={handleEdit} onCancel={() => setEditItem(null)} saving={saving} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        title="Supprimer la réunion COPIL"
        message={`Supprimer "${deleteItem?.titre ?? ''}" ?`}
        confirmText="Supprimer"
        cancelText="Annuler"
        danger
        loading={saving}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
