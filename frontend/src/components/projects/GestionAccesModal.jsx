import { useState, useEffect, Fragment } from 'react'
import { updateProjetPages, updateProjetSettings, updateProjetOrdre } from '../../api/projets'
import { getMembres, addMembre, updateMembre, updateMembrePages, removeMembre, getUsersDisponibles } from '../../api/users'
import { STATUTS, ROLES, ROLES_SANS_PROPRIO, ROLE_LABELS, PAGES_DISPONIBLES, inp, lbl } from '../../utils/projectsShared'

export default function GestionAccesModal({ projet, onClose, isAdmin, onProjetUpdated, onDeleteProjet, onCloturerProjet, onReactiverProjet, onStatutProjetChange }) {
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
      const available = pagesDispo.map((p) => p.key)
      if (saved && saved.length) {
        return [
          ...saved.filter((k) => available.includes(k)),
          ...available.filter((k) => !saved.includes(k)),
        ]
      }
      return available
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

  // Sync ordre pages — fusionne l'ordre sauvegardé avec les pages disponibles
  // (ex: budget devient disponible après passage en type Client)
  useEffect(() => {
    const saved = projet?.pages_ordre
    const pDisp = PAGES_DISPONIBLES.filter((p) => !p.onlyClient || projet?.type_projet === 'Client')
    const available = pDisp.map((p) => p.key)
    if (saved && saved.length) {
      setOrdrePages([
        ...saved.filter((k) => available.includes(k)),
        ...available.filter((k) => !saved.includes(k)),
      ])
    } else {
      setOrdrePages(available)
    }
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
