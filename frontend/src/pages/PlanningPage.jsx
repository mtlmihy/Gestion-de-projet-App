import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCdc } from '../api/cdc'
import { getTaches } from '../api/taches'
import { useProject } from '../context/ProjectContext'

// ── Helpers ───────────────────────────────────────────────────────────────────
const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function fmtDate(d) {
  if (!d || isNaN(d)) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtShort(d) {
  if (!d || isNaN(d)) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// Couleur d'un jalon selon avancement tâches associées, ou date
function jalonColor(jalon, tasks) {
  const linked = tasks.filter((t) => (t.jalon ?? '').trim() === jalon.label.trim())
  if (linked.length > 0) {
    const avg = linked.reduce((s, t) => s + (t.avancement ?? 0), 0) / linked.length
    if (avg >= 100) return '#16a34a' // vert — terminé
    if (avg >= 50)  return '#2563eb' // bleu — en cours
    if (avg > 0)    return '#f59e0b' // orange — démarré
    return '#ef4444'                 // rouge — non démarré
  }
  const diff = (jalon.date - TODAY) / 86400000
  if (diff < 0)   return '#94a3b8'   // gris — passé
  if (diff <= 30) return '#f59e0b'   // orange — proche
  return '#2563eb'                   // bleu — futur
}

function jalonBadge(jalon, tasks) {
  const linked = tasks.filter((t) => (t.jalon ?? '').trim() === jalon.label.trim())
  if (linked.length > 0) {
    const avg = linked.reduce((s, t) => s + (t.avancement ?? 0), 0) / linked.length
    if (avg >= 100) return '✓ Terminé'
    if (avg >= 50)  return '▶ En cours'
    if (avg > 0)    return '◐ Démarré'
    return '○ Non démarré'
  }
  const diff = (jalon.date - TODAY) / 86400000
  if (diff < 0)   return '✓ Passé'
  if (diff <= 30) return '⚡ Prochain'
  return '→ À venir'
}

function jalonAvg(jalon, tasks) {
  const linked = tasks.filter((t) => (t.jalon ?? '').trim() === jalon.label.trim())
  if (!linked.length) return null
  return Math.round(linked.reduce((s, t) => s + (t.avancement ?? 0), 0) / linked.length)
}

// ── Barre de progression mini ─────────────────────────────────────────────────
function MiniBar({ value, color = '#3b82f6' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : color }} />
    </div>
  )
}

// ── Timeline SVG ──────────────────────────────────────────────────────────────
function TimelineSVG({ jalons, startDate, endDate, onSelect }) {
  const W = 900, H = 230, PL = 70, PR = 70
  const TW = W - PL - PR
  const BAR_Y = 115, BAR_H = 10

  const totalDays = Math.max(1, (endDate - startDate) / 86400000)
  function xOf(d) { return PL + (d - startDate) / 86400000 / totalDays * TW }

  const todayX = Math.max(PL + 1, Math.min(PL + TW - 1, xOf(TODAY)))
  const pastW  = Math.max(0, todayX - PL)
  const futW   = Math.max(0, PL + TW - todayX)

  // Ticks mensuels
  const ticks = []
  const td = new Date(startDate)
  td.setDate(1)
  td.setMonth(td.getMonth() + 1)
  while (td <= endDate) {
    const tx  = xOf(new Date(td))
    const lbl = td.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    ticks.push(
      <line key={`tl-${td}`} x1={tx} y1={BAR_Y - 6} x2={tx} y2={BAR_Y + BAR_H + 6} stroke="#e2e8f0" strokeWidth="1" />,
      <text key={`tt-${td}`} x={tx} y={BAR_Y + BAR_H + 18} textAnchor="middle" fontSize="8" fill="#94a3b8">{lbl}</text>
    )
    td.setMonth(td.getMonth() + 1)
  }

  // Losanges jalons
  const DS = 7
  const milestones = jalons.map((j, i) => {
    const x     = xOf(j.date)
    const col   = j._color
    const above = i % 2 === 0
    const sy1   = above ? BAR_Y : BAR_Y + BAR_H
    const sy2   = above ? BAR_Y - 48 : BAR_Y + BAR_H + 48
    const ly    = above ? BAR_Y - 56 : BAR_Y + BAR_H + 62
    const dy    = above ? BAR_Y - 67 : BAR_Y + BAR_H + 73
    return (
      <g
        key={i}
        onClick={onSelect ? () => onSelect(j.label) : undefined}
        style={onSelect ? { cursor: 'pointer' } : undefined}
      >
        {onSelect && <title>{`Voir les tâches du jalon « ${j.label} »`}</title>}
        <line x1={x} y1={sy1} x2={x} y2={sy2} stroke={col} strokeWidth="1.5" strokeDasharray="3,2" opacity=".8" />
        <polygon points={`${x},${BAR_Y - DS} ${x + DS},${BAR_Y} ${x},${BAR_Y + DS} ${x - DS},${BAR_Y}`} fill={col} />
        <text x={x} y={ly} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1e293b">{j.label}</text>
        <text x={x} y={dy} textAnchor="middle" fontSize="8" fill={col}>{fmtShort(j.date)}</text>
      </g>
    )
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 520 }} xmlns="http://www.w3.org/2000/svg">
      {ticks}
      {/* Barre de fond */}
      <rect x={PL} y={BAR_Y} width={TW} height={BAR_H} rx="5" fill="#f1f5f9" />
      {/* Passé */}
      <rect x={PL} y={BAR_Y} width={pastW} height={BAR_H} rx="5" fill="#94a3b8" />
      {/* Futur */}
      <rect x={todayX} y={BAR_Y} width={futW} height={BAR_H} rx="5" fill="#2563eb" opacity=".25" />
      {milestones}
      {/* Ligne aujourd'hui */}
      <line x1={todayX} y1={BAR_Y - 52} x2={todayX} y2={BAR_Y + BAR_H + 48} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" />
      <rect x={todayX - 16} y={BAR_Y + BAR_H + 48} width="32" height="14" rx="4" fill="#ef4444" />
      <text x={todayX} y={BAR_Y + BAR_H + 58} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">Auj.</text>
    </svg>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PlanningPage() {
  const { projet } = useProject()
  const navigate = useNavigate()
  const goToTachesByJalon = useCallback((label) => {
    const v = (label ?? '').trim()
    if (!v) return
    navigate(`/taches?jalon=${encodeURIComponent(v)}`)
  }, [navigate])
  const [jalons,     setJalons]     = useState([])
  const [taches,     setTaches]     = useState([])
  const [meta,       setMeta]       = useState({ nom: '', chef: '', dateDebut: '' })
  const [loading,    setLoading]    = useState(true)
  const [notif,      setNotif]      = useState({ msg: '', type: 'ok' })

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
      } catch (e) {
        console.warn('CDC parse error', e)
      }
    }).catch(() => { /* pas de CDC — page s'affiche vide */ })

    const loadTaches = getTaches(projet.id).then(({ data }) => {
      setTaches(data)
    }).catch(() => notify('Erreur lors du chargement des tâches.', 'error'))

    Promise.all([loadCdc, loadTaches]).finally(() => setLoading(false))
  }, [projet?.id])

  // Recharge à chaque fois que la page redevient visible (retour depuis Tâches/CDC)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  useEffect(() => { load() }, [load])

  // Enrichir jalons avec leur couleur (calculée ici pour réutiliser)
  const enrichedJalons = useMemo(() =>
    jalons.map((j) => ({ ...j, _color: jalonColor(j, taches) })),
    [jalons, taches]
  )

  // Dates extrêmes
  const startDate = useMemo(() => {
    const fromMeta = meta.dateDebut ? new Date(meta.dateDebut) : null
    if (fromMeta && !isNaN(fromMeta)) return fromMeta
    return enrichedJalons[0]?.date ?? TODAY
  }, [meta.dateDebut, enrichedJalons])

  const endDate = useMemo(() =>
    enrichedJalons.length ? enrichedJalons[enrichedJalons.length - 1].date : TODAY,
    [enrichedJalons]
  )

  // Progression globale : position d'aujourd'hui dans l'intervalle
  const progressPct = useMemo(() => {
    const total = Math.max(1, endDate - startDate)
    const done  = Math.max(0, Math.min(total, TODAY - startDate))
    return Math.round(done / total * 100)
  }, [startDate, endDate])

  const totalMonths = Math.round(Math.max(0, endDate - startDate) / 86400000 / 30)
  const durationStr = totalMonths >= 12
    ? `${Math.floor(totalMonths / 12)} an${Math.floor(totalMonths / 12) > 1 ? 's' : ''}${totalMonths % 12 ? ` ${totalMonths % 12} mois` : ''}`
    : `${totalMonths} mois`

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Chargement…</div>
  )

  if (enrichedJalons.length === 0) return (
    <div className="space-y-4">
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
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader />
      {notif.msg && <Notif {...notif} />}

      {/* ── Header projet ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-lg font-bold leading-tight">{meta.nom || 'Planning Projet'}</h2>
          <p className="text-gray-400 text-xs mt-1">
            {enrichedJalons.length} jalon{enrichedJalons.length > 1 ? 's' : ''} · Durée : {durationStr}
            {meta.chef ? ` · Chef : ${meta.chef}` : ''}
          </p>
        </div>
        <div className="flex gap-6">
          {[
            ['Début',       fmtDate(startDate)],
            ['Fin prévue',  fmtDate(endDate)],
            ['Avancement',  `${progressPct} %`],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-gray-500 text-[.65rem] font-bold uppercase tracking-wider">{label}</div>
              <div className="text-gray-300 text-xs font-semibold mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Barre de progression globale ───────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Avancement global du projet</span>
          <span className="text-sm font-bold text-blue-600">{progressPct} %</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: progressPct >= 100
                ? '#16a34a'
                : 'linear-gradient(90deg, #2563eb, #3b82f6)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[.68rem] text-gray-400 dark:text-slate-500">
          <span>{fmtDate(startDate)}</span>
          <span className="text-red-500 font-semibold">Aujourd'hui : {fmtDate(TODAY)}</span>
          <span>{fmtDate(endDate)}</span>
        </div>
      </div>

      {/* ── Timeline SVG ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-5 overflow-x-auto">
        <div className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-4">Timeline</div>
        <TimelineSVG jalons={enrichedJalons} startDate={startDate} endDate={endDate} onSelect={goToTachesByJalon} />
      </div>

      {/* ── Cartes jalons ──────────────────────────────────────────────── */}
      <div>
        <div className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">Détail des jalons</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {enrichedJalons.map((j, i) => {
            const col    = j._color
            const badge  = jalonBadge(j, taches)
            const avg    = jalonAvg(j, taches)
            const linked = taches.filter((t) => (t.jalon ?? '').trim() === j.label.trim())
            const diff   = Math.round((j.date - TODAY) / 86400000)
            const diffStr = diff < 0
              ? `${Math.abs(diff)} j. écoulés`
              : diff === 0 ? "Aujourd'hui" : `Dans ${diff} j.`

            // Couleurs de fond pastel selon couleur principale
            const bgMap = { '#16a34a': 'bg-green-50 border-green-100', '#2563eb': 'bg-blue-50 border-blue-100', '#f59e0b': 'bg-amber-50 border-amber-100', '#ef4444': 'bg-red-50 border-red-100', '#94a3b8': 'bg-gray-50 border-gray-100' }
            const bg = bgMap[col] ?? 'bg-gray-50 border-gray-100'

            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => goToTachesByJalon(j.label)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTachesByJalon(j.label) } }}
                title={`Voir les tâches du jalon « ${j.label} »`}
                className={`relative bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400`}
              >
                {/* Accent coloré à gauche */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: col }} />

                <div className="ml-2">
                  <div className="text-[.65rem] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                    Jalon {i + 1}{linked.length > 0 ? ` · ${linked.length} tâche${linked.length > 1 ? 's' : ''}` : ''}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight mb-2">{j.label}</div>

                  {/* Badge statut */}
                  <span
                    className="inline-flex items-center text-[.68rem] font-bold rounded-full px-2.5 py-0.5 mb-2"
                    style={{ color: col, background: col + '18' }}
                  >
                    {badge}
                  </span>

                  <div className="text-xs font-semibold mb-1" style={{ color: col }}>
                    {fmtDate(j.date)}{' '}
                    <span className="text-gray-400 font-normal">({diffStr})</span>
                  </div>

                  {j.desc && <p className="text-xs text-gray-400 dark:text-slate-500 leading-snug mb-2">{j.desc}</p>}

                  {/* Barre avancement tâches */}
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

                  {/* Liste des tâches */}
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
        <div className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight">Planning</div>
        <div className="text-xs text-gray-400 dark:text-slate-500">Jalons &amp; avancement</div>
      </div>
    </div>
  )
}

function Notif({ msg, type }) {
  const cls = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${cls}`}>{msg}</div>
}
