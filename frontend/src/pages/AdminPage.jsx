import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getUsers, createUser, updateUser, deleteUser, resetPassword,
  getMembres, addMembre, updateMembre, removeMembre,
  forceLogoutUser, removeFromAllProjects,
} from '../api/users'
import { getProjets } from '../api/projets'
import KpiCard from '../components/KpiCard'

// PushTest
// ── Modal générique ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inp = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

const MIN_PASSWORD_LENGTH = 12

function getPasswordPolicyError(password) {
  if (!password || typeof password !== 'string') return 'Le mot de passe est requis.'
  if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule.'
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule.'
  if (!/\d/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial.'
  return null
}

// ── Onglet Utilisateurs ──────────────────────────────────────────────────────
function UsersTab({ currentUser }) {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [notif,   setNotif]   = useState({ msg: '', type: 'ok' })
  const [modal,   setModal]   = useState(null) // null | 'create' | 'edit' | 'pwd'
  const [target,  setTarget]  = useState(null) // user en cours d'édition
  const [submitting, setSubmitting] = useState(false)

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
  const [form, setForm] = useState({ email: '', nom: '', poste: '', password: '', is_admin: false, peut_creer_projet: false })
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (submitting) return
    const passwordError = getPasswordPolicyError(form.password)
    if (passwordError) {
      notify(passwordError, 'error')
      return
    }
    setSubmitting(true)
    try {
      await createUser(form)
      notify('Utilisateur créé.')
      setModal(null)
      setForm({ email: '', nom: '', poste: '', password: '', is_admin: false, peut_creer_projet: false })
      load()
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Formulaire édition
  const [editForm, setEditForm] = useState({ nom: '', poste: '', is_admin: false, is_active: true, peut_creer_projet: false })
  const setE = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const openEdit = (u) => {
    setTarget(u)
    setEditForm({ nom: u.nom ?? '', poste: u.poste ?? '', is_admin: u.is_admin, is_active: u.is_active, peut_creer_projet: u.peut_creer_projet ?? false })
    setModal('edit')
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await updateUser(target.id, editForm)
      notify('Utilisateur mis à jour.')
      setModal(null)
      load()
    } catch { notify('Erreur.', 'error') }
    finally { setSubmitting(false) }
  }

  // Reset mot de passe
  const [newPwd, setNewPwd] = useState('')
  const openPwd = (u) => { setTarget(u); setNewPwd(''); setModal('pwd') }
  const handlePwd = async (e) => {
    e.preventDefault()
    if (submitting) return
    const passwordError = getPasswordPolicyError(newPwd)
    if (passwordError) {
      notify(passwordError, 'error')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(target.id, newPwd)
      notify('Mot de passe réinitialisé.')
      setModal(null)
    } catch { notify('Erreur.', 'error') }
    finally { setSubmitting(false) }
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
      {notif.msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl border text-sm font-medium ${notif.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{notif.msg}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
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
        <div className="overflow-x-auto scrollbar-hidden rounded-xl border border-gray-100 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                {['Nom', 'E-mail', 'Poste', 'Rôle', 'Statut', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{u.nom ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{u.poste ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.is_admin
                      ? <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">Admin</span>
                      : <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">Utilisateur</span>}
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
            <div>
              <label className={lbl}>Mot de passe *</label>
              <input className={inp} type="password" required minLength={12} value={form.password} onChange={setF('password')} autoComplete="new-password" />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">Min. 12 car. — 1 maj, 1 min, 1 chiffre, 1 spécial.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" className="accent-red-600" checked={form.is_admin} onChange={setF('is_admin')} />
              Administrateur (accès total)
            </label>
            {!form.is_admin && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" className="accent-blue-600" checked={form.peut_creer_projet} onChange={setF('peut_creer_projet')} />
                Chef de projet (peut créer des projets)
              </label>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Annuler</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl py-2 text-sm font-semibold transition-colors">{submitting ? 'Création…' : 'Créer'}</button>
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
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" className="accent-red-600" checked={editForm.is_admin} onChange={setE('is_admin')} />
              Administrateur
            </label>
            {!editForm.is_admin && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" className="accent-blue-600" checked={editForm.peut_creer_projet} onChange={setE('peut_creer_projet')} />
                Chef de projet (peut créer des projets)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" className="accent-blue-600" checked={editForm.is_active} onChange={setE('is_active')} />
              Compte actif
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Annuler</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl py-2 text-sm font-semibold transition-colors">{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal mot de passe */}
      {modal === 'pwd' && target && (
        <Modal title={`Réinitialiser le mot de passe — ${target.email}`} onClose={() => setModal(null)}>
          <form onSubmit={handlePwd} className="space-y-3">
            <div>
              <label className={lbl}>Nouveau mot de passe *</label>
              <input className={inp} type="password" required minLength={12} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">Min. 12 car. — 1 maj, 1 min, 1 chiffre, 1 spécial.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Annuler</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl py-2 text-sm font-semibold transition-colors">{submitting ? 'Réinitialisation…' : 'Réinitialiser'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Onglet Permissions ───────────────────────────────────────────────────────
// Vue d'ensemble : KPI globaux, anomalies de gouvernance, matrice utilisateurs × projets.
// Lecture seule : la modification fine des rôles reste sur le bouton « Accès » de chaque projet.
const ROLE_LABELS = {
  Proprietaire: 'Propriétaire',
  Editeur: 'Éditeur',
  Lecteur: 'Lecteur',
  Client_Limite: 'Client',
}
const ROLE_BADGES = {
  Proprietaire: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Editeur:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Lecteur:      'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  Client_Limite:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

function RoleBadge({ role }) {
  const cls = ROLE_BADGES[role] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

// Seuil au-delà duquel un compte est considéré comme dormant.
const INACTIVITY_DAYS = 90

function daysSince(dateStr) {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86_400_000)
}

function formatLastLogin(dateStr) {
  if (!dateStr) return 'Jamais'
  const d = daysSince(dateStr)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Hier'
  if (d < 30) return `Il y a ${d} j`
  if (d < 365) return `Il y a ${Math.floor(d / 30)} mois`
  return `Il y a ${Math.floor(d / 365)} an${Math.floor(d / 365) > 1 ? 's' : ''}`
}

function PermissionsTab() {
  const [users,    setUsers]    = useState([])
  const [projets,  setProjets]  = useState([])
  const [membres,  setMembres]  = useState({}) // { [projetId]: [{ user_id, role, ... }] }
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [filter,   setFilter]   = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [notif,    setNotif]    = useState({ msg: '', type: 'ok' })

  // Sélection courante pour l'édition d'une cellule (matrice).
  const [editing,  setEditing]  = useState(null) // { user, projet, currentRole }
  // Sélection courante pour les actions sur un utilisateur entier.
  const [acting,   setActing]   = useState(null) // { user, mode: 'logout'|'offboard' }
  const [submitting, setSubmitting] = useState(false)

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [u, p] = await Promise.all([getUsers(), getProjets()])
      setUsers(u.data)
      setProjets(p.data)
      const results = await Promise.all(
        p.data.map((proj) => getMembres(proj.id).then((r) => [proj.id, r.data]).catch(() => [proj.id, []]))
      )
      setMembres(Object.fromEntries(results))
    } catch {
      setError('Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Index : userId -> { projetId -> role }
  const userRoles = useMemo(() => {
    const idx = {}
    for (const [pid, list] of Object.entries(membres)) {
      for (const m of list) {
        if (!idx[m.user_id]) idx[m.user_id] = {}
        idx[m.user_id][pid] = m.role
      }
    }
    return idx
  }, [membres])

  // KPIs globaux
  const stats = useMemo(() => {
    const actifs   = users.filter((u) => u.is_active)
    const admins   = users.filter((u) => u.is_admin)
    const cdp      = users.filter((u) => u.peut_creer_projet && !u.is_admin)
    const projetsSansProprio = projets.filter((p) => {
      const list = membres[p.id] ?? []
      return !list.some((m) => m.role === 'Proprietaire')
    })
    const dormants = users.filter((u) => {
      if (!u.is_active || u.is_admin) return false
      const d = daysSince(u.derniere_connexion)
      return d === null || d > INACTIVITY_DAYS
    })
    return {
      totalUsers: users.length,
      actifs:     actifs.length,
      admins:     admins.length,
      cdp:        cdp.length,
      totalProjets: projets.length,
      sansProprio:  projetsSansProprio,
      dormants,
    }
  }, [users, projets, membres])

  // Anomalies à signaler
  const anomalies = useMemo(() => {
    const list = []
    for (const p of stats.sansProprio) {
      list.push({ label: `Projet sans propriétaire : ${p.nom}` })
    }
    for (const u of users) {
      if (u.is_admin && !u.is_active) {
        list.push({ label: `Compte administrateur inactif : ${u.email}` })
      }
    }
    for (const u of users) {
      if (!u.is_admin && u.is_active && !userRoles[u.id]) {
        list.push({ label: `Utilisateur sans accès projet : ${u.email}` })
      }
    }
    for (const u of stats.dormants) {
      const d = daysSince(u.derniere_connexion)
      const txt = d === null ? 'jamais connecté' : `inactif depuis ${d} jours`
      list.push({ label: `Compte ${txt} : ${u.email}` })
    }
    return list
  }, [users, userRoles, stats])

  // Filtrage de la matrice
  const usersAffiches = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return users.filter((u) => {
      if (!showInactive && !u.is_active) return false
      if (!q) return true
      return (u.email ?? '').toLowerCase().includes(q)
          || (u.nom ?? '').toLowerCase().includes(q)
    })
  }, [users, filter, showInactive])

  // ── Édition inline du rôle ──────────────────────────────────────────────
  const openCellEdit = (user, projet) => {
    if (user.is_admin) return // les admins ont l'accès global, rien à éditer
    setEditing({
      user,
      projet,
      currentRole: userRoles[user.id]?.[projet.id] ?? '',
    })
  }

  const submitRole = async (newRole) => {
    if (!editing || submitting) return
    const { user, projet, currentRole } = editing
    setSubmitting(true)
    try {
      if (newRole === currentRole) {
        setEditing(null)
      } else if (newRole === '') {
        await removeMembre(projet.id, user.id)
        notify(`${user.email} retiré du projet « ${projet.nom} ».`)
      } else if (currentRole) {
        await updateMembre(projet.id, user.id, newRole)
        notify(`Rôle mis à jour : ${user.email} → ${ROLE_LABELS[newRole]}.`)
      } else {
        await addMembre(projet.id, { user_id: user.id, role: newRole })
        notify(`${user.email} ajouté au projet « ${projet.nom} ».`)
      }
      // Mise à jour locale (évite un reload complet).
      const fresh = await getMembres(projet.id)
      setMembres((m) => ({ ...m, [projet.id]: fresh.data }))
      setEditing(null)
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Actions sur un utilisateur ──────────────────────────────────────────
  const submitAction = async () => {
    if (!acting || submitting) return
    setSubmitting(true)
    try {
      if (acting.mode === 'logout') {
        await forceLogoutUser(acting.user.id)
        notify(`Sessions de ${acting.user.email} révoquées.`)
      } else if (acting.mode === 'offboard') {
        const { data } = await removeFromAllProjects(acting.user.id)
        await forceLogoutUser(acting.user.id)
        await updateUser(acting.user.id, {
          nom: acting.user.nom,
          poste: acting.user.poste,
          is_admin: acting.user.is_admin,
          is_active: false,
          peut_creer_projet: acting.user.peut_creer_projet,
          pages_autorisees: acting.user.pages_autorisees,
        })
        notify(`Offboarding terminé : retiré de ${data?.removed ?? 0} projet(s), désactivé, sessions révoquées.`)
      }
      setActing(null)
      reload()
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Chargement…</div>
  if (error)   return <div className="text-center py-12 text-red-500 text-sm">{error}</div>

  return (
    <div className="space-y-6">
      {notif.msg && (
        <div className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${notif.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{notif.msg}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Utilisateurs actifs" value={`${stats.actifs} / ${stats.totalUsers}`} />
        <KpiCard label="Administrateurs"     value={stats.admins} colorClass="text-red-600 dark:text-red-400" />
        <KpiCard label="Chefs de projet"     value={stats.cdp}    colorClass="text-blue-600 dark:text-blue-400" />
        <KpiCard
          label="Projets sans propriétaire"
          value={stats.sansProprio.length}
          colorClass={stats.sansProprio.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-slate-100'}
        />
        <KpiCard
          label={`Comptes dormants (>${INACTIVITY_DAYS}j)`}
          value={stats.dormants.length}
          colorClass={stats.dormants.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-slate-100'}
        />
      </div>

      {/* Anomalies */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Anomalies de gouvernance</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500">{anomalies.length} signalement{anomalies.length !== 1 ? 's' : ''}</span>
        </div>
        {anomalies.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-slate-400">Aucune anomalie détectée.</p>
        ) : (
          <ul className="space-y-1.5">
            {anomalies.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-slate-300">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{a.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matrice utilisateurs × projets */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Matrice des accès</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              Cliquez sur une cellule pour modifier le rôle. Colonne « Actions » pour révoquer ou retirer un utilisateur.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher un utilisateur…"
              className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
              <input type="checkbox" className="accent-blue-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Inactifs
            </label>
          </div>
        </div>

        {projets.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-slate-400 py-6 text-center">Aucun projet enregistré.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hidden rounded-xl border border-gray-100 dark:border-slate-700">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="md:sticky md:left-0 bg-gray-50 dark:bg-slate-700 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-4 py-3 md:z-10">
                    Utilisateur
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-3 py-3 whitespace-nowrap">
                    Dernière connexion
                  </th>
                  {projets.map((p) => (
                    <th key={p.id} className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-3 py-3 min-w-[120px]">
                      <div className="truncate max-w-[160px]" title={p.nom}>{p.nom}</div>
                    </th>
                  ))}
                  <th className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-3 py-3 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {usersAffiches.length === 0 && (
                  <tr>
                    <td colSpan={projets.length + 3} className="px-4 py-6 text-center text-xs text-gray-400">
                      Aucun utilisateur ne correspond.
                    </td>
                  </tr>
                )}
                {usersAffiches.map((u) => {
                  const d = daysSince(u.derniere_connexion)
                  const dormant = !u.is_admin && u.is_active && (d === null || d > INACTIVITY_DAYS)
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="md:sticky md:left-0 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 px-4 py-3 md:z-10 min-w-[200px]">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-gray-900 dark:text-slate-100 ${!u.is_active ? 'opacity-50' : ''}`}>
                              {u.nom ?? u.email}
                            </span>
                            {u.is_admin && (
                              <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded">Admin</span>
                            )}
                            {!u.is_admin && u.peut_creer_projet && (
                              <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">CDP</span>
                            )}
                            {!u.is_active && (
                              <span className="bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-400 text-[10px] font-semibold px-1.5 py-0.5 rounded">Inactif</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[220px]">{u.email}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-3 text-xs whitespace-nowrap ${dormant ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-500 dark:text-slate-400'}`}>
                        {formatLastLogin(u.derniere_connexion)}
                      </td>
                      {projets.map((p) => {
                        const role = userRoles[u.id]?.[p.id]
                        if (u.is_admin) {
                          return (
                            <td key={p.id} className="px-3 py-3">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 whitespace-nowrap">
                                Accès global
                              </span>
                            </td>
                          )
                        }
                        return (
                          <td key={p.id} className="px-3 py-3">
                            <button
                              onClick={() => openCellEdit(u, p)}
                              className="rounded-lg hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 dark:hover:ring-offset-slate-800 transition"
                              title="Modifier le rôle"
                            >
                              {role
                                ? <RoleBadge role={role} />
                                : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 whitespace-nowrap">Ajouter</span>}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {u.is_active && (
                            <button
                              onClick={() => setActing({ user: u, mode: 'logout' })}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                              title="Révoquer toutes les sessions actives"
                            >
                              Forcer déco.
                            </button>
                          )}
                          <button
                            onClick={() => setActing({ user: u, mode: 'offboard' })}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap"
                            title="Désactiver, retirer de tous les projets et révoquer les sessions"
                          >
                            Offboarding
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Légende */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
          <span className="text-xs text-gray-400 dark:text-slate-500">Légende :</span>
          <RoleBadge role="Proprietaire" />
          <RoleBadge role="Editeur" />
          <RoleBadge role="Lecteur" />
          <RoleBadge role="Client_Limite" />
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">Accès global</span>
        </div>
      </div>

      {/* Modal édition de cellule */}
      {editing && (
        <Modal
          title={`Accès — ${editing.user.email}`}
          onClose={() => !submitting && setEditing(null)}
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Projet : <span className="font-semibold text-gray-700 dark:text-slate-200">{editing.projet.nom}</span>
            </p>
            <div>
              <label className={lbl}>Rôle</label>
              <select
                className={inp}
                defaultValue={editing.currentRole}
                onChange={(e) => setEditing({ ...editing, currentRole: e.target.value })}
              >
                <option value="">— Aucun accès —</option>
                <option value="Proprietaire">Propriétaire</option>
                <option value="Editeur">Éditeur</option>
                <option value="Lecteur">Lecteur</option>
                <option value="Client_Limite">Client</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                Propriétaire = accès total · Éditeur = créer/modifier · Lecteur = lecture seule · Client = accès limité.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={submitting}
                className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => submitRole(editing.currentRole)}
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl py-2 text-sm font-semibold transition-colors"
              >
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal action utilisateur */}
      {acting && (
        <Modal
          title={
            acting.mode === 'logout'
              ? `Forcer la déconnexion — ${acting.user.email}`
              : `Offboarding — ${acting.user.email}`
          }
          onClose={() => !submitting && setActing(null)}
        >
          <div className="space-y-4">
            {acting.mode === 'logout' ? (
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Toutes les sessions actives de cet utilisateur seront immédiatement révoquées.
                Il devra se reconnecter sur tous ses appareils.
              </p>
            ) : (
              <div className="text-sm text-gray-600 dark:text-slate-300 space-y-2">
                <p>Cette action va :</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-500 dark:text-slate-400">
                  <li>Retirer l'utilisateur de tous ses projets</li>
                  <li>Désactiver son compte</li>
                  <li>Révoquer toutes ses sessions actives</li>
                </ul>
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-2">
                  Le compte n'est pas supprimé : il pourra être réactivé plus tard si besoin.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActing(null)}
                disabled={submitting}
                className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={submitting}
                className={`flex-1 disabled:opacity-60 text-white rounded-xl py-2 text-sm font-semibold transition-colors ${
                  acting.mode === 'offboard'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {submitting ? 'En cours…' : (acting.mode === 'offboard' ? 'Confirmer l\'offboarding' : 'Forcer la déconnexion')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── (SUPPRIMÉ) Onglet Membres du projet — géré via le bouton Accès sur chaque carte projet
function _MembresTab_UNUSED({ currentUser }) {
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
        <div className="overflow-x-auto scrollbar-hidden rounded-xl border border-gray-100">
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

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-slate-200">Accès réservé aux administrateurs</h1>
      </div>
    )
  }

  const tabs = [
    { id: 'users',       label: 'Utilisateurs' },
    { id: 'permissions', label: 'Permissions' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-slate-100">Administration</div>
          <div className="text-xs text-gray-400 dark:text-slate-500">Comptes, rôles et accès aux projets</div>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm p-6">
          <UsersTab currentUser={user} />
        </div>
      )}
      {tab === 'permissions' && <PermissionsTab />}
    </div>
  )
}
