import { TODAY, fmtShort } from '../../utils/planning'

export default function TimelineSVG({ jalons, startDate, endDate, onSelect }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" xmlns="http://www.w3.org/2000/svg">
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
