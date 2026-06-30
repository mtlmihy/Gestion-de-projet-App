export default function PanelTaches({ taskPct, taches }) {
  const terminees  = taches.filter((t) => (t.avancement ?? 0) >= 100).length
  const enCours    = taches.filter((t) => (t.avancement ?? 0) > 0 && (t.avancement ?? 0) < 100).length
  const nonDemarr  = taches.filter((t) => (t.avancement ?? 0) === 0).length
  const total      = taches.length
  const critiques  = taches.filter((t) => (t.importance || '').toLowerCase() === 'critique' && (t.avancement ?? 0) < 100).length

  const col = taskPct >= 70 ? '#16a34a' : taskPct >= 30 ? '#f59e0b' : '#ef4444'
  const barBg = taskPct >= 70 ? '#16a34a' : taskPct >= 30 ? '#f59e0b' : '#ef4444'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Réalisation des tâches</span>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-5xl font-black leading-none" style={{ color: col }}>{taskPct}%</span>
        <span className="text-xs text-gray-400 dark:text-slate-500 pb-1">complété (pondéré)</span>
      </div>

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
