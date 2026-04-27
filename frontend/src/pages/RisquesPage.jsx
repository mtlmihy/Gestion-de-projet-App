import { useState, useEffect, useMemo } from 'react'
import { getRisques, createRisque, updateRisque, deleteRisque } from '../api/risques'
import { useProject } from '../context/ProjectContext'
import KpiCard from '../components/KpiCard'
import Badge, { PrioriteBadge } from '../components/Badge'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import RisqueForm from '../components/RisqueForm'

const ALL = 'Tous'

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

export default function RisquesPage() {
  const { projet } = useProject()
  const [risques,  setRisques]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [notif,    setNotif]    = useState({ msg: '', type: 'ok' })

  // Modals
  const [addOpen,    setAddOpen]    = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  // Filtres
  const [fSearch,  setFSearch]  = useState('')
  const [fStatut,  setFStatut]  = useState(ALL)
  const [fPriorite,setFPriorite]= useState(ALL)
  const [fProba,   setFProba]   = useState(ALL)
  const [fImpact,  setFImpact]  = useState(ALL)
  const [showFilters, setShowFilters] = useState(false)

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getRisques(projet.id)
      setRisques(data)
    } catch {
      notify('Erreur lors du chargement des risques.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => risques.filter((r) => {
    if (fStatut   !== ALL && r.statut      !== fStatut)    return false
    if (fPriorite !== ALL && String(r.priorite) !== fPriorite) return false
    if (fProba    !== ALL && r.probabilite !== fProba)     return false
    if (fImpact   !== ALL && r.impact      !== fImpact)    return false
    if (fSearch && !r.identifiant.toLowerCase().includes(fSearch.toLowerCase())) return false
    return true
  }), [risques, fStatut, fPriorite, fProba, fImpact, fSearch])

  // KPIs
  const total     = risques.length
  const ouverts   = risques.filter((r) => r.statut === 'Ouvert').length
  const enCours   = risques.filter((r) => r.statut === 'En cours').length
  const fermes    = risques.filter((r) => r.statut === 'Fermé').length
  const critiques = risques.filter((r) => r.priorite === 3).length

  const handleAdd = async (data) => {
    setSaving(true)
    try {
      await createRisque(projet.id, data)
      await load()
      setAddOpen(false)
      notify('Risque ajouté avec succès.')
    } catch {
      notify('Erreur lors de l\'ajout.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data) => {
    setSaving(true)
    try {
      await updateRisque(editItem.id, data)
      await load()
      setEditItem(null)
      notify('Risque modifié avec succès.')
    } catch {
      notify('Erreur lors de la modification.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await deleteRisque(deleteItem.id)
      await load()
      setDeleteItem(null)
      notify('Risque supprimé.')
    } catch {
      notify('Erreur lors de la suppression.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const selLabel = 'text-xs font-medium text-gray-600'
  const selCls   = 'border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Registre des Risques
        </h1>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">＋</span> Ajouter un risque
        </button>
      </div>

      <Notification {...notif} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Total"         value={total} />
        <KpiCard label="Ouverts"       value={ouverts}   colorClass="text-red-600" />
        <KpiCard label="En cours"      value={enCours}   colorClass="text-yellow-600" />
        <KpiCard label="Fermés"        value={fermes}    colorClass="text-green-600" />
        <KpiCard label="Critiques (P3)"value={critiques} colorClass="text-red-700" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
          onClick={() => setShowFilters((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filtres
          </span>
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showFilters && (
          <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className={selLabel}>Recherche</label>
              <input
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Identifiant…"
                value={fSearch}
                onChange={(e) => setFSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={selLabel}>Statut</label>
              <select className={selCls} value={fStatut} onChange={(e) => setFStatut(e.target.value)}>
                {[ALL, 'Ouvert', 'En cours', 'Fermé'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={selLabel}>Priorité</label>
              <select className={selCls} value={fPriorite} onChange={(e) => setFPriorite(e.target.value)}>
                {[ALL, '1', '2', '3'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={selLabel}>Probabilité</label>
              <select className={selCls} value={fProba} onChange={(e) => setFProba(e.target.value)}>
                {[ALL, 'Faible', 'Moyenne', 'Élevée'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={selLabel}>Impact</label>
              <select className={selCls} value={fImpact} onChange={(e) => setFImpact(e.target.value)}>
                {[ALL, 'Faible', 'Moyen', 'Élevé'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            {risques.length === 0 ? 'Aucun risque enregistré.' : 'Aucun risque ne correspond aux filtres.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['P', 'Identifiant', 'Catégorie', 'Probabilité', 'Impact', 'Responsable', 'Statut', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><PrioriteBadge value={r.priorite} /></td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-gray-900 truncate">{r.identifiant}</p>
                      {r.description && <p className="text-xs text-gray-400 truncate mt-0.5">{r.description}</p>}
                    </td>
                    <td className="px-4 py-3"><Badge type="categorie" value={r.categorie} /></td>
                    <td className="px-4 py-3"><Badge type="probabilite" value={r.probabilite} /></td>
                    <td className="px-4 py-3"><Badge type="impact" value={r.impact} /></td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.responsable}</td>
                    <td className="px-4 py-3"><Badge type="statut" value={r.statut} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditItem(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteItem(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} risque{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
            {filtered.length !== total && ` sur ${total}`}
          </div>
        )}
      </div>

      {/* Modal ajout */}
      <Modal open={addOpen} title="Ajouter un risque" onClose={() => setAddOpen(false)} size="lg">
        <RisqueForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={saving} />
      </Modal>

      {/* Modal édition */}
      <Modal open={!!editItem} title="Modifier le risque" onClose={() => setEditItem(null)} size="lg">
        <RisqueForm
          initial={editItem}
          onSubmit={handleEdit}
          onCancel={() => setEditItem(null)}
          loading={saving}
        />
      </Modal>

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteItem}
        title="Supprimer le risque"
        message={`Supprimer "${deleteItem?.identifiant}" ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  )
}
