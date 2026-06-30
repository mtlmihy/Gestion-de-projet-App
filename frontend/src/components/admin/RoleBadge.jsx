import { ROLE_LABELS, ROLE_BADGES } from '../../utils/adminAccess'

export default function RoleBadge({ role }) {
  const cls = ROLE_BADGES[role] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}
