import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { getPinnedProjects, updatePinnedProjects } from '../api/auth'
import ThemeToggleButton from '../components/ThemeToggleButton'
import ProjectWizard from '../components/ProjectWizard'
import Logo from '../components/Logo'
import { getProjets, createProjet, deleteProjet, cloturerProjet, reactiverProjet, updateStatutProjet, updateProjetPages, updateProjetSettings, updateProjetOrdre } from '../api/projets'
import { getMembres, addMembre, updateMembre, updateMembrePages, removeMembre, getUsersDisponibles } from '../api/users'

// ── Épinglage (persistance locale par utilisateur) ───────────────────────────
const pinKey = (userId) => `epingles:projets:${userId ?? 'guest'}`
const loadPins = (userId) => {
  try { return new Set(JSON.parse(localStorage.getItem(pinKey(userId)) || '[]')) }
  catch { return new Set() }
}
const savePins = (userId, set) => {
  try { localStorage.setItem(pinKey(userId), JSON.stringify([...set])) } catch { /* quota / privée */ }
}
const toPinnedSet = (value) => new Set(Array.isArray(value) ? value.filter(Boolean) : [])

// ── Couleur par statut ────────────────────────────────────────────────────────
const STATUT_STYLE = {
  'En cours':    { dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50'  },
  'Brouillon':   { dot: 'bg-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50'   },
  'En pause':    { dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  'Terminé':     { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
  'Annulé':      { dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50'    },
}
const STATUTS = ['Brouillon', 'En cours', 'En pause']

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
const inp = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

const ROLES = ['Proprietaire', 'Editeur', 'Lecteur', 'Client_Limite']
const ROLES_SANS_PROPRIO = ['Editeur', 'Lecteur', 'Client_Limite']
const ROLE_LABELS = {
  'Proprietaire':  'Propriétaire',
  'Editeur':       'Éditeur',
  'Lecteur':       'Lecteur',
  'Client_Limite': 'Client',
}
const PAGES_DISPONIBLES = [
  { key: 'cdc',      label: "Cahier des charges" },
  { key: 'risques',  label: "Risques" },
  { key: 'taches',   label: "Tâches" },
  { key: 'raci',     label: "RACI" },
  { key: 'planning', label: "Planning" },
  { key: 'copil',    label: "COPIL" },
  { key: 'equipe',   label: "Équipe" },
  { key: 'aide',     label: "Aide" },
  { key: 'budget',   label: "Budget", onlyClient: true },
]

function mergeProjetForUi(prev, patch) {
  if (!prev) return patch
  return {
    ...prev,
    ...patch,
    // Les endpoints PATCH projet ne renvoient pas toujours ces champs métier.
    mon_role: patch?.mon_role ?? prev.mon_role,
    mes_pages: patch?.mes_pages ?? prev.mes_pages,
  }
}

// ── Modal gestion des accès ───────────────────────────────────────────────────
function GestionAccesModal({ projet, onClose, isAdmin, onProjetUpdated, onDeleteProjet, onCloturerProjet, onReactiverProjet, onStatutProjetChange }) {
  const rolesDisponibles = isAdmin ? ROLES : ROLES_SANS_PROPRIO
  const [membres,    setMembres]  = useState([])
  const [users,      setUsers]    = useState([])
  const [loading,    setLoading]  = useState(true)
  const [showAdd,    setShowAdd]  = useState(false)
  const [addForm,    setAddForm]  = useState({ user_id: '', role: isAdmin ? 'Proprietaire' : 'Lecteur' })
  const [notif,      setNotif]    = useState({ msg: '', type: 'success' })
  const [pagesProjet, setPagesProjet] = useState(projet?.pages_visibles ?? null)
  const pagesDispo = PAGES_DISPONIBLES.filter((p) => !p.onlyClient || projet?.type_projet === 'Client')
  const [ordrePages, setOrdrePages] = useState(
    () => {
      const saved = projet?.pages_ordre
      if (saved && saved.length) return saved
      return pagesDispo.map((p) => p.key)
    }
  )
  const [draggingPage, setDraggingPage] = useState(null)
  const [settingsForm, setSettingsForm] = useState({
    type_projet: projet?.type_projet ?? 'Interne',
    budget_prevu: projet?.budget_prevu == null ? '' : String(projet.budget_prevu),
    devise: projet?.devise ?? 'CHF',
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [expandedClientId, setExpandedClientId] = useState(null)
  const estProprietaire = isAdmin || projet.mon_role === 'Proprietaire'

  const notify = (msg, type = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'success' }), 3000)
  }

  // Chargement membres uniquement au montage / changement de projet
  useEffect(() => {
    setLoading(true)
    getMembres(projet.id)
      .then(({ data }) => setMembres(data))
      .catch(() => notify('Erreur de chargement des membres.', 'error'))
      .finally(() => setLoading(false))
    getUsersDisponibles()
      .then(({ data }) => setUsers(data))
      .catch(() => {})
  }, [projet.id])

  // Sync pages sans déclencher rechargement membres
  useEffect(() => {
    setPagesProjet(projet?.pages_visibles ?? null)
  }, [projet?.pages_visibles])

  // Sync ordre pages
  useEffect(() => {
    const saved = projet?.pages_ordre
    const pDisp = PAGES_DISPONIBLES.filter((p) => !p.onlyClient || projet?.type_projet === 'Client')
    setOrdrePages(saved && saved.length ? saved : pDisp.map((p) => p.key))
  }, [projet?.pages_ordre, projet?.type_projet])

  // Sync paramètres budget/type sans déclencher rechargement membres
  useEffect(() => {
    setSettingsForm({
      type_projet: projet?.type_projet ?? 'Interne',
      budget_prevu: projet?.budget_prevu == null ? '' : String(projet.budget_prevu),
      devise: projet?.devise ?? 'CHF',
    })
  }, [projet?.type_projet, projet?.budget_prevu, projet?.devise])

  const membresIds      = new Set(membres.map((m) => m.user_id))
  const usersDisponibles = users.filter((u) => !membresIds.has(u.id))

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await addMembre(projet.id, addForm)
      const { data } = await getMembres(projet.id)
      setMembres(data)
      setShowAdd(false)
      setAddForm({ user_id: '', role: isAdmin ? 'Proprietaire' : 'Lecteur' })
      notify('Membre ajouté.')
    } catch (err) { notify(err?.response?.data?.detail ?? 'Erreur.', 'error') }
  }

  const handleRoleChange = async (userId, role) => {
    try {
      await updateMembre(projet.id, userId, role)
      setMembres((m) => m.map((mb) => mb.user_id === userId ? { ...mb, role } : mb))
      if (role !== 'Client_Limite') {
        setExpandedClientId((current) => (current === userId ? null : current))
      }
      notify('Rôle mis à jour.')
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la modification du rôle.', 'error')
    }
  }

  const handleProjetDelete = async () => {
    if (!onDeleteProjet) return
    try {
      const result = await onDeleteProjet(projet)
      if (result?.deleted) onClose()
    } catch {
      // Les erreurs sont déjà traitées au niveau parent.
    }
  }

  const handleProjetCloture = async () => {
    if (!onCloturerProjet) return
    try {
      const updated = await onCloturerProjet(projet)
      if (updated) onProjetUpdated?.(updated)
    } catch {
      // Les erreurs sont déjà traitées au niveau parent.
    }
  }

  const handleProjetReactivation = async () => {
    if (!onReactiverProjet) return
    try {
      const updated = await onReactiverProjet(projet)
      if (updated) onProjetUpdated?.(updated)
    } catch {
      // Les erreurs sont déjà traitées au niveau parent.
    }
  }

  const handleProjetStatut = async (newStatut) => {
    if (!onStatutProjetChange) return
    try {
      const updated = await onStatutProjetChange(projet, newStatut)
      if (updated) onProjetUpdated?.(updated)
    } catch {
      // Les erreurs sont déjà traitées au niveau parent.
    }
  }

  const handlePagesChange = async (userId, page, checked) => {
    const membre = membres.find((m) => m.user_id === userId)
    if (!membre) return
    // null = toutes les pages autorisées ; on travaille avec un tableau
    const current = membre.pages_autorisees ?? PAGES_DISPONIBLES.map((p) => p.key)
    const next = checked
      ? [...new Set([...current, page])]
      : current.filter((p) => p !== page)
    // Si toutes cochées → null (accès total)
    const payload = next.length === PAGES_DISPONIBLES.length ? null : next
    try {
      await updateMembrePages(projet.id, userId, payload)
      setMembres((m) => m.map((mb) => mb.user_id === userId ? { ...mb, pages_autorisees: payload } : mb))
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la mise à jour des pages.', 'error')
    }
  }

  const handleRemove = async (userId, email) => {
    if (!confirm(`Retirer ${email} du projet ?`)) return
    try {
      await removeMembre(projet.id, userId)
      setMembres((m) => m.filter((mb) => mb.user_id !== userId))
      notify('Membre retiré.')
    } catch (err) { notify(err?.response?.data?.detail ?? 'Erreur.', 'error') }
  }

  const handleProjectPagesChange = async (page, checked) => {
    const current = pagesProjet ?? PAGES_DISPONIBLES.map((p) => p.key)
    const next = checked
      ? [...new Set([...current, page])]
      : current.filter((p) => p !== page)
    const payload = next.length === PAGES_DISPONIBLES.length ? null : next
    try {
      const { data } = await updateProjetPages(projet.id, payload)
      setPagesProjet(data.pages_visibles ?? null)
      onProjetUpdated?.(data)
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la mise à jour des paramètres projet.', 'error')
    }
  }

  const handleDragStart = (key) => setDraggingPage(key)

  const handleDragOver = (e, key) => {
    e.preventDefault()
    if (!draggingPage || draggingPage === key) return
    setOrdrePages((prev) => {
      const next = [...prev]
      const from = next.indexOf(draggingPage)
      const to   = next.indexOf(key)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, draggingPage)
      return next
    })
  }

  const handleDragEnd = async () => {
    setDraggingPage(null)
    try {
      const { data } = await updateProjetOrdre(projet.id, ordrePages)
      onProjetUpdated?.(data)
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la sauvegarde de l’ordre.', 'error')
    }
  }

  const handleProjectSettingsSave = async () => {
    if (savingSettings) return
    const typeProjet = settingsForm.type_projet
    const rawBudget = settingsForm.budget_prevu.trim().replace(',', '.')
    const devise = settingsForm.devise

    let payload
    if (typeProjet === 'Interne') {
      payload = { type_projet: 'Interne', budget_prevu: null, devise }
    } else {
      if (!rawBudget) {
        notify('Le budget est requis pour un projet client.', 'error')
        return
      }
      const parsed = Number(rawBudget)
      if (Number.isNaN(parsed) || parsed < 0) {
        notify('Le budget doit être un nombre supérieur ou égal à 0.', 'error')
        return
      }
      payload = { type_projet: 'Client', budget_prevu: parsed, devise }
    }

    setSavingSettings(true)
    try {
      const { data } = await updateProjetSettings(projet.id, payload)
      setSettingsForm({
        type_projet: data.type_projet ?? 'Interne',
        budget_prevu: data.budget_prevu == null ? '' : String(data.budget_prevu),
        devise: data.devise ?? 'CHF',
      })
      onProjetUpdated?.(data)
      notify('Paramètres du projet mis à jour.')
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la mise à jour des paramètres projet.', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col border border-gray-100 dark:border-slate-700">
        {/* Titre */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Gestion des accès</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{projet.nom}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        {/* Notification */}
        {notif.msg && (
          <div className={`mb-3 text-sm px-3 py-2 rounded-xl border flex-shrink-0 ${
            notif.type === 'error'
              ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
              : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
          }`}>{notif.msg}</div>
        )}

        {/* Paramètres projet — visible propriétaires/admins uniquement */}
        {estProprietaire && <div className="mb-3 flex-shrink-0 p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/70">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Paramètres du projet</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
            <select
              value={settingsForm.type_projet}
              onChange={(e) => {
                const nextType = e.target.value
                setSettingsForm((prev) => ({
                  ...prev,
                  type_projet: nextType,
                  budget_prevu: nextType === 'Interne' ? '' : prev.budget_prevu,
                }))
              }}
              className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Interne">Sans budget</option>
              <option value="Client">Avec budget</option>
            </select>
            {settingsForm.type_projet === 'Client' && (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Montant"
                  value={settingsForm.budget_prevu}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, budget_prevu: e.target.value }))}
                  className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={settingsForm.devise}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, devise: e.target.value }))}
                  className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CHF">CHF (CHF)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </>
            )}
            <button
              onClick={handleProjectSettingsSave}
              disabled={savingSettings}
              className="text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {!projet.est_cloture && (
              <select
                value={projet.statut}
                onChange={(e) => handleProjetStatut(e.target.value)}
                className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <div className="flex items-center gap-2 sm:justify-end">
              {!projet.est_cloture && (
                <button
                  onClick={handleProjetCloture}
                  className="text-xs text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  title="Clôturer le projet"
                >
                  Clôturer
                </button>
              )}
              {projet.est_cloture && isAdmin && (
                <button
                  onClick={handleProjetReactivation}
                  className="text-xs text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  title="Réactiver le projet"
                >
                  Réactiver
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleProjetDelete}
                  className="text-xs text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  title="Supprimer le projet"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Pages visibles dans ce projet</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {PAGES_DISPONIBLES.filter((p) => !p.onlyClient || projet.type_projet === 'Client').map((p) => {
              const hasAccess = pagesProjet == null || pagesProjet.includes(p.key)
              return (
                <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-gray-700 dark:text-slate-300">
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${hasAccess ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700'}`}>
                    {hasAccess && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>}
                  </span>
                  <input type="checkbox" className="sr-only" tabIndex={-1} checked={hasAccess} onChange={(e) => handleProjectPagesChange(p.key, e.target.checked)} />
                  {p.label}
                </label>
              )
            })}
          </div>

          {/* TODO: section drag-and-drop ordre des pages dans le modal (désactivée, disponible dans le menu directement)
          {estProprietaire && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Ordre des pages dans le menu</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Glissez-déposez pour réordonner — sauvegarde automatique.</p>
              <div className="flex flex-col gap-1">
                {ordrePages.map((key) => {
                  const page = PAGES_DISPONIBLES.find((p) => p.key === key)
                  if (!page) return null
                  const isDragged = draggingPage === key
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => handleDragStart(key)}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-grab select-none transition-all
                        ${
                          isDragged
                            ? 'opacity-40 bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M4 8h16M4 16h16" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-slate-200 font-medium">{page.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          */}
        </div>}

        {/* Actions */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <p className="text-sm text-gray-500 dark:text-slate-400">{membres.length} membre{membres.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter
          </button>
        </div>

        {/* Tableau */}
        <div className="overflow-y-auto scrollbar-hidden flex-1 rounded-xl border border-gray-100 dark:border-slate-700">
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Chargement…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  {['Nom', 'E-mail', 'Rôle', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {membres.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400 dark:text-slate-500 text-sm">Aucun membre.</td></tr>
                )}
                {membres.map((m) => (
                  <Fragment key={m.user_id}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors ${m.role === 'Client_Limite' ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (m.role !== 'Client_Limite') return
                      setExpandedClientId((current) => (current === m.user_id ? null : m.user_id))
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{m.nom ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{m.email}</td>
                    <td className="px-4 py-3">
                      {!isAdmin && m.role === 'Proprietaire' ? (
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">Propriétaire</span>
                      ) : (
                        <select
                          value={m.role}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {rolesDisponibles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(m.user_id, m.email) }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                  {m.role === 'Client_Limite' && expandedClientId === m.user_id && (
                    <tr className="bg-orange-50/60 dark:bg-orange-900/10">
                      <td colSpan="4" className="px-6 pb-4 pt-2">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">Pages accessibles pour ce membre :</p>
                        <div className="grid grid-cols-3 gap-1">
                          {PAGES_DISPONIBLES.filter((p) => !p.onlyClient || projet.type_projet === 'Client').map((p) => {
                            const hasAccess = m.pages_autorisees == null || m.pages_autorisees.includes(p.key)
                            return (
                              <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-gray-700 dark:text-slate-300">
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${hasAccess ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700'}`}>
                                  {hasAccess && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>}
                                </span>
                                <input type="checkbox" className="sr-only" tabIndex={-1} checked={hasAccess} onChange={(e) => handlePagesChange(m.user_id, p.key, e.target.checked)} />
                                {p.label}
                              </label>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}              </tbody>
            </table>
          )}
        </div>

        {/* Sous-formulaire ajout */}
        {showAdd && (
          <form onSubmit={handleAdd} className="mt-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 flex-shrink-0 space-y-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">Ajouter un membre</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Utilisateur *</label>
                <select
                  className={inp}
                  required
                  value={addForm.user_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, user_id: e.target.value }))}
                >
                  <option value="">— Sélectionner —</option>
                  {usersDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.nom ?? u.email} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Rôle</label>
                <select
                  className={inp}
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {rolesDisponibles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-1.5 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                Annuler
              </button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-1.5 text-sm font-semibold transition-colors">
                Ajouter
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ nom: '', description: '', statut: 'En cours', type_projet: 'Interne', budget_prevu: '', devise: 'CHF' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (form.type_projet === 'Client') {
      const budget = Number((form.budget_prevu || '').toString().replace(',', '.'))
      if (!form.budget_prevu?.toString().trim()) {
        setError('Le budget est requis pour un projet client.')
        setSaving(false)
        return
      }
      if (Number.isNaN(budget) || budget < 0) {
        setError('Le budget doit être un nombre supérieur ou égal à 0.')
        setSaving(false)
        return
      }
    }

    const payload = {
      nom: form.nom,
      description: form.description,
      statut: form.statut,
      type_projet: form.type_projet,
      devise: form.devise,
      budget_prevu: form.type_projet === 'Client'
        ? Number((form.budget_prevu || '').toString().replace(',', '.'))
        : null,
    }
    try {
      const { data } = await createProjet(payload)
      onCreated(data)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la création.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Nouveau projet</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={lbl}>Nom du projet *</label>
            <input className={inp} required value={form.nom} onChange={setF('nom')} placeholder="Nom du projet" autoFocus />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={form.description}
              onChange={setF('description')}
              placeholder="Description du projet"
            />
          </div>
          <div>
            <label className={lbl}>Statut initial</label>
            <select className={inp} value={form.statut} onChange={setF('statut')}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type de projet</label>
              <select className={inp} value={form.type_projet} onChange={setF('type_projet')}>
                <option value="Interne">Sans budget</option>
                <option value="Client">Avec budget</option>
              </select>
            </div>
            {form.type_projet === 'Client' && (
              <>
                <div>
                  <label className={lbl}>Budget prévu *</label>
                  <input
                    className={inp}
                    value={form.budget_prevu}
                    onChange={setF('budget_prevu')}
                    placeholder="Montant"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className={lbl}>Devise</label>
                  <select className={inp} value={form.devise} onChange={setF('devise')}>
                    <option value="CHF">CHF (CHF)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
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
function ProjetCard({ projet, onSelect, onGererAcces, isAdmin, isPinned, onTogglePin }) {
  const estProprietaire = isAdmin || projet.mon_role === 'Proprietaire'
  return (
    <div
      onClick={() => onSelect(projet)}
      className={`group relative bg-white dark:bg-slate-800 border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer p-5 flex flex-col gap-3 ${
        projet.est_cloture
          ? 'border-gray-300 dark:border-slate-600 opacity-80 hover:border-gray-400 dark:hover:border-slate-500'
          : isPinned
            ? 'border-amber-300 dark:border-amber-500/60 ring-1 ring-amber-200 dark:ring-amber-500/30 hover:border-amber-400 dark:hover:border-amber-400'
            : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
      }`}
    >
      {/* Badge clôturé */}
      {projet.est_cloture && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-gray-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Clôturé
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin(projet.id) }}
            title={isPinned ? 'Désépingler' : 'Épingler en haut de la liste'}
            aria-label={isPinned ? 'Désépingler le projet' : 'Épingler le projet'}
            aria-pressed={isPinned}
            className={`shrink-0 mt-0.5 p-1 rounded-md transition-all ${
              isPinned
                ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                : 'text-gray-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400'
            }`}
          >
            {isPinned ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M14 2l8 8-4 1-3 3 1 5-4-3-7 7-1-1 7-7-3-4 5 1 3-3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2l8 8-4 1-3 3 1 5-4-3-7 7-1-1 7-7-3-4 5 1 3-3z" />
              </svg>
            )}
          </button>
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {projet.nom}
          </h3>
        </div>
        {!projet.est_cloture && <StatutBadge statut={projet.statut} />}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
        {projet.description || <span className="italic text-gray-300">Aucune description</span>}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <RoleBadge role={projet.mon_role} />
        <div className="flex items-center gap-1">
          {estProprietaire && (
            <button
              onClick={(e) => { e.stopPropagation(); onGererAcces(projet) }}
              className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg transition-colors"
              title="Paramètres du projet"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

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
    if (!confirm(`Clôturer « ${projet.nom} » ? Le projet passera en lecture seule.`)) return
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
    if (!confirm(`Réactiver « ${projet.nom} » ?`)) return
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
