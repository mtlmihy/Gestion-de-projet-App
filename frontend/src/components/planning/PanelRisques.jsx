import AlertBanner from './AlertBanner'

export default function PanelRisques({ risques }) {
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4 h-full">
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

      {p1Count > 0 && (
        <AlertBanner icon="🔴" level="error">
          {p1Count} risque{p1Count > 1 ? 's' : ''} critique{p1Count > 1 ? 's' : ''} (P1) actif{p1Count > 1 ? 's' : ''} - action immédiate requise.
        </AlertBanner>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-slate-600 gap-2">
          <span className="text-xs">Aucun risque enregistré</span>
        </div>
      ) : (
        <>
          <div>
            <div className="text-[.62rem] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">Matrice Probabilité × Impact</div>
            <div className="flex gap-2">
              <div className="flex flex-col justify-around w-14 flex-shrink-0">
                {[...PROBA].reverse().map((p) => (
                  <div key={p} className="text-[.6rem] text-gray-400 dark:text-slate-500 text-right leading-none">{p}</div>
                ))}
              </div>
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
                            <span className="text-gray-200 dark:text-slate-700">-</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {IMPACT.map((imp) => (
                    <div key={imp} className="text-[.6rem] text-gray-400 dark:text-slate-500 text-center">{imp}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[.58rem] text-gray-300 dark:text-slate-600 mt-0.5 px-16">
              <span>← Probabilité (axe gauche)</span>
              <span>Impact →</span>
            </div>
          </div>

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
