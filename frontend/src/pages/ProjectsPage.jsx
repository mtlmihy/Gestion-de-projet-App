import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { getProjets, createProjet, deleteProjet } from '../api/projets'

// ── Couleur par statut ────────────────────────────────────────────────────────
const STATUT_STYLE = {
  'En cours':    { dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50'  },
  'Brouillon':   { dot: 'bg-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50'   },
  'En pause':    { dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  'Terminé':     { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
  'Annulé':      { dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50'    },
}
const STATUTS = ['Brouillon', 'En cours', 'En pause', 'Terminé', 'Annulé']

function StatutBadge({ statut }) {
  const s = STATUT_STYLE[statut] ?? STATUT_STYLE['Brouillon']
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {statut}
    </span>
  )
}

function RoleBadge({ role }) {
  if (!role) return null
  const colors = {
    'Proprietaire': 'bg-blue-100 text-blue-700',
    'Editeur':      'bg-green-100 text-green-700',
    'Lecteur':      'bg-gray-100 text-gray-500',
    'Client_Limite':'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role] ?? 'bg-gray-100 text-gray-500'}`}>
      {role}
    </span>
  )
}

// ── Modal nouveau projet ──────────────────────────────────────────────────────
const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1'

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ nom: '', description: '', statut: 'En cours' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await createProjet(form)
      onCreated(data)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la création.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Nouveau projet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={lbl}>Nom du projet *</label>
            <input className={inp} required value={form.nom} onChange={setF('nom')} placeholder="Mon projet…" autoFocus />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={form.description}
              onChange={setF('description')}
              placeholder="Décrivez brièvement ce projet…"
            />
          </div>
          <div>
            <label className={lbl}>Statut initial</label>
            <select className={inp} value={form.statut} onChange={setF('statut')}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-semibold transition-colors">
              {saving ? 'Création…' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Carte projet ─────────────────────────────────────────────────────────────
function ProjetCard({ projet, onSelect, onDelete, isAdmin }) {
  return (
    <div
      onClick={() => onSelect(projet)}
      className="group relative bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer p-5 flex flex-col gap-3"
    >
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-blue-600 transition-colors">
            {projet.nom}
          </h3>
        </div>
        <StatutBadge statut={projet.statut} />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
        {projet.description || <span className="italic text-gray-300">Aucune description</span>}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <RoleBadge role={projet.mon_role} />
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(projet) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
      </div>

      {/* Indicateur hover */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { user, isAdmin, peutCreerProjet } = useAuth()
  const { setProjet } = useProject()
  const navigate = useNavigate()

  const [projets,    setProjets]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [error,      setError]      = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getProjets()
      setProjets(data)
    } catch {
      setError('Impossible de charger les projets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSelect = (projet) => {
    setProjet(projet)
    navigate('/risques', { replace: true })
  }

  const handleCreated = (projet) => {
    setShowCreate(false)
    setProjet(projet)
    navigate('/risques', { replace: true })
  }

  const handleDelete = async (projet) => {
    if (!confirm(`Supprimer définitivement « ${projet.nom} » ?`)) return
    try {
      await deleteProjet(projet.id)
      setProjets((p) => p.filter((x) => x.id !== projet.id))
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la suppression.')
    }
  }

  const initiales = (user?.nom ?? user?.email ?? '?')
    .split(' ').map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-blue-600 text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Gestion Projet
          </span>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
              >
                Administration
              </button>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center">
                {initiales}
              </span>
              <span className="hidden md:block font-medium">{user?.nom ?? user?.email}</span>
              {isAdmin && <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded">Admin</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Corps */}
      <main className="max-w-screen-xl mx-auto px-4 py-10">
        {/* Titre + bouton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
            <p className="text-sm text-gray-400 mt-1">
              {isAdmin ? 'Vous êtes administrateur — tous les projets sont visibles.' : 'Projets auxquels vous participez.'}
            </p>
          </div>
          {peutCreerProjet && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nouveau projet
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{error}</div>
        )}

        {/* Grille */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-36 animate-pulse" />
            ))}
          </div>
        ) : projets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-700">Aucun projet disponible</h2>
            <p className="text-sm text-gray-400">
              {peutCreerProjet
                ? 'Créez votre premier projet en cliquant sur « Nouveau projet ».'
                : "Vous n'avez pas encore été invité à un projet. Contactez votre administrateur."}
            </p>
            {peutCreerProjet && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Créer un projet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projets.map((p) => (
              <ProjetCard
                key={p.id}
                projet={p}
                onSelect={handleSelect}
                onDelete={handleDelete}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
