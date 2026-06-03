import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCdc } from '../api/cdc'
import { getTaches } from '../api/taches'
import { getRisques } from '../api/risques'
import { getDepenses } from '../api/budget'
import { useProject } from '../context/ProjectContext'
import SCurve from '../components/SCurve'

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
  if (v === 'faible') return 1
  if (v === 'moyenne') return 2
  if (v === 'élevée' || v === 'elevee') return 3
  if (v === 'critique') return 4
  return 2
}

// Couleur d'un jalon selon avancement tâches associées, ou date
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
      <g
        key={i}
        onClick={onSelect ? () => onSelect(j.label) : undefined}
        style={onSelect ? { cursor: 'pointer' } : undefined}
      >
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
      <rect x={PL} y={BAR_Y} width={pastW} height={BAR_H} rx="5" fill="#94a3b8" />
      <rect x={todayX} y={BAR_Y} width={futW} height={BAR_H} rx="5" fill="#2563eb" opacity=".25" />
      {milestones}
      <line x1={todayX} y1={BAR_Y - 22} x2={todayX} y2={BAR_Y + BAR_H + 44} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" />
      <rect x={todayX - 16} y={BAR_Y + BAR_H + 44} width="32" height="14" rx="4" fill="#ef4444" />
      <text x={todayX} y={BAR_Y + BAR_H + 54} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">Auj.</text>
    </svg>
  )
}

// ── KPI cards de pilotage ─────────────────────────────────────────────────────
function PilotageKpis({ progressPct, taskPct, cpi, critiques }) {
  const cpiColor = cpi === null
    ? 'text-gray-400'
    : cpi >= 0.95 ? 'text-green-600 dark:text-green-400'
    : cpi >= 0.80 ? 'text-amber-500 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'

  const cpiLabel = cpi === null ? '—'
    : cpi >= 0.95 ? 'Sous budget'
    : cpi >= 0.80 ? 'Attention'
    : 'Dépassement'

  const taskColor = taskPct >= 70 ? 'text-green-600 dark:text-green-400'
    : taskPct >= 30 ? 'text-amber-500 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'

  const critColor = critiques > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'

  const cards = [
    {
      label: 'Avancement calendaire',
      value: `${progressPct} %`,
      sub: 'Progression temporelle',
      valueClass: 'text-blue-600 dark:text-blue-400',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Réalisation tâches',
      value: `${taskPct} %`,
      sub: 'Moyenne pondérée',
      valueClass: taskColor,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      iconBg: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    },
    {
      label: 'CPI (Coût)',
      value: cpi === null ? '—' : cpi.toFixed(2),
      sub: cpiLabel,
      valueClass: cpiColor,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      iconBg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Risques critiques',
      value: critiques,
      sub: critiques === 0 ? 'Aucun risque P1' : `${critiques} risque${critiques > 1 ? 's' : ''} P1`,
      valueClass: critColor,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      iconBg: critiques > 0
        ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
        : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-5 py-4 flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
            {c.icon}
          </div>
          <div className="min-w-0">
            <div className="text-[.65rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-0.5">{c.label}</div>
            <div className={`text-2xl font-bold leading-tight ${c.valueClass}`}>{c.value}</div>
            <div className="text-[.68rem] text-gray-400 dark:text-slate-500 mt-0.5">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Matrice des risques 3×3 ───────────────────────────────────────────────────
function RiskMatrixPanel({ risques }) {
  const PROBA = ['Faible', 'Moyenne', 'Élevée']
  const IMPACT = ['Faible', 'Moyen', 'Élevé']

  // score de priorité : probScore × impactScore
  const probScore  = { Faible: 1, Moyenne: 2, 'Élevée': 3 }
  const impactScore = { Faible: 1, Moyen: 2, 'Élevé': 3 }

  // Couleur de cellule selon score (hors risques fermés)
  function cellColor(prob, impact) {
    const s = probScore[prob] * impactScore[impact]
    if (s >= 6) return { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' }  // rouge P1
    if (s >= 3) return { bg: '#fff7ed', border: '#fdba74', text: '#ea580c' }  // orange P2
    return { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' }              // vert P3
  }

  function countOpen(prob, impact) {
    return risques.filter(
      (r) => r.probabilite === prob && r.impact === impact && r.statut !== 'Fermé'
    ).length
  }
  function countAll(prob, impact) {
    return risques.filter((r) => r.probabilite === prob && r.impact === impact).length
  }

  const total    = risques.length
  const ouverts  = risques.filter((r) => r.statut === 'Ouvert').length
  const enCours  = risques.filter((r) => r.statut === 'En cours').length
  const fermes   = risques.filter((r) => r.statut === 'Fermé').length

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-5">
      <div className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-4">Matrice des risques</div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-36 text-gray-300 dark:text-slate-600 gap-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span className="text-xs">Aucun risque enregistré</span>
        </div>
      ) : (
        <>
          {/* Matrice */}
          <div className="flex gap-2 items-end mb-3">
            {/* Légende axe Y */}
            <div className="flex flex-col justify-between h-[112px] pb-0">
              {[...PROBA].reverse().map((p) => (
                <div key={p} className="text-[.62rem] text-gray-400 dark:text-slate-500 text-right w-14 leading-none py-1">{p}</div>
              ))}
            </div>

            {/* Grille */}
            <div className="flex-1">
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {[...PROBA].reverse().map((prob) =>
                  IMPACT.map((impact) => {
                    const open = countOpen(prob, impact)
                    const all  = countAll(prob, impact)
                    const col  = cellColor(prob, impact)
                    return (
                      <div
                        key={`${prob}-${impact}`}
                        className="rounded-lg flex flex-col items-center justify-center h-9 border"
                        style={{ background: col.bg, borderColor: col.border }}
                        title={`${prob} × ${impact} : ${open} risque${open > 1 ? 's' : ''} actif${open > 1 ? 's' : ''}${all > open ? `, ${all - open} fermé${all - open > 1 ? 's' : ''}` : ''}`}
                      >
                        {all > 0 ? (
                          <span className="text-sm font-bold" style={{ color: col.text }}>
                            {open > 0 ? open : <span className="text-gray-300 dark:text-slate-600 font-normal text-xs">{all}✓</span>}
                          </span>
                        ) : (
                          <span className="text-gray-200 dark:text-slate-700 text-xs">·</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              {/* Légende axe X */}
              <div className="grid mt-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {IMPACT.map((imp) => (
                  <div key={imp} className="text-[.62rem] text-gray-400 dark:text-slate-500 text-center">{imp}</div>
                ))}
              </div>
              <div className="text-[.6rem] text-gray-300 dark:text-slate-600 text-center mt-0.5">Impact →</div>
            </div>
          </div>

          {/* Légende priorités */}
          <div className="flex gap-3 mb-3">
            {[
              { label: 'P1 critique', bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
              { label: 'P2 élevé',   bg: '#fff7ed', border: '#fdba74', text: '#ea580c' },
              { label: 'P3 faible',  bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border" style={{ background: l.bg, borderColor: l.border }} />
                <span className="text-[.62rem] font-medium" style={{ color: l.text }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Barre de répartition statuts */}
          {total > 0 && (
            <div>
              <div className="text-[.62rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1.5">Répartition par statut</div>
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {ouverts > 0 && <div style={{ width: `${ouverts / total * 100}%`, background: '#ef4444' }} title={`Ouvert : ${ouverts}`} />}
                {enCours > 0 && <div style={{ width: `${enCours / total * 100}%`, background: '#f59e0b' }} title={`En cours : ${enCours}`} />}
                {fermes  > 0 && <div style={{ width: `${fermes  / total * 100}%`, background: '#22c55e' }} title={`Fermé : ${fermes}`} />}
              </div>
              <div className="flex gap-3 mt-1.5">
                {[
                  { label: `Ouvert (${ouverts})`,    color: '#ef4444' },
                  { label: `En cours (${enCours})`,  color: '#f59e0b' },
                  { label: `Fermé (${fermes})`,      color: '#22c55e' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[.62rem] text-gray-500 dark:text-slate-400">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Panneau CPI / Budget ──────────────────────────────────────────────────────
function CpiPanel({ projet, depenses, taskPct, progressPct }) {
  const isClient = projet?.type_projet === 'Client'
  const bac      = Number(projet?.budget_prevu || 0)
  const devise   = projet?.devise || 'CHF'

  if (!isClient || !bac) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-5 flex flex-col items-center justify-center gap-2 text-center">
        <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Suivi budgétaire non activé</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">Disponible pour les projets de type Client avec budget défini.</p>
      </div>
    )
  }

  const ac  = depenses.reduce((s, d) => s + Number(d.montant), 0)
  const ev  = bac * (taskPct / 100)
  const pv  = bac * (progressPct / 100)
  const cpi = ac > 0 ? ev / ac : null
  const spi = pv > 0 ? ev / pv : null
  const pctConsomme = Math.min(100, bac > 0 ? (ac / bac) * 100 : 0)
  const ecart = ev - ac

  const cpiColor = cpi === null ? '#94a3b8'
    : cpi >= 0.95 ? '#16a34a'
    : cpi >= 0.80 ? '#f59e0b'
    : '#ef4444'

  const cpiLabel = cpi === null ? 'N/A'
    : cpi >= 0.95 ? 'Sous budget'
    : cpi >= 0.80 ? 'Attention'
    : 'Dépassement'

  const spiLabel = spi === null ? 'N/A'
    : spi >= 0.95 ? 'Dans les temps'
    : spi >= 0.80 ? 'Léger retard'
    : 'En retard'

  const spiColor = spi === null ? '#94a3b8'
    : spi >= 0.95 ? '#16a34a'
    : spi >= 0.80 ? '#f59e0b'
    : '#ef4444'

  // Jauge SVG circulaire pour le CPI (normalisée entre 0 et 2, 1 = pile)
  const gaugeVal = cpi === null ? 0.5 : Math.min(2, Math.max(0, cpi)) / 2  // 0–1 pour le dessin
  const R = 40, CX = 60, CY = 56
  const startAngle = Math.PI          // 180°
  const endAngle   = 2 * Math.PI      // 360°
  const arcLen     = endAngle - startAngle
  const fillAngle  = startAngle + gaugeVal * arcLen
  function polarToCartesian(angle) {
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) }
  }
  const p0 = polarToCartesian(startAngle)
  const p1 = polarToCartesian(fillAngle)
  const largeArc = gaugeVal > 0.5 ? 1 : 0
  const trackPath = `M ${polarToCartesian(startAngle).x} ${polarToCartesian(startAngle).y} A ${R} ${R} 0 1 1 ${polarToCartesian(endAngle - 0.001).x} ${polarToCartesian(endAngle - 0.001).y}`
  const fillPath  = gaugeVal > 0
    ? `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} 1 ${p1.x} ${p1.y}`
    : ''

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-5">
      <div className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-4">Pilotage budgétaire</div>

      {/* Jauges CPI + SPI */}
      <div className="flex gap-4 items-start mb-5">
        {/* CPI gauge */}
        <div className="flex flex-col items-center">
          <svg width="120" height="68" viewBox="0 0 120 68">
            <path d={trackPath} fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
            {fillPath && <path d={fillPath} fill="none" stroke={cpiColor} strokeWidth="10" strokeLinecap="round" />}
            <text x={CX} y={CY - 6} textAnchor="middle" fontSize="16" fontWeight="700" fill={cpiColor}>
              {cpi === null ? '—' : cpi.toFixed(2)}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#94a3b8">CPI</text>
          </svg>
          <span className="text-[.68rem] font-semibold mt-0.5" style={{ color: cpiColor }}>{cpiLabel}</span>
        </div>

        {/* SPI gauge */}
        <div className="flex flex-col items-center">
          <svg width="120" height="68" viewBox="0 0 120 68">
            {(() => {
              const sv = spi === null ? 0.5 : Math.min(2, Math.max(0, spi)) / 2
              const sa = startAngle
              const fa = startAngle + sv * arcLen
              const sp0 = polarToCartesian(sa)
              const sp1 = polarToCartesian(fa)
              const sla = sv > 0.5 ? 1 : 0
              const sFill = sv > 0
                ? `M ${sp0.x} ${sp0.y} A ${R} ${R} 0 ${sla} 1 ${sp1.x} ${sp1.y}`
                : ''
              return (
                <>
                  <path d={trackPath} fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
                  {sFill && <path d={sFill} fill="none" stroke={spiColor} strokeWidth="10" strokeLinecap="round" />}
                  <text x={CX} y={CY - 6} textAnchor="middle" fontSize="16" fontWeight="700" fill={spiColor}>
                    {spi === null ? '—' : spi.toFixed(2)}
                  </text>
                  <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#94a3b8">SPI</text>
                </>
              )
            })()}
          </svg>
          <span className="text-[.68rem] font-semibold mt-0.5" style={{ color: spiColor }}>{spiLabel}</span>
        </div>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-xs">
        {[
          { label: 'Budget (BAC)',     value: fmtCurrency(bac, devise),           color: 'text-gray-700 dark:text-slate-200' },
          { label: 'Coût réel (AC)',   value: fmtCurrency(ac,  devise),           color: 'text-gray-700 dark:text-slate-200' },
          { label: 'Valeur acquise (EV)', value: fmtCurrency(ev, devise),         color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Écart budget',     value: fmtCurrency(ecart, devise),         color: ecart >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-[.62rem] text-gray-400 dark:text-slate-500 uppercase tracking-wide">{m.label}</div>
            <div className={`font-semibold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Barre de consommation */}
      <div>
        <div className="flex justify-between text-[.62rem] text-gray-400 dark:text-slate-500 mb-1">
          <span>Consommation budget</span>
          <span>{pctConsomme.toFixed(1)} %</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
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

  // Progression temporelle
  const progressPct = useMemo(() => {
    const total = Math.max(1, endDate - startDate)
    const done  = Math.max(0, Math.min(total, TODAY - startDate))
    return Math.round(done / total * 100)
  }, [startDate, endDate])

  // Réalisation tâches (moyenne pondérée)
  const taskPct = useMemo(() => {
    if (!taches.length) return 0
    const totalW = taches.reduce((s, t) => s + TASK_WEIGHT(t.importance), 0)
    if (!totalW) return 0
    const done = taches.reduce((s, t) => s + TASK_WEIGHT(t.importance) * (t.avancement ?? 0), 0)
    return Math.round(done / totalW)
  }, [taches])

  // CPI (pour les KPI cards)
  const cpiValue = useMemo(() => {
    if (projet?.type_projet !== 'Client' || !Number(projet?.budget_prevu)) return null
    const bac = Number(projet.budget_prevu)
    const ac  = depenses.reduce((s, d) => s + Number(d.montant), 0)
    if (ac === 0) return null
    const ev  = bac * (taskPct / 100)
    return ev / ac
  }, [projet, depenses, taskPct])

  // Nombre de risques critiques P1
  const critiquesCount = useMemo(() =>
    risques.filter((r) => r.priorite === 1 && r.statut !== 'Fermé').length,
    [risques]
  )

  const totalMonths = Math.round(Math.max(0, endDate - startDate) / 86400000 / 30)
  const durationStr = totalMonths >= 12
    ? `${Math.floor(totalMonths / 12)} an${Math.floor(totalMonths / 12) > 1 ? 's' : ''}${totalMonths % 12 ? ` ${totalMonths % 12} mois` : ''}`
    : `${totalMonths} mois`

  // Points courbe S
  const points = useMemo(() => {
    if (!taches?.length) return []
    const days = Math.max(1, Math.round((endDate - startDate) / 86400000))
    const step = days > 120 ? Math.ceil(days / 120) : 1
    const taskInfos = taches.map((tt) => {
      let d = null
      if (tt.echeance) {
        const pd = new Date(tt.echeance)
        if (!isNaN(pd)) d = pd
      }
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
        const frac      = Math.max(0, Math.min(1, elapsed / totalSpan))
        completed += ti.w * (ti.av / 100) * frac
      }
      out.push({ date: new Date(d), planned, completed })
    }
    const totalPlanned = taskInfos.reduce((s, t) => s + t.w, 0)
    const totalDone    = taskInfos.reduce((s, t) => s + t.w * (t.av / 100), 0)
    if (out.length) {
      out[out.length - 1].planned   = totalPlanned
      out[out.length - 1].completed = totalDone
    }
    return out
  }, [taches, enrichedJalons, startDate, endDate])

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
            ['Calendaire', `${progressPct} %`],
            ['Tâches',     `${taskPct} %`],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-gray-500 text-[.65rem] font-bold uppercase tracking-wider">{label}</div>
              <div className="text-gray-300 text-xs font-semibold mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI de pilotage ────────────────────────────────────────────── */}
      <PilotageKpis
        progressPct={progressPct}
        taskPct={taskPct}
        cpi={cpiValue}
        critiques={critiquesCount}
      />

      {/* ── Matrice risques + CPI ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RiskMatrixPanel risques={risques} />
        <CpiPanel
          projet={projet}
          depenses={depenses}
          taskPct={taskPct}
          progressPct={progressPct}
        />
      </div>

      {/* ── Barre de progression globale ───────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Avancement calendaire</span>
          <span className="text-sm font-bold text-blue-600">{progressPct} %</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: progressPct >= 100 ? '#16a34a' : 'linear-gradient(90deg, #2563eb, #3b82f6)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[.68rem] text-gray-400 dark:text-slate-500">
          <span>{fmtDate(startDate)}</span>
          <span className="text-red-500 font-semibold">Aujourd'hui : {fmtDate(TODAY)}</span>
          <span>{fmtDate(endDate)}</span>
        </div>
      </div>

      {/* ── Courbe S ───────────────────────────────────────────────────── */}
      {points && points.length > 1 && (
        <div className="mt-2">
          <SCurve points={points} startDate={startDate} endDate={endDate} />
        </div>
      )}

      {/* ── Timeline SVG ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-5 overflow-x-auto scrollbar-hidden">
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
