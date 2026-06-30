import { useState, useEffect, useCallback } from 'react'
import { useProject } from '../context/ProjectContext'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { getDepenses, createDepense, updateDepense, deleteDepense } from '../api/budget'
import DonutChart from '../components/DonutChart'
import { exportCSV } from '../utils/export'

const CATEGORIES = ['Prestation', 'Matériel', 'Déplacement', 'Formation', 'Sous-traitance', 'Autre']

const CAT_COLORS = {
  'Prestation':      'bg-blue-100  text-blue-800  dark:bg-blue-900/40  dark:text-blue-300',
  'Matériel':        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Déplacement':     'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Formation':       'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300',
  'Sous-traitance':  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Autre':           'bg-gray-100   text-gray-700   dark:bg-slate-700     dark:text-slate-300',
}

const CAT_HEX = {
  'Prestation':     '#2563eb',
  'Matériel':       '#eab308',
  'Déplacement':    '#9333ea',
  'Formation':      '#16a34a',
  'Sous-traitance': '#ea580c',
  'Autre':          '#94a3b8',
}

const EMPTY_FORM = { date: new Date().toISOString().slice(0, 10), categorie: 'Autre', description: '', montant: '', assigne: '' }

function fmt(n, devise = 'CHF') {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: devise }).format(n)
}

function DepenseModal({ open, initial, devise, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { date: initial.date, categorie: initial.categorie, description: initial.description, montant: String(initial.montant), assigne: initial.assigne || '' }
        : { ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) }
      )
      setError('')
    }
  }, [open, initial])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    const montant = parseFloat(form.montant)
    if (isNaN(montant) || montant < 0) { setError('Montant invalide.'); return }
    setSaving(true)
    try {
      await onSave({ ...form, montant })
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de la sauvegarde.')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} title={initial ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1" htmlFor="depense-date">Date *</label>
            <input id="depense-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} required
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1" htmlFor="depense-categorie">Catégorie *</label>
            <select id="depense-categorie" value={form.categorie} onChange={e => set('categorie', e.target.value)} required
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1" htmlFor="depense-description">Description</label>
          <input id="depense-description" type="text" value={form.description} onChange={e => set('description', e.target.value)} maxLength={200}
            placeholder="Description"
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1" htmlFor="depense-montant">Montant ({devise}) *</label>
            <input id="depense-montant" type="number" min="0" step="0.01" value={form.montant} onChange={e => set('montant', e.target.value)} required
              placeholder="Montant"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1" htmlFor="depense-assigne">Assigné à</label>
            <input id="depense-assigne" type="text" value={form.assigne} onChange={e => set('assigne', e.target.value)} maxLength={100}
              placeholder="Nom ou équipe"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium">
            Annuler
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function BudgetPage() {
  const { projet, estLecteur } = useProject()
  const [lignes, setLignes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [modal, setModal]   = useState({ open: false, item: null })
  const [confirm, setConfirm] = useState({ open: false, id: null })
  const [filterCat, setFilterCat] = useState('Toutes')
  const [filterAssigne, setFilterAssigne] = useState('Tous')

  const devise = projet?.devise || 'CHF'

  const load = useCallback(async () => {
    if (!projet?.id) return
    setLoading(true)
    try {
      const { data } = await getDepenses(projet.id)
      setLignes(data)
    } catch { setError('Impossible de charger les dépenses.') }
    finally { setLoading(false) }
  }, [projet?.id])

  useEffect(() => { load() }, [load])

  // ── Guard : projet non-Client ──────────────────────────────────────────────
  if (!projet) return (
    <div className="p-8 text-center text-gray-500 dark:text-slate-400">
      Aucun projet sélectionné.
    </div>
  )

  if (projet.type_projet !== 'Client') return (
    <div className="p-8 text-center">
      <p className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">Suivi budgétaire non disponible</p>
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Cette fonctionnalité est réservée aux projets de type <strong>Client</strong>.
      </p>
    </div>
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalDepense = lignes.reduce((s, l) => s + Number(l.montant), 0)
  const budgetPrevu  = Number(projet.budget_prevu || 0)
  const solde        = budgetPrevu - totalDepense
  const pct          = budgetPrevu > 0 ? Math.min(100, (totalDepense / budgetPrevu) * 100) : null

  const donutSlices = CATEGORIES
    .map((cat) => ({
      label: cat,
      value: lignes.filter((l) => l.categorie === cat).reduce((s, l) => s + Number(l.montant), 0),
      color: CAT_HEX[cat] || '#94a3b8',
    }))
    .filter((s) => s.value > 0)

  const assignesListe = ['Tous', ...Array.from(new Set(lignes.map((l) => l.assigne).filter(Boolean))).sort()]
  const visible = lignes.filter((l) => {
    if (filterCat !== 'Toutes' && l.categorie !== filterCat) return false
    if (filterAssigne !== 'Tous' && l.assigne !== filterAssigne) return false
    return true
  })

  async function handleSave(data) {
    if (modal.item) {
      const { data: updated } = await updateDepense(modal.item.id, data)
      setLignes(prev => prev.map(l => l.id === updated.id ? updated : l))
    } else {
      const { data: created } = await createDepense(projet.id, data)
      setLignes(prev => [created, ...prev])
    }
  }

  async function handleDelete() {
    await deleteDepense(confirm.id)
    setLignes(prev => prev.filter(l => l.id !== confirm.id))
    setConfirm({ open: false, id: null })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Budget prévu" value={fmt(budgetPrevu, devise)} />
        <KpiCard label="Dépenses engagées" value={fmt(totalDepense, devise)}
          colorClass={totalDepense > budgetPrevu && budgetPrevu > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100'} />
        <KpiCard label="Solde restant" value={fmt(solde, devise)}
          colorClass={solde < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} />
        <KpiCard label="Lignes" value={lignes.length} />
      </div>

      {/* Répartition par catégorie */}
      {donutSlices.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm px-5 py-4 flex items-center gap-6">
          <div className="w-20 flex-shrink-0">
            <DonutChart slices={donutSlices} title={String(donutSlices.length)} size={80} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {donutSlices.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  <strong>{fmt(s.value, devise)}</strong> <span className="text-gray-400 dark:text-slate-500">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="ml-auto text-[.65rem] text-gray-300 dark:text-slate-600 italic flex-shrink-0">Par catégorie</div>
        </div>
      )}

      {/* Barre de progression */}
      {pct !== null && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
            <span>Consommation du budget</span>
            <span>{pct.toFixed(1)} %</span>
          </div>
          <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          {['Toutes', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                ${filterCat === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
              {c}
            </button>
          ))}
          {assignesListe.length > 1 && (
            <select
              value={filterAssigne}
              onChange={(e) => setFilterAssigne(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-full px-3 py-1 text-xs font-medium bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {assignesListe.map((a) => <option key={a}>{a}</option>)}
            </select>
          )}
        </div>
          <div className="flex items-center gap-2">
          {lignes.length > 0 && (
            <button
              onClick={() => exportCSV(
                'depenses',
                ['Date', 'Catégorie', 'Description', `Montant (${devise})`, 'Assigné'],
                lignes.map((l) => [
                  new Date(l.date).toLocaleDateString('fr-CH'),
                  l.categorie,
                  l.description || '',
                  Number(l.montant).toFixed(2),
                  l.assigne || '',
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
          {!estLecteur && (
            <button onClick={() => setModal({ open: true, item: null })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              + Ajouter une dépense
            </button>
          )}
        </div>
      </div>

      {/* Erreur / chargement */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Tableau */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">Chargement…</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">Aucune dépense enregistrée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Assigné</th>
                <th className="px-4 py-3 text-right">Montant</th>
                {!estLecteur && <th className="px-4 py-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((ligne, i) => (
                <tr key={ligne.id}
                  className={`border-b border-gray-100 dark:border-slate-700/60 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-slate-700/10'}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-300">
                    {new Date(ligne.date).toLocaleDateString('fr-CH')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLORS[ligne.categorie] || CAT_COLORS['Autre']}`}>
                      {ligne.categorie}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-200 max-w-xs truncate">
                    {ligne.description || <span className="text-gray-400 italic">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                    {ligne.assigne || <span className="text-gray-300 dark:text-slate-600 italic">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                    {fmt(ligne.montant, devise)}
                  </td>
                  {!estLecteur && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setModal({ open: true, item: ligne })}
                          className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          Modifier
                        </button>
                        <button onClick={() => setConfirm({ open: true, id: ligne.id })}
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-700/40 border-t-2 border-gray-200 dark:border-slate-600">
                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                  Total ({visible.length} ligne{visible.length > 1 ? 's' : ''})
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-slate-100">
                  {fmt(visible.reduce((s, l) => s + Number(l.montant), 0), devise)}
                </td>
                {!estLecteur && <td />}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modals */}
      <DepenseModal
        open={modal.open}
        initial={modal.item}
        devise={devise}
        onSave={handleSave}
        onClose={() => setModal({ open: false, item: null })}
      />
      <ConfirmDialog
        open={confirm.open}
        title="Supprimer la dépense"
        message="Cette action est irréversible. Voulez-vous vraiment supprimer cette ligne ?"
        onConfirm={handleDelete}
        onCancel={() => setConfirm({ open: false, id: null })}
      />
    </div>
  )
}
