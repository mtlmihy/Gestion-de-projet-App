import { useEffect, useMemo, useState } from 'react'
import { useProject } from '../context/ProjectContext'
import KpiCard from '../components/KpiCard'
import { getRaciMatrix, updateRaciTache } from '../api/raci'

const ORDERED_ROLES = ['R', 'A', 'C', 'I']

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

function roleClass(role) {
  if (role === 'R') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (role === 'A') return 'bg-violet-100 text-violet-700 border-violet-200'
  if (role === 'C') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (role === 'I') return 'bg-slate-100 text-slate-700 border-slate-200'
  return 'bg-white text-gray-400 border-gray-200'
}

function toTaskMemberMap(assignations) {
  const map = {}
  for (const item of assignations ?? []) {
    if (!map[item.tache_id]) map[item.tache_id] = {}
    map[item.tache_id][item.membre_id] = item.role
  }
  return map
}

function normalizeTaskRoles(taskMap) {
  if (!taskMap) return ''
  return Object.entries(taskMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([memberId, role]) => `${memberId}:${role}`)
    .join('|')
}

export default function RaciPage() {
  const { projet, estLecteur } = useProject()
  const [loading, setLoading] = useState(true)
  const [savingTaskId, setSavingTaskId] = useState('')
  const [notif, setNotif] = useState({ msg: '', type: 'ok' })
  const [fSearch, setFSearch] = useState('')
  const [fJalon, setFJalon] = useState('Tous')

  const [membres, setMembres] = useState([])
  const [taches, setTaches] = useState([])
  const [baseByTask, setBaseByTask] = useState({})
  const [draftByTask, setDraftByTask] = useState({})

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getRaciMatrix(projet.id)
      const byTask = toTaskMemberMap(data.assignations)
      setMembres(data.membres ?? [])
      setTaches(data.taches ?? [])
      setBaseByTask(byTask)
      setDraftByTask(byTask)
    } catch {
      notify('Erreur lors du chargement de la matrice RACI.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projet.id])

  const jalons = useMemo(() => {
    const set = new Set()
    for (const t of taches) {
      const v = (t.jalon ?? '').trim()
      if (v) set.add(v)
    }
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))]
  }, [taches])

  const filteredTaches = useMemo(() => {
    const q = fSearch.trim().toLowerCase()
    return taches.filter((t) => {
      if (fJalon !== 'Tous' && (t.jalon ?? '').trim() !== fJalon) return false
      if (!q) return true
      const hay = `${t.nom ?? ''} ${t.jalon ?? ''} ${t.importance ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [taches, fSearch, fJalon])

  const taskStats = useMemo(() => {
    let withR = 0
    let withA = 0
    for (const t of taches) {
      const taskMap = draftByTask[t.id] ?? {}
      const roles = Object.values(taskMap)
      if (roles.includes('R')) withR += 1
      if (roles.includes('A')) withA += 1
    }
    return {
      total: taches.length,
      withR,
      withA,
      complete: taches.filter((t) => {
        const roles = Object.values(draftByTask[t.id] ?? {})
        return roles.includes('R') && roles.includes('A')
      }).length,
    }
  }, [taches, draftByTask])

  const isTaskDirty = (taskId) => normalizeTaskRoles(baseByTask[taskId]) !== normalizeTaskRoles(draftByTask[taskId])

  const toggleRole = (taskId, memberId) => {
    if (estLecteur) return
    setDraftByTask((prev) => {
      const currentTask = { ...(prev[taskId] ?? {}) }
      const current = currentTask[memberId] ?? ''
      const idx = ORDERED_ROLES.indexOf(current)
      const next = ORDERED_ROLES[(idx + 1) % (ORDERED_ROLES.length + 1)] ?? ''

      if (!next) {
        delete currentTask[memberId]
      } else {
        currentTask[memberId] = next
      }

      // 1 seul R et 1 seul A par tâche : on remplace l'existant sur le nouveau membre.
      if (next === 'R' || next === 'A') {
        for (const id of Object.keys(currentTask)) {
          if (id !== memberId && currentTask[id] === next) delete currentTask[id]
        }
      }

      return { ...prev, [taskId]: currentTask }
    })
  }

  const saveTask = async (taskId) => {
    const assignations = Object.entries(draftByTask[taskId] ?? {}).map(([membre_id, role]) => ({ membre_id, role }))
    setSavingTaskId(taskId)
    try {
      await updateRaciTache(projet.id, taskId, assignations)
      setBaseByTask((prev) => ({ ...prev, [taskId]: { ...(draftByTask[taskId] ?? {}) } }))
      notify('Matrice RACI enregistrée pour la tâche.')
    } catch (err) {
      notify(err?.response?.data?.detail ?? 'Erreur lors de la sauvegarde RACI.', 'error')
    } finally {
      setSavingTaskId('')
    }
  }

  const resetTask = (taskId) => {
    setDraftByTask((prev) => ({ ...prev, [taskId]: { ...(baseByTask[taskId] ?? {}) } }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Matrice RACI
        </h1>
        {estLecteur && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            Lecture seule
          </span>
        )}
      </div>

      <Notification {...notif} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Tâches" value={taskStats.total} />
        <KpiCard label="Avec R" value={taskStats.withR} colorClass="text-blue-600" />
        <KpiCard label="Avec A" value={taskStats.withA} colorClass="text-violet-600" />
        <KpiCard label="R + A" value={taskStats.complete} colorClass="text-emerald-600" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm mb-4 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Recherche tâche</label>
            <input
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={fSearch}
              onChange={(e) => setFSearch(e.target.value)}
              placeholder="Nom, jalon, importance..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Jalon</label>
            <select
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={fJalon}
              onChange={(e) => setFJalon(e.target.value)}
            >
              {jalons.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">Chargement…</div>
        ) : (membres.length === 0 || taches.length === 0) ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm px-4 text-center">
            Ajoute au moins un membre d'équipe et une tâche pour construire la matrice RACI.
          </div>
        ) : filteredTaches.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">Aucune tâche avec ces filtres.</div>
        ) : (
          <div className="overflow-x-auto scrollbar-hidden">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Tâche</th>
                  {membres.map((m) => (
                    <th key={m.id} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide min-w-[92px]">
                      <div className="leading-tight">
                        <p className="truncate max-w-[92px]" title={m.collaborateur}>{m.collaborateur}</p>
                        {m.poste && <p className="normal-case text-[10px] text-gray-400 dark:text-slate-500 truncate">{m.poste}</p>}
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredTaches.map((t) => {
                  const taskMap = draftByTask[t.id] ?? {}
                  const dirty = isTaskDirty(t.id)
                  const missingR = !Object.values(taskMap).includes('R')
                  const missingA = !Object.values(taskMap).includes('A')

                  return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-[240px]">{t.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {t.jalon || 'Sans jalon'} · {t.importance || 'Moyenne'} · {t.avancement ?? 0}%
                        </p>
                        {(missingR || missingA) && (
                          <p className="text-[11px] text-amber-600 mt-1">
                            {missingR && 'R manquant'}{missingR && missingA ? ' · ' : ''}{missingA && 'A manquant'}
                          </p>
                        )}
                      </td>

                      {membres.map((m) => {
                        const role = taskMap[m.id] ?? ''
                        return (
                          <td key={m.id} className="px-2 py-3 text-center">
                            <button
                              type="button"
                              disabled={estLecteur}
                              onClick={() => toggleRole(t.id, m.id)}
                              className={`w-9 h-9 inline-flex items-center justify-center rounded-lg border font-bold text-xs transition-colors ${roleClass(role)} ${estLecteur ? 'opacity-80 cursor-default' : 'hover:brightness-95'}`}
                              title={estLecteur ? 'Lecture seule' : `Rôle actuel: ${role || 'Aucun'} (clic pour changer)`}
                            >
                              {role || '·'}
                            </button>
                          </td>
                        )
                      })}

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!dirty || savingTaskId === t.id}
                            onClick={() => resetTask(t.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={estLecteur || !dirty || savingTaskId === t.id}
                            onClick={() => saveTask(t.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                          >
                            {savingTaskId === t.id ? 'Sauvegarde…' : 'Enregistrer'}
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
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
        Astuce: clic sur une cellule pour faire défiler les rôles dans l'ordre R → A → C → I → vide.
      </p>
    </div>
  )
}
