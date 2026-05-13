import { useEffect, useState } from 'react'

import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { useProject } from '../context/ProjectContext'
import {
  createCopil,
  createCopilNote,
  deleteCopil,
  deleteCopilNote,
  getCopilNotes,
  getCopils,
  updateCopil,
  updateCopilNote,
} from '../api/copils'

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

function CopilForm({ initial, onSubmit, onCancel, saving }) {
  const isCreate = !initial
  const [form, setForm] = useState(() => ({
    date_reunion: initial?.date_reunion ?? new Date().toISOString().slice(0, 10),
    heure_reunion: initial?.heure_reunion ?? '',
    titre: initial?.titre ?? '',
    participants: initial?.participants ?? '',
    notes: initial?.notes ?? '',
  }))

  const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const date = (form.date_reunion || '').trim()
    const heure = String(form.heure_reunion || '').slice(0, 5)
    const normalized = {
      ...form,
      titre: (form.titre ?? '').trim() || `Notes du ${date} ${heure}`,
      heure_reunion: heure,
      notes: (form.notes ?? '').trim(),
      participants: (form.participants ?? '').trim(),
    }
    onSubmit(normalized)
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Date de réunion *</label>
          <input type="date" className={inp} required value={form.date_reunion} onChange={setF('date_reunion')} />
        </div>
        <div>
          <label className={lbl}>Heure de réunion *</label>
          <input type="time" className={inp} required value={form.heure_reunion} onChange={setF('heure_reunion')} />
        </div>
      </div>

      <div>
        <label className={lbl}>Titre de la note (optionnel)</label>
        <input className={inp} maxLength={200} value={form.titre} onChange={setF('titre')} placeholder="Titre" />
        <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">Si vide, généré automatiquement.</p>
      </div>

      <div>
        <label className={lbl}>Participants</label>
        <input className={inp} value={form.participants} onChange={setF('participants')} placeholder="Participants" />
      </div>

      <div>
        <label className={lbl}>Notes de la réunion *</label>
        <textarea className={`${inp} min-h-28`} required value={form.notes} onChange={setF('notes')} placeholder="Notes" />
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
  const [expandedCopilId, setExpandedCopilId] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [notesByCopil, setNotesByCopil] = useState({})
  const [noteDraftByCopil, setNoteDraftByCopil] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
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
      const copilsRes = await getCopils(projet.id)
      const copilItems = copilsRes.data || []
      setItems(copilItems)
    } catch {
      notify('Erreur lors du chargement des notes COPIL.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projet.id])

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtDateTimeTs = (iso) => new Date(iso).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const fmtDateTime = (item) => {
    const date = fmtDate(item.date_reunion)
    if (!item.heure_reunion) return `${date} · --:--`
    return `${date} · ${String(item.heure_reunion).slice(0, 5)}`
  }

  const handleAdd = async (data) => {
    setSaving(true)
    try {
      await createCopil(projet.id, data)
      await load()
      setAddOpen(false)
      notify('Note COPIL ajoutée.')
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
      notify('Note COPIL mise à jour.')
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
      notify('Note COPIL supprimée.')
    } catch {
      notify('Erreur lors de la suppression.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddNote = async (copilId) => {
    const contenu = (noteDraftByCopil[copilId] || '').trim()
    if (!contenu) return
    setSavingNote(true)
    try {
      const { data } = await createCopilNote(copilId, { contenu })
      setNotesByCopil((prev) => ({ ...prev, [copilId]: [data, ...(prev[copilId] || [])] }))
      setNoteDraftByCopil((prev) => ({ ...prev, [copilId]: '' }))
    } catch {
      notify('Erreur lors de l\'ajout de la note.', 'error')
    } finally {
      setSavingNote(false)
    }
  }

  const loadNotesForCopil = async (copilId) => {
    try {
      const { data } = await getCopilNotes(copilId)
      setNotesByCopil((prev) => ({ ...prev, [copilId]: data || [] }))
    } catch {
      notify('Erreur lors du chargement des notes.', 'error')
    }
  }

  const toggleDetails = async (copilId) => {
    const next = expandedCopilId === copilId ? null : copilId
    setExpandedCopilId(next)
    if (next && !notesByCopil[copilId]) {
      await loadNotesForCopil(copilId)
    }
  }

  const preview = (text) => {
    const val = (text || '').trim()
    if (!val) return '—'
    return val.length > 140 ? `${val.slice(0, 140)}...` : val
  }

  const handleDeleteNote = async (copilId, noteId) => {
    setSavingNote(true)
    try {
      await deleteCopilNote(noteId)
      setNotesByCopil((prev) => ({ ...prev, [copilId]: (prev[copilId] || []).filter((n) => n.id !== noteId) }))
    } catch {
      notify('Erreur lors de la suppression de la note.', 'error')
    } finally {
      setSavingNote(false)
    }
  }

  const startEditingNote = (note) => {
    setEditingNoteId(note.id)
    setEditingNoteContent(note.contenu)
  }

  const cancelEditingNote = () => {
    setEditingNoteId(null)
    setEditingNoteContent('')
  }

  const saveEditingNote = async (copilId) => {
    const content = editingNoteContent.trim()
    if (!content) return
    setSavingNote(true)
    try {
      await updateCopilNote(editingNoteId, { contenu: content })
      setNotesByCopil((prev) => ({
        ...prev,
        [copilId]: (prev[copilId] || []).map((n) =>
          n.id === editingNoteId ? { ...n, contenu: content } : n
        ),
      }))
      setEditingNoteId(null)
      setEditingNoteContent('')
      notify('Note mise à jour.')
    } catch {
      notify('Erreur lors de la mise à jour de la note.', 'error')
    } finally {
      setSavingNote(false)
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
          <span className="hidden sm:inline">Ajouter une note</span>
        </button>
      </div>

      <Notification {...notif} />

      {loading ? (
        <div className="text-center py-14 text-sm text-gray-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Aucune note COPIL enregistrée pour ce projet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDateTime(it)}</p>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{it.titre}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Créée par : {it.createur_nom || 'Utilisateur inconnu'}</p>
                  {it.participants && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Participants : {it.participants}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleDetails(it.id)} className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">{expandedCopilId === it.id ? 'Fermer' : 'Ouvrir'}</button>
                  {!estLecteur && (
                    <>
                      <button onClick={() => setEditItem(it)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">Modifier</button>
                      <button onClick={() => setDeleteItem(it)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Supprimer</button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => toggleDetails(it.id)}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Aperçu</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{preview(it.notes)}</p>
                </section>
              </div>

              {expandedCopilId === it.id && (
                <>
              <div className="grid grid-cols-1 gap-3 text-sm mt-3">
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Notes</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{it.notes || '—'}</p>
                </section>
              </div>

              <section className="mt-3 rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Journal de notes</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{(notesByCopil[it.id] || []).length} note(s)</p>
                </div>

                {!estLecteur && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <textarea
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-16"
                      value={noteDraftByCopil[it.id] || ''}
                      onChange={(e) => setNoteDraftByCopil((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      placeholder="Saisir une note"
                    />
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={() => handleAddNote(it.id)}
                      className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                    >
                      Ajouter
                    </button>
                  </div>
                )}

                {(notesByCopil[it.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400">Aucune note pour cette réunion.</p>
                ) : (
                  <div className="space-y-3">
                    {(notesByCopil[it.id] || []).map((note) => (
                      <div key={note.id} className="rounded-md border border-gray-200 dark:border-slate-700 p-3 bg-gray-50 dark:bg-slate-700/30">
                        {editingNoteId === note.id ? (
                          <>
                            <textarea
                              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-32"
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                disabled={savingNote}
                                onClick={() => saveEditingNote(it.id)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                              >
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                disabled={savingNote}
                                onClick={cancelEditingNote}
                                className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDateTimeTs(note.created_at)}</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">Par : {note.auteur_nom || 'Utilisateur inconnu'}</p>
                              </div>
                              {!estLecteur && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => startEditingNote(note)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(it.id, note.id)}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-2">{note.contenu}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal open={addOpen} title="Nouvelle note COPIL" onClose={() => setAddOpen(false)}>
          <CopilForm
            initial={null}
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
            saving={saving}
          />
        </Modal>
      )}

      {editItem && (
        <Modal open={!!editItem} title="Modifier la note COPIL" onClose={() => setEditItem(null)}>
          <CopilForm
            initial={editItem}
            onSubmit={handleEdit}
            onCancel={() => setEditItem(null)}
            saving={saving}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        title="Supprimer la note COPIL"
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
