import { STATUT_STYLE } from '../../utils/projectsShared'

export default function StatutBadge({ statut }) {
  const s = STATUT_STYLE[statut] ?? STATUT_STYLE['Brouillon']
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {statut}
    </span>
  )
}
