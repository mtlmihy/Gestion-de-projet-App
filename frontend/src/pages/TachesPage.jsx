import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTaches, createTache, updateTache, deleteTache } from '../api/taches'
import { getCdc } from '../api/cdc'
import { useProject } from '../context/ProjectContext'
import KpiCard from '../components/KpiCard'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import TacheForm from '../components/TacheForm'

const ALL = 'Tous'

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

export default function TachesPage() {
  const { projet, estLecteur } = useProject()
  const [searchParams, setSearchParams] = useSearchParams()
  const jalonFromUrl = searchParams.get('jalon') || ''
  const [taches,     setTaches]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [notif,      setNotif]      = useState({ msg: '', type: 'ok' })
  const [addOpen,    setAddOpen]    = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [fSearch,    setFSearch]    = useState('')
  const [fImportance,setFImportance]= useState(ALL)
  const [fJalon,     setFJalon]     = useState(jalonFromUrl || ALL)
  const [showFilters,setShowFilters]= useState(Boolean(jalonFromUrl))
  const [jalonsOptions, setJalonsOptions] = useState([])

  // Si l'URL reçoit un nouveau ?jalon=..., synchroniser le filtre
  useEffect(() => {
    if (jalonFromUrl) {
      setFJalon(jalonFromUrl)
      setShowFilters(true)
    }
  }, [jalonFromUrl])

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = async () => {
    setLoading(true)
    try { const { data } = await getTaches(projet.id); setTaches(data) }
    catch { notify('Erreur lors du chargement.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    getCdc(projet.id).then(({ data }) => {
      try {
        const raw = typeof data.contenu === 'string' ? JSON.parse(data.contenu) : (data.contenu ?? {})
        const noms = (raw.jalons ?? [])
          .map((j) => Array.isArray(j) ? j[0] : (j.nom ?? ''))
          .filter(Boolean)
        setJalonsOptions(noms)
      } catch { /* pas de CDC */ }
    }).catch(() => {})
  }, [])

  const jalonsDisponibles = useMemo(() => [ALL, ...new Set(taches.map((t) => t.jalon).filter(Boolean))], [taches])

  const filtered = useMemo(() => taches.filter((t) => {
    if (fImportance !== ALL && t.importance !== fImportance) return false
    if (fJalon      !== ALL && t.jalon      !== fJalon)      return false
    if (fSearch && !t.nom.toLowerCase().includes(fSearch.toLowerCase())) return false
    return true
  }), [taches, fImportance, fJalon, fSearch])

  const avgAvancement = taches.length
    ? Math.round(taches.reduce((s, t) => s + (t.avancement || 0), 0) / taches.length)
    : 0
  const critiques = taches.filter((t) => t.importance === 'Critique').length
  const jalonsCount = new Set(taches.map((t) => t.jalon).filter(Boolean)).size

  const handleAdd = async (data) => {
    setSaving(true)
    try   { await createTache(projet.id, data); await load(); setAddOpen(false); notify('Tâche ajoutée.') }
    catch { notify('Erreur lors de l\'ajout.', 'error') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    setSaving(true)
    try { await updateTache(editItem.id, data); await load(); setEditItem(null); notify('Tâche modifiée.') }
    catch { notify('Erreur lors de la modification.', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteTache(deleteItem.id); await load(); setDeleteItem(null); notify('Tâche supprimée.') }
    catch { notify('Erreur lors de la suppression.', 'error') }
    finally { setSaving(false) }
  }

  const selCls = 'border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Suivi des Tâches
        </h1>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          hidden={estLecteur}
        >
          <span className="text-lg leading-none">＋</span> Ajouter une tâche
        </button>
      </div>

      <Notification {...notif} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total"           value={taches.length} />
        <KpiCard label="Avancement moy." value={`${avgAvancement} %`} colorClass="text-blue-600" />
        <KpiCard label="Critiques"       value={critiques}   colorClass="text-red-600" />
        <KpiCard label="Jalons"          value={jalonsCount} colorClass="text-purple-600" />
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm mb-4">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-slate-300"
          onClick={() => setShowFilters((v) => !v)}
        >
          <span>Filtres</span>
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {showFilters && (
          <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Recherche</label>
              <input className="border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Nom…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Importance</label>
              <select className={selCls} value={fImportance} onChange={(e) => setFImportance(e.target.value)}>
                {[ALL, 'Faible', 'Moyenne', 'Élevée', 'Critique'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Jalon</label>
              <select className={selCls} value={fJalon} onChange={(e) => {
                const v = e.target.value
                setFJalon(v)
                // Garder l'URL synchronisée avec le filtre jalon
                const next = new URLSearchParams(searchParams)
                if (v && v !== ALL) next.set('jalon', v)
                else next.delete('jalon')
                setSearchParams(next, { replace: true })
              }}>
                {jalonsDisponibles.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">Aucune tâche.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <tr>
                  {['Importance', 'Nom', 'Assigné', 'Jalon', 'Avancement', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-3"><Badge type="importance" value={t.importance} /></td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{t.nom}</p>
                      {t.description && <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">{t.assigne}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">{t.jalon || '—'}</td>
                    <td className="px-4 py-3 min-w-[100px]"><ProgressBar value={t.avancement} /></td>
                    <td className="px-4 py-3">
                      {!estLecteur && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditItem(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Modifier">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => setDeleteItem(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Supprimer">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500">
            {filtered.length} tâche{filtered.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <Modal open={addOpen} title="Ajouter une tâche" onClose={() => setAddOpen(false)} size="lg">
        <TacheForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={saving} jalonsOptions={jalonsOptions} />
      </Modal>

      <Modal open={!!editItem} title="Modifier la tâche" onClose={() => setEditItem(null)} size="lg">
        <TacheForm initial={editItem} onSubmit={handleEdit} onCancel={() => setEditItem(null)} loading={saving} jalonsOptions={jalonsOptions} />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Supprimer la tâche"
        message={`Supprimer "${deleteItem?.nom}" ?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  )
}
