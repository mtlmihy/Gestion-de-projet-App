// Badges colorés — utilisés dans tout l'app
const CONFIG = {
  probabilite: {
    Faible:  'bg-green-100 text-green-800',
    Moyenne: 'bg-orange-100 text-orange-800',
    Élevée:  'bg-red-100 text-red-800',
  },
  impact: {
    Faible: 'bg-green-100 text-green-800',
    Moyen:  'bg-orange-100 text-orange-800',
    Élevé:  'bg-red-100 text-red-800',
  },
  statut: {
    Ouvert:    'bg-red-100 text-red-800',
    'En cours':'bg-orange-100 text-orange-800',
    Fermé:     'bg-green-100 text-green-800',
  },
  importance: {
    Faible:   'bg-green-100 text-green-800',
    Moyenne:  'bg-orange-100 text-orange-800',
    Élevée:   'bg-red-100 text-red-800',
    Critique: 'bg-purple-100 text-purple-800',
  },
  categorie: {
    Opérations: 'bg-blue-100 text-blue-800',
    Budget:     'bg-orange-100 text-orange-800',
    Planning:   'bg-purple-100 text-purple-800',
    Technologie:'bg-gray-100 text-gray-700',
    Sécurité:   'bg-red-100 text-red-800',
  },
}

export default function Badge({ type, value }) {
  const cls = CONFIG[type]?.[value] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {value}
    </span>
  )
}

export function PrioriteBadge({ value }) {
  // Convention ITIL : P1 = critique (rouge), P3 = faible (vert)
  const colors = { 1: 'bg-red-500', 2: 'bg-yellow-500', 3: 'bg-green-500' }
  const v = Number(value)
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-sm font-bold ${colors[v] ?? 'bg-gray-400'}`}>
      {v}
    </span>
  )
}
