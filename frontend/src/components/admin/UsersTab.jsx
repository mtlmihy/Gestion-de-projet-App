import { useState, useEffect, useCallback } from 'react'
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../../api/users'
import AdminModal from './AdminModal'
import { inp, lbl, getPasswordPolicyError } from '../../utils/adminAccess'

export default function UsersTab({ currentUser }) {
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
        <AdminModal title="Nouvel utilisateur" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className={lbl}>E-mail *</label><input className={inp} type="email" required value={form.email} onChange={setF('email')} placeholder="nom@domaine.com" /></div>
            <div><label className={lbl}>Nom</label><input className={inp} value={form.nom} onChange={setF('nom')} placeholder="Nom complet" /></div>
            <div><label className={lbl}>Poste</label><input className={inp} value={form.poste} onChange={setF('poste')} placeholder="Fonction" /></div>
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
        </AdminModal>
      )}

      {/* Modal édition */}
      {modal === 'edit' && target && (
        <AdminModal title={`Modifier — ${target.email}`} onClose={() => setModal(null)}>
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
        </AdminModal>
      )}

      {/* Modal mot de passe */}
      {modal === 'pwd' && target && (
        <AdminModal title={`Réinitialiser le mot de passe — ${target.email}`} onClose={() => setModal(null)}>
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
        </AdminModal>
      )}
    </div>
  )
}
