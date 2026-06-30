import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getUsers, updateUser,
  getMembres, addMembre, updateMembre, removeMembre,
  forceLogoutUser, removeFromAllProjects,
} from '../../api/users'
import { getProjets } from '../../api/projets'
import KpiCard from '../KpiCard'
import AdminModal from './AdminModal'
import RoleBadge from './RoleBadge'
import { inp, lbl, ROLE_LABELS, INACTIVITY_DAYS, daysSince, formatLastLogin } from '../../utils/adminAccess'

export default function PermissionsTab() {
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
              placeholder="Rechercher un utilisateur"
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
        <AdminModal
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
        </AdminModal>
      )}

      {/* Modal action utilisateur */}
      {acting && (
        <AdminModal
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
        </AdminModal>
      )}
    </div>
  )
}
