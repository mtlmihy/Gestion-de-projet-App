import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCdc } from '../api/cdc'
import { getTaches } from '../api/taches'
import { getRisques } from '../api/risques'
import { getDepenses } from '../api/budget'
import { useProject } from '../context/ProjectContext'
import SCurve from '../components/SCurve'
import MiniBar from '../components/planning/MiniBar'
import TimelineSVG from '../components/planning/TimelineSVG'
import PanelAvancement from '../components/planning/PanelAvancement'
import PanelTaches from '../components/planning/PanelTaches'
import PanelRisques from '../components/planning/PanelRisques'
import PanelBudget from '../components/planning/PanelBudget'
import { TODAY, fmtDate, TASK_WEIGHT, jalonStatus, jalonAvg } from '../utils/planning'

// ── Composant principal ───────────────────────────────────────────────────────
export default function PlanningPage() {
  const { projet } = useProject()
  const navigate = useNavigate()
  const goToTachesByJalon = useCallback((label) => {
    const v = (label ?? '').trim()
    if (!v) return
    navigate(`/taches?jalon=${encodeURIComponent(v)}`)
  }, [navigate])

  const [jalons,   setJalons]   = useState([])
  const [taches,   setTaches]   = useState([])
  const [risques,  setRisques]  = useState([])
  const [depenses, setDepenses] = useState([])
  const [meta,     setMeta]     = useState({ nom: '', chef: '', dateDebut: '' })
  const [loading,  setLoading]  = useState(true)
  const [notif,    setNotif]    = useState({ msg: '', type: 'ok' })

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = useCallback(() => {
    if (!projet?.id) return
    setLoading(true)

    const loadCdc = getCdc(projet.id).then(({ data }) => {
      try {
        const raw = typeof data.contenu === 'string' ? JSON.parse(data.contenu) : (data.contenu ?? {})
        setMeta({
          nom:       raw.nom_projet  ?? '',
          chef:      raw.chef_projet ?? '',
          dateDebut: raw.date_debut  ?? '',
        })
        const parsed = (raw.jalons ?? [])
          .map((j) => Array.isArray(j)
            ? { label: j[0] ?? '', date: j[1] ? new Date(j[1]) : null, desc: j[2] ?? '' }
            : { label: j.nom ?? '', date: j.date ? new Date(j.date) : null, desc: j.description ?? '' }
          )
          .filter((j) => j.label && j.date && !isNaN(j.date))
          .sort((a, b) => a.date - b.date)
        setJalons(parsed)
      } catch { /* CDC mal formé */ }
    }).catch((err) => {
      if (err?.response?.status !== 404) notify('Erreur lors du chargement du CDC.', 'error')
    })

    const loadTaches = getTaches(projet.id).then(({ data }) => {
      setTaches(data)
    }).catch(() => notify('Erreur lors du chargement des tâches.', 'error'))

    const loadRisques = getRisques(projet.id).then(({ data }) => {
      setRisques(data)
    }).catch(() => notify('Erreur lors du chargement des risques.', 'error'))

    const loadDepenses = projet.type_projet === 'Client'
      ? getDepenses(projet.id).then(({ data }) => setDepenses(data)).catch(() => notify('Erreur lors du chargement du budget.', 'error'))
      : Promise.resolve()

    Promise.all([loadCdc, loadTaches, loadRisques, loadDepenses]).finally(() => setLoading(false))
  }, [projet?.id, projet?.type_projet])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  useEffect(() => { load() }, [load])

  const enrichedJalons = useMemo(() =>
    jalons.map((j) => {
      const { badge, color } = jalonStatus(j, taches)
      return { ...j, _color: color, _badge: badge }
    }),
    [jalons, taches]
  )

  const startDate = useMemo(() => {
    const fromMeta = meta.dateDebut ? new Date(meta.dateDebut) : null
    if (fromMeta && !isNaN(fromMeta)) return fromMeta
    return enrichedJalons[0]?.date ?? TODAY
  }, [meta.dateDebut, enrichedJalons])

  const endDate = useMemo(() =>
    enrichedJalons.length ? enrichedJalons[enrichedJalons.length - 1].date : TODAY,
    [enrichedJalons]
  )

  const progressPct = useMemo(() => {
    const total = Math.max(1, endDate - startDate)
    const done  = Math.max(0, Math.min(total, TODAY - startDate))
    return Math.round(done / total * 100)
  }, [startDate, endDate])

  const taskPct = useMemo(() => {
    if (!taches.length) return 0
    const totalW = taches.reduce((s, t) => s + TASK_WEIGHT(t.importance), 0)
    if (!totalW) return 0
    const done = taches.reduce((s, t) => s + TASK_WEIGHT(t.importance) * (t.avancement ?? 0), 0)
    return Math.round(done / totalW)
  }, [taches])

  const totalMonths = Math.round(Math.max(0, endDate - startDate) / 86400000 / 30)
  const durationStr = totalMonths >= 12
    ? `${Math.floor(totalMonths / 12)} an${Math.floor(totalMonths / 12) > 1 ? 's' : ''}${totalMonths % 12 ? ` ${totalMonths % 12} mois` : ''}`
    : `${totalMonths} mois`

  const points = useMemo(() => {
    if (!taches?.length) return []
    const days = Math.max(1, Math.round((endDate - startDate) / 86400000))
    const step = days > 120 ? Math.ceil(days / 120) : 1
    const taskInfos = taches.map((tt) => {
      let d = null
      if (tt.echeance) { const pd = new Date(tt.echeance); if (!isNaN(pd)) d = pd }
      if (!d && tt.jalon) {
        const found = enrichedJalons.find((j) => (j.label ?? '').trim() === (tt.jalon ?? '').trim())
        if (found) d = found.date
      }
      if (!d) d = endDate
      return { date: d, w: TASK_WEIGHT(tt.importance), av: Math.max(0, Math.min(100, tt.avancement ?? 0)) }
    })
    const out = []
    for (let t = new Date(startDate); t <= endDate; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + step)) {
      const d = new Date(t)
      let planned = 0, completed = 0
      for (const ti of taskInfos) {
        if (ti.date <= d) planned += ti.w
        const totalSpan = Math.max(1, (ti.date - startDate) / 86400000)
        const elapsed   = Math.max(0, Math.min(totalSpan, (d - startDate) / 86400000))
        completed += ti.w * (ti.av / 100) * Math.max(0, Math.min(1, elapsed / totalSpan))
      }
      out.push({ date: new Date(d), planned, completed })
    }
    const totalPlanned = taskInfos.reduce((s, t) => s + t.w, 0)
    const totalDone    = taskInfos.reduce((s, t) => s + t.w * (t.av / 100), 0)
    if (out.length) { out[out.length - 1].planned = totalPlanned; out[out.length - 1].completed = totalDone }
    return out
  }, [taches, enrichedJalons, startDate, endDate])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Chargement…</div>
  )

  if (enrichedJalons.length === 0) return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader />
      {notif.msg && <Notif {...notif} />}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <span className="text-3xl">📅</span>
        <p className="text-sm font-medium text-gray-600">Aucun jalon défini</p>
        <p className="text-xs text-gray-400">Renseignez des jalons dans le Cahier des Charges.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader />
      {notif.msg && <Notif {...notif} />}

      {/* ── Header projet ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-lg font-bold leading-tight">{meta.nom || 'Pilotage Projet'}</h2>
          <p className="text-gray-400 text-xs mt-1">
            {enrichedJalons.length} jalon{enrichedJalons.length > 1 ? 's' : ''} · Durée : {durationStr}
            {meta.chef ? ` · Chef : ${meta.chef}` : ''}
          </p>
        </div>
        <div className="flex gap-6">
          {[
            ['Début',      fmtDate(startDate)],
            ['Fin prévue', fmtDate(endDate)],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-gray-500 text-[.65rem] font-bold uppercase tracking-wider">{label}</div>
              <div className="text-gray-300 text-xs font-semibold mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grille KPI 2×2 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PanelAvancement
          progressPct={progressPct}
          taskPct={taskPct}
          startDate={startDate}
          endDate={endDate}
          enrichedJalons={enrichedJalons}
        />
        <PanelTaches
          taskPct={taskPct}
          taches={taches}
        />
        <PanelRisques risques={risques} />
        <PanelBudget
          projet={projet}
          depenses={depenses}
          taskPct={taskPct}
          progressPct={progressPct}
        />
      </div>

      {/* ── Timeline pleine largeur ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Timeline</span>
        </div>
        <div className="overflow-x-auto">
          <TimelineSVG jalons={enrichedJalons} startDate={startDate} endDate={endDate} onSelect={goToTachesByJalon} />
        </div>
      </div>

      {/* ── Courbe en S pleine largeur ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 19h16M4 15c4-3 6 0 10-5 4-5 6 1 6 1" />
            </svg>
          </div>
          <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Courbe en S</span>
        </div>
        {points && points.length > 1 ? (
          <div className="min-h-[280px]">
            <SCurve points={points} startDate={startDate} endDate={endDate} projectName={meta.nom} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-8 text-center text-sm text-gray-500 dark:text-slate-400">
            Pas encore assez de données pour afficher la courbe en S.
          </div>
        )}
      </div>

      {/* ── Détail des jalons ───────────────────────────────────────────── */}
      <div>
        <div className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">Détail des jalons</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {enrichedJalons.map((j, i) => {
            const col    = j._color
            const badge  = j._badge
            const avg    = jalonAvg(j, taches)
            const linked = taches.filter((t) => (t.jalon ?? '').trim() === j.label.trim())
            const diff   = Math.round((j.date - TODAY) / 86400000)
            const diffStr = diff < 0
              ? `${Math.abs(diff)} j. écoulés`
              : diff === 0 ? "Aujourd'hui" : `Dans ${diff} j.`

            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => goToTachesByJalon(j.label)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTachesByJalon(j.label) } }}
                title={`Voir les tâches du jalon « ${j.label} »`}
                className="relative bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: col }} />
                <div className="ml-2">
                  <div className="text-[.65rem] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                    Jalon {i + 1}{linked.length > 0 ? ` · ${linked.length} tâche${linked.length > 1 ? 's' : ''}` : ''}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight mb-2">{j.label}</div>

                  <span className="inline-flex items-center text-[.68rem] font-bold rounded-full px-2.5 py-0.5 mb-2" style={{ color: col, background: col + '18' }}>
                    {badge}
                  </span>

                  <div className="text-xs font-semibold mb-1" style={{ color: col }}>
                    {fmtDate(j.date)}{' '}
                    <span className="text-gray-400 font-normal">({diffStr})</span>
                  </div>

                  {j.desc && <p className="text-xs text-gray-400 dark:text-slate-500 leading-snug mb-2">{j.desc}</p>}

                  {avg !== null ? (
                    <div className="mt-2">
                      <div className="flex justify-between text-[.65rem] text-gray-400 mb-1">
                        <span>Avancement tâches</span>
                        <span className="font-bold" style={{ color: col }}>{avg >= 100 ? '✓ ' : ''}{avg} %</span>
                      </div>
                      <MiniBar value={avg} color={col} />
                    </div>
                  ) : (
                    <p className="text-[.7rem] text-gray-300 dark:text-slate-600 italic mt-2">Aucune tâche associée</p>
                  )}

                  {linked.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 space-y-2">
                      {linked.map((t) => (
                        <div key={t.id} className="flex items-center gap-2">
                          <span className="text-[.65rem] font-bold text-right w-7 flex-shrink-0" style={{ color: (t.avancement ?? 0) >= 100 ? '#16a34a' : '#94a3b8' }}>
                            {t.avancement ?? 0}%
                          </span>
                          <div className="flex-shrink-0 w-12">
                            <MiniBar value={t.avancement ?? 0} color={(t.avancement ?? 0) >= 100 ? '#16a34a' : '#3b82f6'} />
                          </div>
                          <span className="text-[.72rem] text-gray-700 dark:text-slate-300 truncate">{t.nom}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight">Planning & Pilotage</div>
        <div className="text-xs text-gray-400 dark:text-slate-500">Tableau de bord du projet</div>
      </div>
    </div>
  )
}

function Notif({ msg, type }) {
  const cls = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${cls}`}>{msg}</div>
}
