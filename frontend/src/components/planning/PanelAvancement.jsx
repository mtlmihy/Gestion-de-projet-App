import AlertBanner from './AlertBanner'
import { TODAY, fmtShort } from '../../utils/planning'

export default function PanelAvancement({ progressPct, taskPct, startDate, endDate, enrichedJalons }) {
  const daysLeft = Math.max(0, Math.round((endDate - TODAY) / 86400000))
  const daysPast = Math.max(0, Math.round((TODAY - startDate) / 86400000))
  const nextJalon = enrichedJalons.find((j) => j.date > TODAY)
  const retardAlert = progressPct > (taskPct ?? progressPct) + 15

  const col = progressPct >= 100 ? '#16a34a' : '#2563eb'
  const barBg = progressPct >= 100
    ? '#16a34a'
    : 'linear-gradient(90deg, #2563eb, #60a5fa)'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Avancement calendaire</span>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-5xl font-black leading-none" style={{ color: col }}>{progressPct}%</span>
        <span className="text-xs text-gray-400 dark:text-slate-500 pb-1">du projet écoulé</span>
      </div>

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

      {retardAlert && (
        <AlertBanner icon="⚠️" level="warning">
          Retard détecté - le calendrier avance plus vite que la réalisation des tâches ({progressPct}% vs {taskPct}%).
        </AlertBanner>
      )}

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
