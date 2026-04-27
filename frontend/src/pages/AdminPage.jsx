import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getUsers, createUser, updateUser, deleteUser, resetPassword,
  getMembres, addMembre, updateMembre, removeMembre,
} from '../api/users'
import client from '../api/client'

// ── Helpers ─────────────────────────────────────────────────────────────────
const ROLES = ['Propriétaire', 'Éditeur', 'Lecteur', 'Client_Limité']

const ALL_PAGES = [
  { id: 'cdc',      label: 'Cahier des Charges' },
  { id: 'risques',  label: 'Risques' },
  { id: 'taches',   label: 'Tâches' },
  { id: 'planning', label: 'Planning' },
  { id: 'equipe',   label: 'Équipe' },
  { id: 'aide',     label: 'Aide' },
]

// Affiche un sélecteur de pages. null = toutes, sinon tableau d'ids
function PagesSelector({ value, onChange }) {
  const allChecked = value === null
  const toggle = (id) => {
    if (allChecked) {
      // Passer à une sélection personnalisée excluant cette page
      onChange(ALL_PAGES.map((p) => p.id).filter((x) => x !== id))
    } else {
      const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id]
      onChange(next)
    }
  }
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer font-medium">
        <input
          type="checkbox"
          className="accent-blue-600 w-4 h-4"
          checked={allChecked}
          onChange={(e) => onChange(e.target.checked ? null : ALL_PAGES.map((p) => p.id))}
        />
        Toutes les pages (aucune restriction)
      </label>
      <div className="ml-1 grid grid-cols-2 gap-1 pt-1">
        {ALL_PAGES.map((p) => (
          <label key={p.id} className={`flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded-lg transition-colors ${allChecked ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'}`}>
            <input
              type="checkbox"
              className="accent-blue-600 w-4 h-4"
              disabled={allChecked}
              checked={allChecked || value.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            {p.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function Badge({ text }) {
  const colors = {
    'Propriétaire':  'bg-blue-100 text-blue-700',
    'Éditeur':       'bg-green-100 text-green-700',
    'Lecteur':       'bg-gray-100 text-gray-600',
    'Client_Limité': 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colors[text] ?? 'bg-gray-100 text-gray-600'}`}>
      {text}
    </span>
  )
}

function Notification({ msg, type }) {
  if (!msg) return null
  const cls = type === 'error'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-xl border text-sm font-medium ${cls}`}>{msg}</div>
}

// ── Modal générique ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1'

// ── Onglet Utilisateurs ──────────────────────────────────────────────────────
function UsersTab({ currentUser }) {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [notif,   setNotif]   = useState({ msg: '', type: 'ok' })
  const [modal,   setModal]   = useState(null) // null | 'create' | 'edit' | 'pwd'
  const [target,  setTarget]  = useState(null) // user en cours d'édition

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try { setUsers((await getUsers()).data) }
    catch { notify('Erreur de chargement.', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Formulaire création
  const [form, setForm] = useState({ email: '', nom: '', poste: '', password: '', is_admin: false, peut_creer_projet: false, pages_autorisees: null })
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createUser(form)
      notify('Utilisateur créé.')
      setModal(null)
      setForm({ email: '', nom: '', poste: '', password: '', is_admin: false, peut_creer_projet: false, pages_autorisees: null })
      load()
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur.', 'error')
    }
  }

  // Formulaire édition
  const [editForm, setEditForm] = useState({ nom: '', poste: '', is_admin: false, is_active: true, peut_creer_projet: false, pages_autorisees: null })
  const setE = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const openEdit = (u) => {
    setTarget(u)
    setEditForm({ nom: u.nom ?? '', poste: u.poste ?? '', is_admin: u.is_admin, is_active: u.is_active, peut_creer_projet: u.peut_creer_projet ?? false, pages_autorisees: u.pages_autorisees ?? null })
    setModal('edit')
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      await updateUser(target.id, editForm)
      notify('Utilisateur mis à jour.')
      setModal(null)
      load()
    } catch { notify('Erreur.', 'error') }
  }

  // Reset mot de passe
  const [newPwd, setNewPwd] = useState('')
  const openPwd = (u) => { setTarget(u); setNewPwd(''); setModal('pwd') }
  const handlePwd = async (e) => {
    e.preventDefault()
    try {
      await resetPassword(target.id, newPwd)
      notify('Mot de passe réinitialisé.')
      setModal(null)
    } catch { notify('Erreur.', 'error') }
  }

  // Suppression
  const handleDelete = async (u) => {
    if (!confirm(`Supprimer ${u.email} ?`)) return
    try {
      await deleteUser(u.id)
      notify('Utilisateur supprimé.')
      load()
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur.', 'error')
    }
  }

  return (
    <div>
      <Notification msg={notif.msg} type={notif.type} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setModal('create') }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouvel utilisateur
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Nom', 'E-mail', 'Poste', 'Rôle', 'Pages', 'Statut', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.nom ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500">{u.poste ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.is_admin
                      ? <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">Admin</span>
                      : <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">Utilisateur</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.is_admin
                      ? <span className="text-blue-500 font-medium">Toutes</span>
                      : u.pages_autorisees == null
                        ? <span className="text-green-600 font-medium">Toutes</span>
                        : u.pages_autorisees.length === 0
                          ? <span className="text-red-400 font-medium">Aucune</span>
                          : <span title={u.pages_autorisees.join(', ')}>{u.pages_autorisees.length}/{ALL_PAGES.length}</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="text-green-600 text-xs font-semibold">Actif</span>
                      : <span className="text-gray-400 text-xs font-semibold">Inactif</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">Modifier</button>
                      <button onClick={() => openPwd(u)}  className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">Mot de passe</button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Supprimer</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création */}
      {modal === 'create' && (
        <Modal title="Nouvel utilisateur" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className={lbl}>E-mail *</label><input className={inp} type="email" required value={form.email} onChange={setF('email')} placeholder="prenom.nom@domaine.fr" /></div>
            <div><label className={lbl}>Nom</label><input className={inp} value={form.nom} onChange={setF('nom')} placeholder="Prénom Nom" /></div>
            <div><label className={lbl}>Poste</label><input className={inp} value={form.poste} onChange={setF('poste')} placeholder="Chef de projet…" /></div>
            <div><label className={lbl}>Mot de passe *</label><input className={inp} type="password" required minLength={6} value={form.password} onChange={setF('password')} /></div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="accent-red-600" checked={form.is_admin} onChange={setF('is_admin')} />
              Administrateur (accès total)
            </label>
            {!form.is_admin && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="accent-blue-600" checked={form.peut_creer_projet} onChange={setF('peut_creer_projet')} />
                Chef de projet (peut créer des projets)
              </label>
            )}
            {!form.is_admin && (
              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className={`${lbl} mb-2`}>Pages accessibles</div>
                <PagesSelector
                  value={form.pages_autorisees}
                  onChange={(v) => setForm((f) => ({ ...f, pages_autorisees: v }))}
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors">Créer</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal édition */}
      {modal === 'edit' && target && (
        <Modal title={`Modifier — ${target.email}`} onClose={() => setModal(null)}>
          <form onSubmit={handleEdit} className="space-y-3">
            <div><label className={lbl}>Nom</label><input className={inp} value={editForm.nom} onChange={setE('nom')} /></div>
            <div><label className={lbl}>Poste</label><input className={inp} value={editForm.poste} onChange={setE('poste')} /></div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="accent-red-600" checked={editForm.is_admin} onChange={setE('is_admin')} />
              Administrateur
            </label>
            {!editForm.is_admin && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="accent-blue-600" checked={editForm.peut_creer_projet} onChange={setE('peut_creer_projet')} />
                Chef de projet (peut créer des projets)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="accent-blue-600" checked={editForm.is_active} onChange={setE('is_active')} />
              Compte actif
            </label>
            {!editForm.is_admin && (
              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className={`${lbl} mb-2`}>Pages accessibles</div>
                <PagesSelector
                  value={editForm.pages_autorisees}
                  onChange={(v) => setEditForm((f) => ({ ...f, pages_autorisees: v }))}
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal mot de passe */}
      {modal === 'pwd' && target && (
        <Modal title={`Réinitialiser le mot de passe — ${target.email}`} onClose={() => setModal(null)}>
          <form onSubmit={handlePwd} className="space-y-3">
            <div><label className={lbl}>Nouveau mot de passe *</label><input className={inp} type="password" required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
              <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2 text-sm font-semibold transition-colors">Réinitialiser</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Onglet Membres du projet ──────────────────────────────────────────────────
function MembresTab({ currentUser }) {
  const [projets,  setProjets]  = useState([])
  const [projetId, setProjetId] = useState(null)
  const [membres,  setMembres]  = useState([])
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [notif,    setNotif]    = useState({ msg: '', type: 'ok' })
  const [showAdd,  setShowAdd]  = useState(false)
  const [addForm,  setAddForm]  = useState({ user_id: '', role: 'Lecteur' })

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  // Chargement initial
  useEffect(() => {
    Promise.all([
      client.get('/projets/'),
      getUsers(),
    ]).then(([p, u]) => {
      setProjets(p.data)
      setUsers(u.data)
      if (p.data.length > 0) setProjetId(p.data[0].id)
    }).catch(() => notify('Erreur de chargement.', 'error'))
  }, [])

  // Chargement membres quand projetId change
  useEffect(() => {
    if (!projetId) return
    setLoading(true)
    getMembres(projetId)
      .then(({ data }) => setMembres(data))
      .catch(() => notify('Erreur.', 'error'))
      .finally(() => setLoading(false))
  }, [projetId])

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await addMembre(projetId, addForm)
      notify('Membre ajouté.')
      setShowAdd(false)
      setAddForm({ user_id: '', role: 'Lecteur' })
      const { data } = await getMembres(projetId)
      setMembres(data)
    } catch (err) { notify(err?.response?.data?.detail ?? 'Erreur.', 'error') }
  }

  const handleRoleChange = async (userId, role) => {
    try {
      await updateMembre(projetId, userId, role)
      setMembres((m) => m.map((mb) => mb.user_id === userId ? { ...mb, role } : mb))
      notify('Rôle mis à jour.')
    } catch { notify('Erreur.', 'error') }
  }

  const handleRemove = async (userId, email) => {
    if (!confirm(`Retirer ${email} du projet ?`)) return
    try {
      await removeMembre(projetId, userId)
      setMembres((m) => m.filter((mb) => mb.user_id !== userId))
      notify('Membre retiré.')
    } catch (err) { notify(err?.response?.data?.detail ?? 'Erreur.', 'error') }
  }

  // Membres déjà dans le projet (pour filtrer le select)
  const membresIds = new Set(membres.map((m) => m.user_id))
  const usersDisponibles = users.filter((u) => !membresIds.has(u.id))

  return (
    <div>
      <Notification msg={notif.msg} type={notif.type} />

      {/* Sélecteur de projet */}
      {projets.length > 1 && (
        <div className="mb-4">
          <label className={lbl}>Projet</label>
          <select
            className={inp}
            value={projetId ?? ''}
            onChange={(e) => setProjetId(e.target.value)}
          >
            {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{membres.length} membre{membres.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter un membre
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Nom', 'E-mail', 'Poste', 'Rôle', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {membres.length === 0 && (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400 text-sm">Aucun membre sur ce projet.</td></tr>
              )}
              {membres.map((m) => (
                <tr key={m.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.nom ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-gray-500">{m.poste ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal ajout membre */}
      {showAdd && (
        <Modal title="Ajouter un membre" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
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
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Propriétaire = accès total · Éditeur = créer/modifier · Lecteur = lecture seule
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors">Ajouter</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Page principale Administration ───────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('users')

  // Seuls les admins accèdent à l'onglet "Utilisateurs"
  // Les Propriétaires de projet peuvent accéder à "Membres"
  const tabs = [
    ...(isAdmin ? [{ id: 'users', label: 'Utilisateurs' }] : []),
    { id: 'membres', label: 'Membres du projet' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900">Administration</div>
          <div className="text-xs text-gray-400">Gestion des utilisateurs et des accès projets</div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex border-b border-gray-100 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {tab === 'users'   && isAdmin  && <UsersTab currentUser={user} />}
          {tab === 'membres'            && <MembresTab currentUser={user} />}
        </div>
      </div>
    </div>
  )
}
