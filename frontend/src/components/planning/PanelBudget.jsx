import AlertBanner from './AlertBanner'
import { fmtCurrency } from '../../utils/planning'

export default function PanelBudget({ projet, depenses }) {
  const isClient = projet?.type_projet === 'Client'
  const bac      = Number(projet?.budget_prevu || 0)
  const devise   = projet?.devise || 'CHF'

  if (!isClient || !bac) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col items-center justify-center gap-3 text-center h-full">
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

  const ac = depenses.reduce((s, d) => s + Number(d.montant), 0)
  const reste = bac - ac
  const pctConsomme = bac > 0 ? (ac / bac) * 100 : 0
  const pctConsommeClamped = Math.min(100, pctConsomme)
  const isOverBudget = ac > bac
  const isNearLimit = !isOverBudget && pctConsomme >= 90

  const acColor = isOverBudget
    ? 'text-red-600 dark:text-red-400'
    : isNearLimit
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-gray-700 dark:text-slate-200'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <span className="text-[.68rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Pilotage budgétaire</span>
      </div>

      {isOverBudget && (
        <AlertBanner icon="🔴" level="error">
          Budget dépassé de {fmtCurrency(ac - bac, devise)} ({pctConsomme.toFixed(0)} % consommé).
        </AlertBanner>
      )}
      {isNearLimit && (
        <AlertBanner icon="⚠️" level="warning">
          Budget consommé à {pctConsomme.toFixed(0)} % — surveiller les dépenses restantes.
        </AlertBanner>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl p-3">
          <div className="text-[.6rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Budget</div>
          <div className="text-sm font-bold text-gray-700 dark:text-slate-200">{fmtCurrency(bac, devise)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl p-3">
          <div className="text-[.6rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Dépensé</div>
          <div className={`text-sm font-bold ${acColor}`}>{fmtCurrency(ac, devise)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl p-3">
          <div className="text-[.6rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Restant</div>
          <div className={`text-sm font-bold ${reste < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {fmtCurrency(reste, devise)}
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[.62rem] text-gray-400 dark:text-slate-500 mb-1.5">
          <span>Consommation budget</span>
          <span className="font-semibold">{pctConsomme.toFixed(1)} %</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${pctConsommeClamped}%`,
              background: isOverBudget ? '#ef4444' : isNearLimit ? '#f59e0b' : '#22c55e',
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
