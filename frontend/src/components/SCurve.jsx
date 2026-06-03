import React, { useCallback } from 'react'

function weightOf(importance) {
  switch ((importance || '').toLowerCase()) {
    case 'faible': return 1
    case 'moyenne': return 2
    case 'élevée': case 'elevee': return 3
    case 'critique': return 4
    default: return 2
  }
}

export default function SCurve({ points = [], startDate, endDate, projectName = '' }) {
  const W = 900, H = 260, PL = 60, PR = 60, PT = 20, PB = 36
  const TW = W - PL - PR

  if (!points.length) return null

  const maxPlanned = Math.max(...points.map((p) => p.planned || 0), 1)
  const maxY = Math.max(maxPlanned, 1)

  const totalPlanned = points[points.length - 1].planned || 0
  const latestCompleted = points[points.length - 1].completed || 0
  const ecart = latestCompleted - totalPlanned
  const rendement = totalPlanned > 0 ? (latestCompleted / totalPlanned) * 100 : null

  const exportCSV = useCallback(() => {
    const header = 'Date,Prévu,Réalisé\n'
    const rows = points.map((p) =>
      `${p.date.toLocaleDateString('fr-CH')},${p.planned},${p.completed}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `courbe-s${projectName ? '-' + projectName : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [points, projectName])

  function xOf(d) { return PL + (d - startDate) / (endDate - startDate) * TW }
  function yOf(v) { return PT + (H - PT - PB) * (1 - (v / maxY)) }

  const plannedPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.date)} ${yOf(p.planned)}`).join(' ')
  const completedPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.date)} ${yOf(p.completed)}`).join(' ')

  const areaPlanned = `${plannedPath} L ${xOf(points[points.length - 1].date)} ${yOf(0)} L ${xOf(points[0].date)} ${yOf(0)} Z`
  const areaCompleted = `${completedPath} L ${xOf(points[points.length - 1].date)} ${yOf(0)} L ${xOf(points[0].date)} ${yOf(0)} Z`

  const todayX = xOf(new Date())

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-6 py-5 overflow-x-auto scrollbar-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Courbe S — Charge prévue vs restante</div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-1 transition-colors"
          title="Exporter les données CSV"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
        {/* grid lines */}
        {[0,0.25,0.5,0.75,1].map((t) => (
          <line key={t} x1={PL} x2={W-PR} y1={yOf(maxY * t)} y2={yOf(maxY * t)} stroke="#eef2ff" strokeWidth="1" />
        ))}

        {/* areas */}
        <path d={areaPlanned} fill="url(#gradPlanned)" opacity="0.35" />
        <path d={areaCompleted} fill="url(#gradDone)" opacity="0.45" />

        <defs>
          <linearGradient id="gradPlanned" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="gradDone" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* lines */}
        <path d={plannedPath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={completedPath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* x-axis dates */}
        {points.filter((_,i) => i % Math.max(1, Math.floor(points.length/8)) === 0).map((p, i) => (
          <g key={i}>
            <line x1={xOf(p.date)} x2={xOf(p.date)} y1={H-PB} y2={H-PB+6} stroke="#e6e9ef" />
            <text x={xOf(p.date)} y={H-PB+20} fontSize="10" textAnchor="middle" fill="#94a3b8">{p.date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</text>
          </g>
        ))}

        {/* today line */}
        <line x1={todayX} x2={todayX} y1={PT} y2={H-PB} stroke="#ef4444" strokeDasharray="4,3" />

        {/* small legend */}
        <rect x={W-PR-180} y={PT} width="160" height="44" rx="6" fill="#fff" opacity="0.9" />
        <g transform={`translate(${W-PR-170}, ${PT+8})`}>
          <rect x={0} y={0} width={10} height={6} fill="#2563eb" />
          <text x={16} y={6} fontSize="11" fill="#111827">Prévu</text>
          <rect x={84} y={0} width={10} height={6} fill="#16a34a" />
          <text x={100} y={6} fontSize="11" fill="#111827">Réalisé</text>
        </g>
      </svg>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-slate-400">
        <div><strong>Total prévu :</strong> {totalPlanned}</div>
        <div><strong>Réalisé :</strong> {Math.round(latestCompleted)}</div>
        <div><strong>Restant :</strong> {Math.round(Math.max(0, totalPlanned - latestCompleted))}</div>
        <div className={ecart >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          <strong>Écart :</strong> {ecart >= 0 ? '+' : ''}{Math.round(ecart)}
        </div>
        {rendement !== null && (
          <div className={rendement >= 100 ? 'text-green-600 dark:text-green-400' : rendement >= 80 ? 'text-orange-500 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}>
            <strong>Rendement :</strong> {rendement.toFixed(1)} %
          </div>
        )}
      </div>
    </div>
  )
}
