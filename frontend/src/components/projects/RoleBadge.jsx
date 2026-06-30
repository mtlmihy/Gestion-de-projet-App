export default function RoleBadge({ role }) {
  if (!role) return null
  const colors = {
    'Proprietaire': 'bg-blue-100 text-blue-700',
    'Editeur':      'bg-green-100 text-green-700',
    'Lecteur':      'bg-gray-100 text-gray-500',
    'Client_Limite':'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role] ?? 'bg-gray-100 text-gray-500'}`}>
      {role}
    </span>
  )
}
