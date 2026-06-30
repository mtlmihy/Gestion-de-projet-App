import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTaches, createTache, updateTache, deleteTache } from '../api/taches'
import { getCdc } from '../api/cdc'
import { getEquipe } from '../api/equipe'
import { useProject } from '../context/ProjectContext'
import KpiCard from '../components/KpiCard'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import TacheForm from '../components/TacheForm'
import DonutChart from '../components/DonutChart'
import Notification from '../components/Notification'
import { useCrudResource } from '../hooks/useCrudResource'
import { exportCSV } from '../utils/export'

const ALL = 'Tous'
const STATUTS = ['A faire', 'En cours', 'Terminée', 'Bloquée']

function statutCls(statut) {
  if (statut === 'Terminée') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (statut === 'En cours') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (statut === 'Bloquée')  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
}

export default function TachesPage() {
  const { projet, estLecteur } = useProject()
  const [searchParams, setSearchParams] = useSearchParams()
  const jalonFromUrl = (searchParams.get('jalon') || '').trim()
  const [addOpen,    setAddOpen]    = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [fSearch,    setFSearch]    = useState('')
  const [fImportance,setFImportance]= useState(ALL)
  const [fJalon,     setFJalon]     = useState(jalonFromUrl || ALL)
  const [fStatut,    setFStatut]    = useState(ALL)
  const [showFilters,setShowFilters]= useState(Boolean(jalonFromUrl))
  const [jalonsOptions, setJalonsOptions] = useState([])
  const [membresOptions, setMembresOptions] = useState([])
  const addInitial = useMemo(() => ({
    nom: '',
    description: '',
    importance: 'Moyenne',
    avancement: 0,
    assigne: '',
    jalon: fJalon !== ALL ? fJalon : '',
    statut: 'A faire',
  }), [fJalon])

  // Si l'URL reçoit un nouveau ?jalon=..., synchroniser le filtre
  useEffect(() => {
    if (jalonFromUrl) {
      setFJalon(jalonFromUrl)
      setShowFilters(true)
    }
  }, [jalonFromUrl])

  const fetchList = useCallback(() => getTaches(projet.id), [projet.id])
  const { items: taches, loading, saving, notif, load, runMutation } = useCrudResource(fetchList)

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
    getEquipe(projet.id).then(({ data }) => {
      const noms = (data ?? []).map((m) => (m.collaborateur ?? '').trim()).filter(Boolean)
      setMembresOptions(noms)
    }).catch(() => {})
  }, [load, projet.id])

  const jalonsDisponibles = useMemo(() => {
    // Fusion : jalons du CDC + jalons utilisés par les tâches + filtre courant (au cas où)
    const set = new Set()
    jalonsOptions.forEach((j) => { const v = (j ?? '').trim(); if (v) set.add(v) })
    taches.forEach((t) => { const v = (t.jalon ?? '').trim(); if (v) set.add(v) })
    if (fJalon && fJalon !== ALL) set.add(fJalon.trim())
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))]
  }, [taches, jalonsOptions, fJalon])

  const filtered = useMemo(() => {
    const q   = fSearch.trim().toLowerCase()
    const jf  = fJalon.trim()
    return taches.filter((t) => {
      if (fImportance !== ALL && (t.importance ?? '') !== fImportance) return false
      if (jf !== ALL && (t.jalon ?? '').trim() !== jf) return false
      if (fStatut !== ALL && (t.statut ?? 'A faire') !== fStatut) return false
      if (q) {
        const hay = `${t.nom ?? ''} ${t.assigne ?? ''} ${t.jalon ?? ''} ${t.description ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [taches, fImportance, fJalon, fStatut, fSearch])

  const activeFiltersCount = (fImportance !== ALL ? 1 : 0) + (fJalon !== ALL ? 1 : 0) + (fStatut !== ALL ? 1 : 0) + (fSearch.trim() ? 1 : 0)

  // Ouvre automatiquement le panneau si un filtre est actif
  useEffect(() => {
    if (activeFiltersCount > 0) setShowFilters(true)
  }, [activeFiltersCount])

  const resetFilters = () => {
    setFSearch('')
    setFImportance(ALL)
    setFJalon(ALL)
    setFStatut(ALL)
    const next = new URLSearchParams(searchParams)
    next.delete('jalon')
    setSearchParams(next, { replace: true })
  }

  const avgAvancement = taches.length
    ? Math.round(taches.reduce((s, t) => s + (t.avancement || 0), 0) / taches.length)
    : 0
  const critiques = taches.filter((t) => t.importance === 'Critique').length
  const jalonsCount = new Set(taches.map((t) => t.jalon).filter(Boolean)).size

  const terminees = taches.filter((t) => (t.avancement ?? 0) >= 100).length
  const enCours   = taches.filter((t) => (t.avancement ?? 0) > 0 && (t.avancement ?? 0) < 100).length
  const aFaire    = taches.filter((t) => (t.avancement ?? 0) === 0).length
  const donutSlices = [
    { label: 'Terminées', value: terminees, color: '#16a34a' },
    { label: 'En cours',  value: enCours,   color: '#2563eb' },
    { label: 'À faire',   value: aFaire,    color: '#94a3b8' },
  ]

  const handleAdd = async (data) => {
    const ok = await runMutation(() => createTache(projet.id, data), 'Tâche ajoutée.', 'Erreur lors de l\'ajout.')
    if (ok) setAddOpen(false)
  }

  const handleEdit = async (data) => {
    const ok = await runMutation(() => updateTache(editItem.id, data), 'Tâche modifiée.', 'Erreur lors de la modification.')
    if (ok) setEditItem(null)
  }

  const handleDelete = async () => {
    const ok = await runMutation(() => deleteTache(deleteItem.id), 'Tâche supprimée.', 'Erreur lors de la suppression.')
    if (ok) setDeleteItem(null)
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
        <div className="flex items-center gap-2">
          {taches.length > 0 && (
            <button
              onClick={() => exportCSV(
                'taches',
                ['Nom', 'Assigné', 'Statut', 'Jalon', 'Importance', 'Charge (j)', 'Charge (h)', 'Avancement (%)', 'Description'],
                taches.map((t) => [
                  t.nom, t.assigne, t.statut ?? 'A faire', t.jalon || '', t.importance,
                  t.charge_jours != null ? t.charge_jours : '',
                  t.charge_jours != null ? (t.charge_jours * 8).toFixed(1) : '',
                  t.avancement ?? 0, t.description || '',
                ])
              )}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 transition-colors"
              title="Exporter CSV"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSV
            </button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-colors"
            hidden={estLecteur}
          >
            <span className="text-lg leading-none">＋</span>
            <span className="hidden sm:inline">Ajouter une tâche</span>
          </button>
        </div>
      </div>

      <Notification {...notif} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total"           value={taches.length} />
        <KpiCard label="Avancement moy." value={`${avgAvancement} %`} colorClass="text-blue-600" />
        <KpiCard label="Critiques"       value={critiques}   colorClass="text-red-600" />
        <KpiCard label="Jalons"          value={jalonsCount} colorClass="text-purple-600" />
      </div>

      {/* Répartition par statut */}
      {taches.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm px-5 py-4 mb-4 flex items-center gap-6">
          <div className="w-20 flex-shrink-0">
            <DonutChart slices={donutSlices} title={`${avgAvancement}`} size={80} />
          </div>
          <div className="flex flex-wrap gap-4">
            {donutSlices.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  <strong>{s.value}</strong> {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="ml-auto text-[.65rem] text-gray-300 dark:text-slate-600 italic">Répartition des tâches</div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm mb-4">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-slate-300"
          onClick={() => setShowFilters((v) => !v)}
        >
          <span className="flex items-center gap-2">
            Filtres
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[.65rem] font-bold rounded-full bg-blue-600 text-white">
                {activeFiltersCount}
              </span>
            )}
            {!loading && (
              <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">
                · {filtered.length} / {taches.length} tâche{taches.length > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {showFilters && (
          <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Recherche</label>
                <input className="border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Rechercher" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Importance</label>
                <select className={selCls} value={fImportance} onChange={(e) => setFImportance(e.target.value)}>
                  {[ALL, 'Faible', 'Moyenne', 'Élevée', 'Critique'].map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Statut</label>
                <select className={selCls} value={fStatut} onChange={(e) => setFStatut(e.target.value)}>
                  {[ALL, ...STATUTS].map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Jalon</label>
                <select className={selCls} value={fJalon} onChange={(e) => {
                  const v = e.target.value
                  setFJalon(v)
                  const next = new URLSearchParams(searchParams)
                  if (v && v !== ALL) next.set('jalon', v)
                  else next.delete('jalon')
                  setSearchParams(next, { replace: true })
                }}>
                  {jalonsDisponibles.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
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
          <div className="overflow-x-auto scrollbar-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <tr>
                  {['Importance', 'Nom', 'Assigné', 'Statut', 'Jalon', 'Charge', 'Avancement', ''].map((h) => (
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${statutCls(t.statut ?? 'A faire')}`}>
                        {t.statut ?? 'A faire'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">{t.jalon || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs whitespace-nowrap">
                      {t.charge_jours != null
                        ? <span title={`${(t.charge_jours * 8).toFixed(1)}h`}>{t.charge_jours}j</span>
                        : <span className="text-gray-300 dark:text-slate-600">-</span>
                      }
                    </td>
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
        <TacheForm initial={addInitial} onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={saving} jalonsOptions={jalonsOptions} membresOptions={membresOptions} />
      </Modal>

      <Modal open={!!editItem} title="Modifier la tâche" onClose={() => setEditItem(null)} size="lg">
        <TacheForm initial={editItem} onSubmit={handleEdit} onCancel={() => setEditItem(null)} loading={saving} jalonsOptions={jalonsOptions} membresOptions={membresOptions} />
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
