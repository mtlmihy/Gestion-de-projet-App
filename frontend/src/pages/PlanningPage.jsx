import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCdc } from '../api/cdc'
import { getTaches } from '../api/taches'
import { getRisques } from '../api/risques'
import { getDepenses } from '../api/budget'
import { useProject } from '../context/ProjectContext'
import SCurve from '../components/SCurve'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

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
function fmtCurrency(n, devise = 'CHF') {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: devise, maximumFractionDigits: 0 }).format(n)
}

const TASK_WEIGHT = (imp) => {
  const v = (imp || '').toLowerCase()
  if (v === 'faible')  return 1
  if (v === 'moyenne') return 2
  if (v === 'élevée' || v === 'elevee') return 3
  if (v === 'critique') return 4
  return 2
}

function jalonColor(jalon, tasks) {
  const linked = tasks.filter((t) => (t.jalon ?? '').trim() === jalon.label.trim())
  if (linked.length > 0) {
    const avg = linked.reduce((s, t) => s + (t.avancement ?? 0), 0) / linked.length
    if (avg >= 100) return '#16a34a'
    if (avg >= 50)  return '#2563eb'
    if (avg > 0)    return '#f59e0b'
    return '#ef4444'
  }
  const diff = (jalon.date - TODAY) / 86400000
  if (diff < 0)   return '#94a3b8'
  if (diff <= 30) return '#f59e0b'
  return '#2563eb'
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

function MiniBar({ value, color = '#3b82f6' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : color }} />
    </div>
  )
}

function DraggablePanel({ id, label, children, size, position, onResize }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  
  const style = {
    position: 'absolute',
    left: `${position?.x ?? 0}px`,
    top: `${position?.y ?? 0}px`,
    width: size?.width ? `${size.width}px` : '520px',
    height: size?.height ? `${size.height}px` : 'auto',
    minWidth: 320,
    minHeight: 280,
    transform: CSS.Transform.toString(transform),
    zIndex: isDragging ? 20 : 10,
    transition: !isDragging ? 'none' : undefined,
  }

  const handlePointerDown = useCallback((event) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const rootEl = event.currentTarget.closest('[data-draggable-panel]')
    if (!rootEl) return

    const startWidth = rootEl.offsetWidth
    const startHeight = rootEl.offsetHeight
    const startX = event.clientX
    const startY = event.clientY

    const onPointerMove = (moveEvent) => {
      const nextWidth = Math.max(320, startWidth + (moveEvent.clientX - startX))
      const nextHeight = Math.max(280, startHeight + (moveEvent.clientY - startY))
      onResize?.(id, nextWidth, nextHeight)
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [id, onResize])

  return (
    <div ref={setNodeRef} data-draggable-panel style={style} className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden ${isDragging ? 'shadow-2xl opacity-95' : ''}`}>
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-3 cursor-grab active:cursor-grabbing select-none"
      >
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">{label}</span>
        <button
          type="button"
          title={`Redimensionner ${label}`}
          onPointerDown={handlePointerDown}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 active:text-slate-700 transition opacity-50 hover:opacity-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20l16-16M14 20h6v-6" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  )
}

function PanelTimeline({ jalons, startDate, endDate, onSelect }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3" />
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Timeline</span>
      </div>
      <TimelineSVG jalons={jalons} startDate={startDate} endDate={endDate} onSelect={onSelect} />
    </div>
  )
}

function PanelSCurve({ points, startDate, endDate, projectName }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 19h16M4 15c4-3 6 0 10-5 4-5 6 1 6 1" />
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Courbe en S</span>
      </div>
      {points && points.length > 1 ? (
        <div className="flex-1 min-h-[260px]">
          <SCurve points={points} startDate={startDate} endDate={endDate} projectName={projectName} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Pas encore assez de données pour afficher la courbe en S.
        </div>
      )}
    </div>
  )
}

// ── Timeline SVG ──────────────────────────────────────────────────────────────
function TimelineSVG({ jalons, startDate, endDate, onSelect }) {
  const W = 900, H = 210, PL = 70, PR = 70
  const TW = W - PL - PR
  const BAR_Y = 115, BAR_H = 10

  const totalDays = Math.max(1, (endDate - startDate) / 86400000)
  function xOf(d) { return PL + (d - startDate) / 86400000 / totalDays * TW }

  const todayX = Math.max(PL + 1, Math.min(PL + TW - 1, xOf(TODAY)))
  const pastW  = Math.max(0, todayX - PL)
  const futW   = Math.max(0, PL + TW - todayX)

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

  const DS = 7
  const MIN_DATE_GAP = 58
  let lastTopDateX = -Infinity
  let lastBottomDateX = -Infinity
  const milestones = jalons.map((j, i) => {
    const x     = xOf(j.date)
    const col   = j._color
    const above = i % 2 === 0
    const sy1   = above ? BAR_Y : BAR_Y + BAR_H
    const sy2   = above ? BAR_Y - 32 : BAR_Y + BAR_H + 32
    const dy    = above ? BAR_Y - 40 : BAR_Y + BAR_H + 44
    const lastX = above ? lastTopDateX : lastBottomDateX
    const showDate = i === 0 || i === jalons.length - 1 || (x - lastX >= MIN_DATE_GAP)
    if (showDate) {
      if (above) lastTopDateX = x
      else lastBottomDateX = x
    }
    return (
      <g key={i} onClick={onSelect ? () => onSelect(j.label) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
        {onSelect && <title>{`Voir les tâches du jalon « ${j.label} »`}</title>}
        <line x1={x} y1={sy1} x2={x} y2={sy2} stroke={col} strokeWidth="1.5" strokeDasharray="3,2" opacity=".8" />
        <polygon points={`${x},${BAR_Y - DS} ${x + DS},${BAR_Y} ${x},${BAR_Y + DS} ${x - DS},${BAR_Y}`} fill={col} />
        {showDate && <text x={x} y={dy} textAnchor="middle" fontSize="8" fill={col}>{fmtShort(j.date)}</text>}
      </g>
    )
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 520 }} xmlns="http://www.w3.org/2000/svg">
      {ticks}
      <rect x={PL} y={BAR_Y} width={TW} height={BAR_H} rx="5" fill="#f1f5f9" />
      <rect x={PL} y={BAR_Y} width={pastW} height={BAR_H} rx="5" fill="#525252" />
      <rect x={todayX} y={BAR_Y} width={futW} height={BAR_H} rx="5" fill="#2563eb" opacity=".25" />
      {milestones}
      <line x1={todayX} y1={BAR_Y - 22} x2={todayX} y2={BAR_Y + BAR_H + 44} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" />
      <rect x={todayX - 16} y={BAR_Y + BAR_H + 44} width="32" height="14" rx="4" fill="#ef4444" />
      <text x={todayX} y={BAR_Y + BAR_H + 54} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">Auj.</text>
    </svg>
  )
}

// ── Bannière d'alerte inline ──────────────────────────────────────────────────
function AlertBanner({ icon, children, level = 'error' }) {
  const styles = {
    error:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300',
    info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300',
  }
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${styles[level]}`}>
      <span className="flex-shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

// ── Panneau 1 : Avancement calendaire ────────────────────────────────────────
function PanelAvancement({ progressPct, taskPct, startDate, endDate, enrichedJalons }) {
  const daysLeft = Math.max(0, Math.round((endDate - TODAY) / 86400000))
  const daysPast = Math.max(0, Math.round((TODAY - startDate) / 86400000))
  const nextJalon = enrichedJalons.find((j) => j.date > TODAY)
  const retardAlert = progressPct > (taskPct ?? progressPct) + 15

  const col = progressPct >= 100 ? '#16a34a' : '#2563eb'
  const barBg = progressPct >= 100
    ? '#16a34a'
    : 'linear-gradient(90deg, #2563eb, #60a5fa)'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Avancement calendaire</span>
      </div>

      {/* Valeur principale */}
      <div className="flex items-end gap-3">
        <span className="text-5xl font-black leading-none" style={{ color: col }}>{progressPct}%</span>
        <span className="text-xs text-gray-400 dark:text-slate-500 pb-1">du projet écoulé</span>
      </div>

      {/* Barre */}
      <div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: barBg }} />
        </div>
        <div className="flex justify-between text-[.65rem] text-gray-400 dark:text-slate-500 mt-1">
          <span>{fmtShort(startDate)}</span>
          <span className="text-red-500 font-semibold">Auj. {fmtShort(TODAY)}</span>
          <span>{fmtShort(endDate)}</span>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-700 dark:text-slate-200">{daysPast}j</div>
          <div className="text-[.62rem] text-gray-400 dark:text-slate-500 mt-0.5">écoulés</div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-700 dark:text-slate-200">{daysLeft}j</div>
          <div className="text-[.62rem] text-gray-400 dark:text-slate-500 mt-0.5">restants</div>
        </div>
      </div>

      {/* Alerte retard */}
      {retardAlert && (
        <AlertBanner icon="⚠️" level="warning">
          Retard détecté — le calendrier avance plus vite que la réalisation des tâches ({progressPct}% vs {taskPct}%).
        </AlertBanner>
      )}

      {/* Prochain jalon */}
      {nextJalon && (
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-xs text-blue-700 dark:text-blue-300 truncate font-medium">
            {nextJalon.label}
          </span>
          <span className="text-xs text-blue-400 dark:text-blue-500 flex-shrink-0">{fmtShort(nextJalon.date)}</span>
        </div>
      )}
    </div>
  )
}

// ── Panneau 2 : Réalisation tâches ───────────────────────────────────────────
function PanelTaches({ taskPct, taches }) {
  const terminees  = taches.filter((t) => (t.avancement ?? 0) >= 100).length
  const enCours    = taches.filter((t) => (t.avancement ?? 0) > 0 && (t.avancement ?? 0) < 100).length
  const nonDemarr  = taches.filter((t) => (t.avancement ?? 0) === 0).length
  const total      = taches.length
  const critiques  = taches.filter((t) => (t.importance || '').toLowerCase() === 'critique').length

  const col = taskPct >= 70 ? '#16a34a' : taskPct >= 30 ? '#f59e0b' : '#ef4444'
  const barBg = taskPct >= 70 ? '#16a34a' : taskPct >= 30 ? '#f59e0b' : '#ef4444'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Réalisation des tâches</span>
      </div>

      {/* Valeur principale */}
      <div className="flex items-end gap-3">
        <span className="text-5xl font-black leading-none" style={{ color: col }}>{taskPct}%</span>
        <span className="text-xs text-gray-400 dark:text-slate-500 pb-1">complété (pondéré)</span>
      </div>

      {/* Barre */}
      <div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${taskPct}%`, background: barBg }} />
        </div>
        <div className="flex justify-between text-[.65rem] text-gray-400 dark:text-slate-500 mt-1">
          <span>0%</span>
          <span>{total} tâche{total > 1 ? 's' : ''} au total</span>
          <span>100%</span>
        </div>
      </div>

      {/* Compteurs statuts */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Terminées', val: terminees,  color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'En cours',  val: enCours,    color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'À faire',   val: nonDemarr,  color: 'text-gray-500 dark:text-slate-400',  bg: 'bg-gray-50 dark:bg-slate-700/50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-[.62rem] text-gray-400 dark:text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tâches critiques */}
      {critiques > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">
          <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-xs text-red-700 dark:text-red-300 font-medium">
            {critiques} tâche{critiques > 1 ? 's' : ''} critique{critiques > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Panneau 3 : Matrice des risques ──────────────────────────────────────────
function PanelRisques({ risques }) {
  const PROBA  = ['Faible', 'Moyenne', 'Élevée']
  const IMPACT = ['Faible', 'Moyen', 'Élevé']

  const probScore  = { Faible: 1, Moyenne: 2, 'Élevée': 3 }
  const impactScore = { Faible: 1, Moyen: 2, 'Élevé': 3 }

  function cellStyle(prob, impact) {
    const s = probScore[prob] * impactScore[impact]
    if (s >= 6) return { bg: '#fef2f2', border: '#fca5a5', numCol: '#dc2626', label: 'P1' }
    if (s >= 3) return { bg: '#fff7ed', border: '#fdba74', numCol: '#ea580c', label: 'P2' }
    return       { bg: '#f0fdf4', border: '#86efac', numCol: '#16a34a', label: 'P3' }
  }

  const total    = risques.length
  const ouverts  = risques.filter((r) => r.statut === 'Ouvert').length
  const enCours  = risques.filter((r) => r.statut === 'En cours').length
  const fermes   = risques.filter((r) => r.statut === 'Fermé').length
  const p1Count  = risques.filter((r) => r.priorite === 1 && r.statut !== 'Fermé').length
  const p2Count  = risques.filter((r) => r.priorite === 2 && r.statut !== 'Fermé').length
  const p3Count  = risques.filter((r) => r.priorite === 3 && r.statut !== 'Fermé').length

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Risques</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500">{total} au total · {fermes} fermé{fermes > 1 ? 's' : ''}</span>
      </div>

      {/* Résumé P1/P2/P3 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Critiques P1', val: p1Count, bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-100 dark:border-red-800',    col: 'text-red-600 dark:text-red-400' },
          { label: 'Élevés P2',    val: p2Count, bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-800', col: 'text-orange-600 dark:text-orange-400' },
          { label: 'Faibles P3',   val: p3Count, bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-100 dark:border-green-800',  col: 'text-green-600 dark:text-green-400' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-2.5 text-center`}>
            <div className={`text-2xl font-black ${s.col}`}>{s.val}</div>
            <div className="text-[.62rem] text-gray-400 dark:text-slate-500 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alerte P1 */}
      {p1Count > 0 && (
        <AlertBanner icon="🔴" level="error">
          {p1Count} risque{p1Count > 1 ? 's' : ''} critique{p1Count > 1 ? 's' : ''} (P1) actif{p1Count > 1 ? 's' : ''} — action immédiate requise.
        </AlertBanner>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-slate-600 gap-2">
          <span className="text-xs">Aucun risque enregistré</span>
        </div>
      ) : (
        <>
          {/* Matrice 3×3 */}
          <div>
            <div className="text-[.62rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">Matrice Probabilité × Impact</div>
            <div className="flex gap-2">
              {/* Axe Y — Probabilité */}
              <div className="flex flex-col justify-around w-14 flex-shrink-0">
                {[...PROBA].reverse().map((p) => (
                  <div key={p} className="text-[.6rem] text-gray-400 dark:text-slate-500 text-right leading-none">{p}</div>
                ))}
              </div>

              {/* Grille */}
              <div className="flex-1 flex flex-col gap-1">
                {[...PROBA].reverse().map((prob) => (
                  <div key={prob} className="grid grid-cols-3 gap-1">
                    {IMPACT.map((impact) => {
                      const actifs = risques.filter(
                        (r) => r.probabilite === prob && r.impact === impact && r.statut !== 'Fermé'
                      ).length
                      const clos = risques.filter(
                        (r) => r.probabilite === prob && r.impact === impact && r.statut === 'Fermé'
                      ).length
                      const style = cellStyle(prob, impact)
                      return (
                        <div
                          key={`${prob}-${impact}`}
                          className="rounded-lg flex flex-col items-center justify-center h-11 border"
                          style={{ background: actifs > 0 ? style.bg : '#f8fafc', borderColor: actifs > 0 ? style.border : '#e2e8f0' }}
                          title={`${prob} / ${impact} : ${actifs} actif${actifs > 1 ? 's' : ''}${clos > 0 ? `, ${clos} fermé${clos > 1 ? 's' : ''}` : ''}`}
                        >
                          {actifs > 0 ? (
                            <span className="text-lg font-black leading-none" style={{ color: style.numCol }}>{actifs}</span>
                          ) : clos > 0 ? (
                            <span className="text-xs font-semibold text-gray-300 dark:text-slate-600">{clos}✓</span>
                          ) : (
                            <span className="text-gray-200 dark:text-slate-700">—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {/* Axe X — Impact */}
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {IMPACT.map((imp) => (
                    <div key={imp} className="text-[.6rem] text-gray-400 dark:text-slate-500 text-center">{imp}</div>
                  ))}
                </div>
              </div>
            </div>
            {/* Légende axes */}
            <div className="flex justify-between text-[.58rem] text-gray-300 dark:text-slate-600 mt-0.5 px-16">
              <span>← Probabilité (axe gauche)</span>
              <span>Impact →</span>
            </div>
          </div>

          {/* Barre de répartition statuts */}
          <div>
            <div className="text-[.62rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1.5">Statuts</div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
              {ouverts > 0 && <div style={{ width: `${ouverts / total * 100}%`, background: '#ef4444' }} title={`Ouvert : ${ouverts}`} className="rounded-full" />}
              {enCours > 0 && <div style={{ width: `${enCours / total * 100}%`, background: '#f59e0b' }} title={`En cours : ${enCours}`} className="rounded-full" />}
              {fermes  > 0 && <div style={{ width: `${fermes  / total * 100}%`, background: '#22c55e' }} title={`Fermé : ${fermes}`}  className="rounded-full" />}
            </div>
            <div className="flex gap-3 mt-1.5">
              {[
                { label: `Ouvert (${ouverts})`,   color: '#ef4444' },
                { label: `En cours (${enCours})`, color: '#f59e0b' },
                { label: `Fermé (${fermes})`,     color: '#22c55e' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-[.62rem] text-gray-500 dark:text-slate-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Panneau 4 : Pilotage budgétaire ──────────────────────────────────────────
function PanelBudget({ projet, depenses, taskPct, progressPct }) {
  const isClient = projet?.type_projet === 'Client'
  const bac      = Number(projet?.budget_prevu || 0)
  const devise   = projet?.devise || 'CHF'

  if (!isClient || !bac) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Suivi budgétaire non activé</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Disponible pour les projets Client avec budget défini.</p>
        </div>
      </div>
    )
  }

  const ac   = depenses.reduce((s, d) => s + Number(d.montant), 0)
  const ev   = bac * (taskPct / 100)
  const pv   = bac * (progressPct / 100)
  const cpi  = ac > 0 ? ev / ac : null
  const spi  = pv > 0 ? ev / pv : null
  const ecart = ev - ac
  const pctConsomme = bac > 0 ? Math.min(100, (ac / bac) * 100) : 0

  function indexColor(val) {
    if (val === null) return { col: '#94a3b8', bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-400' }
    if (val >= 0.95)  return { col: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' }
    if (val >= 0.80)  return { col: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' }
    return              { col: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' }
  }

  const cpiStyle = indexColor(cpi)
  const spiStyle = indexColor(spi)

  const cpiLabel = cpi === null ? 'N/A' : cpi >= 0.95 ? 'Sous budget' : cpi >= 0.80 ? 'Attention' : 'Dépassement'
  const spiLabel = spi === null ? 'N/A' : spi >= 0.95 ? 'Dans les temps' : spi >= 0.80 ? 'Léger retard' : 'En retard'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Pilotage budgétaire</span>
      </div>

      {/* Alertes budget */}
      {cpi !== null && cpi < 0.8 && (
        <AlertBanner icon="🔴" level="error">
          Dépassement budgétaire — CPI à {cpi.toFixed(2)} (chaque CHF dépensé produit {fmtCurrency(ev / ac, devise)} de valeur).
        </AlertBanner>
      )}
      {cpi !== null && cpi >= 0.8 && cpi < 0.95 && (
        <AlertBanner icon="⚠️" level="warning">
          Attention budget — CPI à {cpi.toFixed(2)}, légèrement en dessous de l'objectif.
        </AlertBanner>
      )}
      {pctConsomme >= 90 && cpi === null && (
        <AlertBanner icon="⚠️" level="warning">
          Budget consommé à {pctConsomme.toFixed(0)} % — surveiller les dépenses restantes.
        </AlertBanner>
      )}

      {/* CPI + SPI badges */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPI */}
        <div className={`${cpiStyle.bg} rounded-xl p-3`}>
          <div className="text-[.6rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">CPI — Coût</div>
          <div className={`text-3xl font-black leading-none ${cpiStyle.text}`}>
            {cpi === null ? '—' : cpi.toFixed(2)}
          </div>
          <div className={`text-[.68rem] font-semibold mt-1 ${cpiStyle.text}`}>{cpiLabel}</div>
          <div className="text-[.6rem] text-gray-400 dark:text-slate-500 mt-0.5">
            {cpi !== null && (cpi >= 1 ? '▲ Sous budget' : '▼ Dépassement prévu')}
          </div>
        </div>
        {/* SPI */}
        <div className={`${spiStyle.bg} rounded-xl p-3`}>
          <div className="text-[.6rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">SPI — Délai</div>
          <div className={`text-3xl font-black leading-none ${spiStyle.text}`}>
            {spi === null ? '—' : spi.toFixed(2)}
          </div>
          <div className={`text-[.68rem] font-semibold mt-1 ${spiStyle.text}`}>{spiLabel}</div>
          <div className="text-[.6rem] text-gray-400 dark:text-slate-500 mt-0.5">
            {spi !== null && (spi >= 1 ? '▲ En avance' : '▼ En retard')}
          </div>
        </div>
      </div>

      {/* Métriques clés */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {[
          { label: 'Budget (BAC)',       value: fmtCurrency(bac, devise),  col: 'text-gray-700 dark:text-slate-200' },
          { label: 'Coût réel (AC)',     value: fmtCurrency(ac,  devise),  col: 'text-gray-700 dark:text-slate-200' },
          { label: 'Valeur acquise (EV)',value: fmtCurrency(ev,  devise),  col: 'text-blue-600 dark:text-blue-400' },
          { label: 'Écart (EV − AC)',    value: (ecart >= 0 ? '+' : '') + fmtCurrency(ecart, devise), col: ecart >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
        ].map((m) => (
          <div key={m.label} className="bg-gray-50 dark:bg-slate-700/40 rounded-lg px-3 py-2">
            <div className="text-[.6rem] text-gray-400 dark:text-slate-500 uppercase tracking-wide">{m.label}</div>
            <div className={`text-sm font-bold mt-0.5 ${m.col}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Barre consommation */}
      <div>
        <div className="flex justify-between text-[.62rem] text-gray-400 dark:text-slate-500 mb-1.5">
          <span>Consommation budget</span>
          <span className="font-semibold">{pctConsomme.toFixed(1)} %</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${pctConsomme}%`,
              background: pctConsomme >= 100 ? '#ef4444' : pctConsomme >= 80 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
        <div className="flex justify-between text-[.6rem] text-gray-300 dark:text-slate-600 mt-0.5">
          <span>0</span>
          <span>{fmtCurrency(bac, devise)}</span>
        </div>
      </div>
    </div>
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

  const [jalons,   setJalons]   = useState([])
  const [taches,   setTaches]   = useState([])
  const [risques,  setRisques]  = useState([])
  const [depenses, setDepenses] = useState([])
  const [meta,     setMeta]     = useState({ nom: '', chef: '', dateDebut: '' })
  const [loading,  setLoading]  = useState(true)
  const [notif,    setNotif]    = useState({ msg: '', type: 'ok' })
  const [panelOrder, setPanelOrder] = useState(['avancement', 'taches', 'risques', 'budget', 'timeline', 'scurve'])
  const [visiblePanels, setVisiblePanels] = useState({
    avancement: true,
    taches: true,
    risques: true,
    budget: true,
    timeline: true,
    scurve: true,
  })
  const [panelSizes, setPanelSizes] = useState({})
  const [panelPositions, setPanelPositions] = useState({
    avancement: { x: 16, y: 16 },
    taches: { x: 560, y: 16 },
    risques: { x: 16, y: 360 },
    budget: { x: 560, y: 360 },
    timeline: { x: 16, y: 700 },
    scurve: { x: 560, y: 700 },
  })

  const GRID_SIZE = 16

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const visiblePanelIds = useMemo(() => panelOrder.filter((id) => visiblePanels[id]), [panelOrder, visiblePanels])

  const updatePanelSize = useCallback((id, width, height) => {
    setPanelSizes((prev) => ({ ...prev, [id]: { width, height } }))
  }, [])

  const togglePanel = useCallback((id) => {
    setVisiblePanels((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Détecte si deux rectangles se chevauchent
  const checkCollision = useCallback((rect1, rect2, padding = 8) => {
    return !(
      rect1.right + padding < rect2.left ||
      rect1.left > rect2.right + padding ||
      rect1.bottom + padding < rect2.top ||
      rect1.top > rect2.bottom + padding
    )
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, delta } = event
    if (!active || !delta) return

    setPanelPositions((prev) => {
      const current = prev[active.id]
      if (!current) return prev
      
      const nextX = Math.max(0, Math.round((current.x + delta.x) / GRID_SIZE) * GRID_SIZE)
      const nextY = Math.max(0, Math.round((current.y + delta.y) / GRID_SIZE) * GRID_SIZE)
      
      const activeSize = panelSizes[active.id] || { width: 520, height: 'auto' }
      const activeHeight = typeof activeSize.height === 'number' ? activeSize.height : 280
      
      // Rectangle du widget en mouvement à sa nouvelle position
      const activeRect = {
        left: nextX,
        top: nextY,
        right: nextX + (activeSize.width || 520),
        bottom: nextY + activeHeight,
      }

      // Vérifier les collisions avec les autres widgets visibles
      let hasCollision = false
      for (const otherId of visiblePanelIds) {
        if (otherId === active.id) continue
        
        const otherPos = prev[otherId]
        if (!otherPos) continue
        
        const otherSize = panelSizes[otherId] || { width: 520, height: 'auto' }
        const otherHeight = typeof otherSize.height === 'number' ? otherSize.height : 280
        
        const otherRect = {
          left: otherPos.x,
          top: otherPos.y,
          right: otherPos.x + (otherSize.width || 520),
          bottom: otherPos.y + otherHeight,
        }

        if (checkCollision(activeRect, otherRect)) {
          hasCollision = true
          break
        }
      }

      // Si collision, garder l'ancienne position
      if (hasCollision) {
        return prev
      }

      // Sinon, accepter la nouvelle position
      return {
        ...prev,
        [active.id]: { x: nextX, y: nextY },
      }
    })
  }, [GRID_SIZE, panelSizes, visiblePanelIds, checkCollision])

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
    }).catch(() => {})

    const loadTaches = getTaches(projet.id).then(({ data }) => {
      setTaches(data)
    }).catch(() => notify('Erreur lors du chargement des tâches.', 'error'))

    const loadRisques = getRisques(projet.id).then(({ data }) => {
      setRisques(data)
    }).catch(() => {})

    const loadDepenses = projet.type_projet === 'Client'
      ? getDepenses(projet.id).then(({ data }) => setDepenses(data)).catch(() => {})
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
    jalons.map((j) => ({ ...j, _color: jalonColor(j, taches) })),
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

  const panelLabels = {
    avancement: 'Avancement calendaire',
    taches: 'Réalisation des tâches',
    risques: 'Risques',
    budget: 'Pilotage budgétaire',
    timeline: 'Timeline',
    scurve: 'Courbe en S',
  }

  const panelComponents = {
    avancement: (
      <PanelAvancement
        progressPct={progressPct}
        taskPct={taskPct}
        startDate={startDate}
        endDate={endDate}
        enrichedJalons={enrichedJalons}
      />
    ),
    taches: (
      <PanelTaches
        taskPct={taskPct}
        taches={taches}
      />
    ),
    risques: <PanelRisques risques={risques} />,
    budget: (
      <PanelBudget
        projet={projet}
        depenses={depenses}
        taskPct={taskPct}
        progressPct={progressPct}
      />
    ),
    timeline: (
      <PanelTimeline
        jalons={enrichedJalons}
        startDate={startDate}
        endDate={endDate}
        onSelect={goToTachesByJalon}
      />
    ),
    scurve: (
      <PanelSCurve
        points={points}
        startDate={startDate}
        endDate={endDate}
        projectName={meta.nom}
      />
    ),
  }

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="relative w-full min-h-[1200px] bg-slate-50/50 dark:bg-slate-950/50 rounded-3xl p-4">
          {visiblePanelIds.map((panelId) => (
            <DraggablePanel
              key={panelId}
              id={panelId}
              label={panelLabels[panelId] ?? panelId}
              size={panelSizes[panelId]}
              position={panelPositions[panelId]}
              onResize={updatePanelSize}
            >
              {panelComponents[panelId]}
            </DraggablePanel>
          ))}
        </div>
      </DndContext>

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
