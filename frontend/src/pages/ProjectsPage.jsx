import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import ThemeToggleButton from '../components/ThemeToggleButton'
import { getProjets, createProjet, deleteProjet, cloturerProjet, reactiverProjet, updateStatutProjet } from '../api/projets'
import { getMembres, addMembre, updateMembre, updateMembrePages, removeMembre, getUsersDisponibles } from '../api/users'

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
const PAGES_DISPONIBLES = [
  { key: 'cdc',      label: "Cahier des charges" },
  { key: 'risques',  label: "Risques" },
  { key: 'taches',   label: "Tâches" },
  { key: 'planning', label: "Planning" },
  { key: 'equipe',   label: "Équipe" },
  { key: 'aide',     label: "Aide" },
]

// ── Modal gestion des accès ───────────────────────────────────────────────────
function GestionAccesModal({ projet, onClose, isAdmin }) {
  const rolesDisponibles = isAdmin ? ROLES : ROLES_SANS_PROPRIO
  const [membres,    setMembres]  = useState([])
  const [users,      setUsers]    = useState([])
  const [loading,    setLoading]  = useState(true)
  const [showAdd,    setShowAdd]  = useState(false)
  const [addForm,    setAddForm]  = useState({ user_id: '', role: isAdmin ? 'Proprietaire' : 'Lecteur' })
  const [notif,      setNotif]    = useState({ msg: '', type: 'success' })

  const notify = (msg, type = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'success' }), 3000)
  }

  useEffect(() => {
    setLoading(true)
    getMembres(projet.id)
      .then(({ data }) => setMembres(data))
      .catch(() => notify('Erreur de chargement des membres.', 'error'))
      .finally(() => setLoading(false))
    getUsersDisponibles()
      .then(({ data }) => setUsers(data))
      .catch(() => {}) // non bloquant : impact uniquement le formulaire d'ajout
  }, [projet.id])

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
      notify('Rôle mis à jour.')
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la modification du rôle.', 'error')
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
        <div className="overflow-y-auto flex-1 rounded-xl border border-gray-100 dark:border-slate-700">
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
                  <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{m.nom ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{m.email}</td>
                    <td className="px-4 py-3">
                      {!isAdmin && m.role === 'Proprietaire' ? (
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">Propriétaire</span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {rolesDisponibles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemove(m.user_id, m.email)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                  {m.role === 'Client_Limite' && (
                    <tr className="bg-orange-50/60 dark:bg-orange-900/10">
                      <td colSpan="4" className="px-6 pb-4 pt-2">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">Pages accessibles pour ce membre :</p>
                        <div className="space-y-1.5">
                          {/* Case "Toutes les pages" */}
                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              className="accent-orange-500 w-4 h-4"
                              checked={m.pages_autorisees == null}
                              onChange={(e) => {
                                const payload = e.target.checked ? null : PAGES_DISPONIBLES.map((p) => p.key)
                                updateMembrePages(projet.id, m.user_id, payload)
                                  .then(() => setMembres((mb) => mb.map((x) => x.user_id === m.user_id ? { ...x, pages_autorisees: payload } : x)))
                                  .catch(() => notify('Erreur lors de la mise à jour.', 'error'))
                              }}
                            />
                            Toutes les pages (aucune restriction)
                          </label>
                          {/* Cases individuelles */}
                          <div className="ml-1 grid grid-cols-3 gap-1 pt-0.5">
                            {PAGES_DISPONIBLES.map((p) => {
                              const allPages = m.pages_autorisees == null
                              const hasAccess = allPages || m.pages_autorisees.includes(p.key)
                              return (
                                <label key={p.key} className={`flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded-lg transition-colors ${allPages ? 'text-gray-300 dark:text-slate-600' : 'text-gray-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}>
                                  <input
                                    type="checkbox"
                                    className="accent-orange-500 w-3.5 h-3.5"
                                    disabled={allPages}
                                    checked={hasAccess}
                                    onChange={(e) => handlePagesChange(m.user_id, p.key, e.target.checked)}
                                  />
                                  {p.label}
                                </label>
                              )
                            })}
                          </div>
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
function ProjetCard({ projet, onSelect, onDelete, onGererAcces, onCloturer, onReactiver, onStatutChange, isAdmin }) {
  const estProprietaire = isAdmin || projet.mon_role === 'Proprietaire'
  const peutEditerStatut = !projet.est_cloture && estProprietaire
  const peutCloturer    = !projet.est_cloture && estProprietaire
  const peutReactiver   = projet.est_cloture && isAdmin
  return (
    <div
      onClick={() => onSelect(projet)}
      className={`group relative bg-white dark:bg-slate-800 border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer p-5 flex flex-col gap-3 ${
        projet.est_cloture
          ? 'border-gray-300 dark:border-slate-600 opacity-80 hover:border-gray-400 dark:hover:border-slate-500'
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
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {projet.nom}
          </h3>
        </div>
        {!projet.est_cloture && (
          peutEditerStatut ? (
            <select
              value={projet.statut}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onStatutChange(projet, e.target.value) }}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                (STATUT_STYLE[projet.statut] ?? STATUT_STYLE['Brouillon']).bg
              } ${
                (STATUT_STYLE[projet.statut] ?? STATUT_STYLE['Brouillon']).text
              }`}
            >
              {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <StatutBadge statut={projet.statut} />
          )
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
        {projet.description || <span className="italic text-gray-300">Aucune description</span>}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <RoleBadge role={projet.mon_role} />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {estProprietaire && (
            <button
              onClick={(e) => { e.stopPropagation(); onGererAcces(projet) }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50"
              title="Gérer les accès"
            >
              Accès
            </button>
          )}
          {peutCloturer && (
            <button
              onClick={(e) => { e.stopPropagation(); onCloturer(projet) }}
              className="text-xs text-orange-500 hover:text-orange-700 font-medium px-2 py-1 rounded-lg hover:bg-orange-50"
              title="Clôturer le projet"
            >
              Clôturer
            </button>
          )}
          {peutReactiver && (
            <button
              onClick={(e) => { e.stopPropagation(); onReactiver(projet) }}
              className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50"
              title="Réactiver le projet"
            >
              Réactiver
            </button>
          )}
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(projet) }}
              className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Indicateur hover */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
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
  const [accesProjet, setAccesProjet] = useState(null)
  const [error,      setError]      = useState('')
  const [filtre,     setFiltre]     = useState('tous') // 'tous' | 'actifs' | 'clotures'

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
  const handleCloturer = async (projet) => {
    if (!confirm(`Clôturer « ${projet.nom} » ? Le projet passera en lecture seule.`)) return
    try {
      await cloturerProjet(projet.id)
      setProjets((p) => p.map((x) => x.id === projet.id ? { ...x, est_cloture: true } : x))
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la clôture.')
    }
  }

  const handleReactiver = async (projet) => {
    if (!confirm(`Réactiver « ${projet.nom} » ?`)) return
    try {
      await reactiverProjet(projet.id)
      setProjets((p) => p.map((x) => x.id === projet.id ? { ...x, est_cloture: false } : x))
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la réactivation.')
    }
  }

  const handleStatutChange = async (projet, newStatut) => {
    try {
      const { data } = await updateStatutProjet(projet.id, newStatut)
      setProjets((p) => p.map((x) => x.id === projet.id ? { ...x, statut: data.statut } : x))
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors du changement de statut.')
    }
  }
  const initiales = (user?.nom ?? user?.email ?? '?')
    .split(' ').map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 shadow-sm">
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
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center">
                {initiales}
              </span>
              <span className="hidden md:block font-medium">{user?.nom ?? user?.email}</span>
              {isAdmin && <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold px-1.5 py-0.5 rounded">Admin</span>}
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
          <div className="mb-6 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">{error}</div>
        )}

        {/* Filtres */}
        {!loading && projets.length > 0 && (() => {
          const nbActifs   = projets.filter((p) => !p.est_cloture).length
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
                onClick={() => setShowCreate(true)}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Créer un projet
              </button>
            )}
          </div>
        ) : (() => {
          const projetsFiltres = projets.filter((p) =>
            filtre === 'actifs'   ? !p.est_cloture :
            filtre === 'clotures' ?  p.est_cloture :
            true
          )
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
                onDelete={handleDelete}
                onGererAcces={(p) => setAccesProjet(p)}
                onCloturer={handleCloturer}
                onReactiver={handleReactiver}
                onStatutChange={handleStatutChange}
                isAdmin={isAdmin}
              />
            ))}
          </div>
          )
        })()}
      </main>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {accesProjet && (
        <GestionAccesModal projet={accesProjet} onClose={() => setAccesProjet(null)} isAdmin={isAdmin} />
      )}
    </div>
  )
}
