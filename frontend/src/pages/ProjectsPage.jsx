import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { getPinnedProjects, updatePinnedProjects } from '../api/auth'
import ThemeToggleButton from '../components/ThemeToggleButton'
import ProjectWizard from '../components/ProjectWizard'
import Logo from '../components/Logo'
import { getProjets, deleteProjet, cloturerProjet, reactiverProjet, updateStatutProjet } from '../api/projets'
import GestionAccesModal from '../components/projects/GestionAccesModal'
import CreateModal from '../components/projects/CreateModal'
import ProjetCard from '../components/projects/ProjetCard'
import { loadPins, savePins, toPinnedSet, mergeProjetForUi } from '../utils/projectsShared'

// ── Page principale ───────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { user, isAdmin, peutCreerProjet, logout } = useAuth()
  const { setProjet } = useProject()
  const navigate = useNavigate()

  const [projets,    setProjets]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [accesProjet, setAccesProjet] = useState(null)
  const [error,      setError]      = useState('')
  const [filtre,     setFiltre]     = useState('tous') // 'tous' | 'actifs' | 'clotures'
  const [pinned,     setPinned]     = useState(() => loadPins(user?.id))

  useEffect(() => {
    let cancelled = false

    const syncPinned = async () => {
      if (!user?.id) {
        setPinned(loadPins(user?.id))
        return
      }
      try {
        const { data } = await getPinnedProjects()
        if (cancelled) return
        const next = toPinnedSet(data?.projet_ids)
        setPinned(next)
        savePins(user.id, next)
      } catch {
        if (cancelled) return
        setPinned(loadPins(user?.id))
      }
    }

    syncPinned()
    return () => { cancelled = true }
  }, [user?.id])

  const togglePin = useCallback(async (projetId) => {
    const previous = new Set(pinned)
    const next = new Set(pinned)

    if (next.has(projetId)) next.delete(projetId)
    else next.add(projetId)

    setPinned(next)
    savePins(user?.id, next)

    if (!user?.id) return

    try {
      await updatePinnedProjects([...next])
    } catch {
      setPinned(previous)
      savePins(user?.id, previous)
      setError('Impossible de synchroniser les projets épinglés.')
    }
  }, [pinned, user?.id])

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
    navigate('/cdc', { replace: true })
  }

  const handleCreated = (projet) => {
    setShowCreate(false)
    setShowWizard(false)
    setProjet(projet)
    navigate('/cdc', { replace: true })
  }

  const handleDelete = async (projet) => {
    if (!confirm(`Supprimer définitivement « ${projet.nom} » ?`)) return
    try {
      await deleteProjet(projet.id)
      setProjets((p) => p.filter((x) => x.id !== projet.id))
      setAccesProjet((current) => (current?.id === projet.id ? null : current))
      return { id: projet.id, deleted: true }
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la suppression.')
      throw err
    }
  }
  const handleCloturer = async (projet) => {
    if (!confirm(`Clôturer « ${projet.nom} » ? Le projet passera en lecture seule.`)) return
    try {
      const { data } = await cloturerProjet(projet.id)
      const updated = data ?? { ...projet, est_cloture: true }
      setProjets((p) => p.map((x) => x.id === projet.id ? mergeProjetForUi(x, updated) : x))
      setAccesProjet((current) => (current?.id === projet.id ? mergeProjetForUi(current, updated) : current))
      return updated
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la clôture.')
      throw err
    }
  }

  const handleReactiver = async (projet) => {
    if (!confirm(`Réactiver « ${projet.nom} » ?`)) return
    try {
      const { data } = await reactiverProjet(projet.id)
      const updated = data ?? { ...projet, est_cloture: false }
      setProjets((p) => p.map((x) => x.id === projet.id ? mergeProjetForUi(x, updated) : x))
      setAccesProjet((current) => (current?.id === projet.id ? mergeProjetForUi(current, updated) : current))
      return updated
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la réactivation.')
      throw err
    }
  }

  const handleStatutChange = async (projet, newStatut) => {
    try {
      const { data } = await updateStatutProjet(projet.id, newStatut)
      const updated = data ?? { ...projet, statut: newStatut }
      setProjets((p) => p.map((x) => x.id === projet.id ? mergeProjetForUi(x, updated) : x))
      setAccesProjet((current) => (current?.id === projet.id ? mergeProjetForUi(current, updated) : current))
      return updated
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors du changement de statut.')
      throw err
    }
  }

  const handleProjetUpdated = (updatedProjet) => {
    setProjets((list) => list.map((p) => (p.id === updatedProjet.id ? mergeProjetForUi(p, updatedProjet) : p)))
    setAccesProjet((current) => (current?.id === updatedProjet.id ? mergeProjetForUi(current, updatedProjet) : current))
  }
  const initiales = (user?.nom ?? user?.email ?? '?')
    .split(' ').map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')

  const isProjetEnCours = (p) => !p.est_cloture && p.statut === 'En cours'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <span className="flex items-center font-bold text-blue-600 text-sm min-w-0">
            <Logo className="w-6 h-6" />
          </span>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-800 dark:hover:bg-slate-700 hover:text-white hover:border-gray-800 dark:hover:border-slate-700 transition-colors"
                title="Administration"
                aria-label="Administration"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center">
                {initiales}
              </span>
              <span className="hidden md:block font-medium">{user?.nom ?? user?.email}</span>
              {isAdmin && <span className="hidden sm:inline-flex bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold px-1.5 py-0.5 rounded">Admin</span>}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
              title="Se déconnecter"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:block">Déconnexion</span>
            </button>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      {/* Corps */}
      <main className="max-w-screen-xl mx-auto px-4 py-10">
        {/* Titre + bouton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Mes projets</h1>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              {isAdmin ? 'Vous êtes administrateur — tous les projets sont visibles.' : 'Projets auxquels vous participez.'}
            </p>
          </div>
          {peutCreerProjet && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nouveau projet
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
              >
                créer projet sans assistant
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">{error}</div>
        )}

        {/* Filtres */}
        {!loading && projets.length > 0 && (() => {
          const nbActifs   = projets.filter((p) => isProjetEnCours(p)).length
          const nbClotures = projets.filter((p) =>  p.est_cloture).length
          return (
            <div className="flex items-center gap-2 mb-6">
              {[['tous', `Tous (${projets.length})`], ['actifs', `En cours (${nbActifs})`], ['clotures', `Clôturés (${nbClotures})`]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFiltre(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    filtre === val
                      ? val === 'clotures'
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )
        })()}

        {/* Grille */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 h-36 animate-pulse" />
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
                onClick={() => setShowWizard(true)}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Créer un projet
              </button>
            )}
          </div>
        ) : (() => {
          const projetsFiltres = projets
            .filter((p) =>
              filtre === 'actifs'   ? isProjetEnCours(p) :
              filtre === 'clotures' ?  p.est_cloture :
              true
            )
            // Épinglés en tête (ordre relatif d'origine préservé sinon)
            .slice()
            .sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)))
          if (projetsFiltres.length === 0) return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <p className="text-sm text-gray-400">
                {filtre === 'actifs'   ? 'Aucun projet en cours.' : 'Aucun projet clôturé.'}
              </p>
            </div>
          )
          return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projetsFiltres.map((p) => (
              <ProjetCard
                key={p.id}
                projet={p}
                onSelect={handleSelect}
                onGererAcces={(p) => setAccesProjet(p)}
                isAdmin={isAdmin}
                isPinned={pinned.has(p.id)}
                onTogglePin={togglePin}
              />
            ))}
          </div>
          )
        })()}
      </main>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {showWizard && (
        <ProjectWizard onClose={() => setShowWizard(false)} onCreated={handleCreated} />
      )}

      {accesProjet && (
        <GestionAccesModal
          projet={accesProjet}
          onClose={() => setAccesProjet(null)}
          isAdmin={isAdmin}
          onProjetUpdated={handleProjetUpdated}
          onDeleteProjet={handleDelete}
          onCloturerProjet={handleCloturer}
          onReactiverProjet={handleReactiver}
          onStatutProjetChange={handleStatutChange}
        />
      )}
    </div>
  )
}
