import AlertBanner from './AlertBanner'
import { fmtCurrency } from '../../utils/planning'

export default function PanelBudget({ projet, depenses, taskPct, progressPct }) {
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

      <div className="grid grid-cols-2 gap-3">
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
