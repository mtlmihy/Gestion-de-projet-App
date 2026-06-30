// ── Épinglage (persistance locale par utilisateur) ───────────────────────────
export const pinKey = (userId) => `epingles:projets:${userId ?? 'guest'}`
export const loadPins = (userId) => {
  try { return new Set(JSON.parse(localStorage.getItem(pinKey(userId)) || '[]')) }
  catch { return new Set() }
}
export const savePins = (userId, set) => {
  try { localStorage.setItem(pinKey(userId), JSON.stringify([...set])) } catch { /* quota / privée */ }
}
export const toPinnedSet = (value) => new Set(Array.isArray(value) ? value.filter(Boolean) : [])

// ── Couleur par statut ────────────────────────────────────────────────────────
export const STATUT_STYLE = {
  'En cours':    { dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50'  },
  'Brouillon':   { dot: 'bg-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50'   },
  'En pause':    { dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  'Terminé':     { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
  'Annulé':      { dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50'    },
}
export const STATUTS = ['Brouillon', 'En cours', 'En pause']

export const inp = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
export const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

export const ROLES = ['Proprietaire', 'Editeur', 'Lecteur', 'Client_Limite']
export const ROLES_SANS_PROPRIO = ['Editeur', 'Lecteur', 'Client_Limite']
export const ROLE_LABELS = {
  'Proprietaire':  'Propriétaire',
  'Editeur':       'Éditeur',
  'Lecteur':       'Lecteur',
  'Client_Limite': 'Client',
}
export const PAGES_DISPONIBLES = [
  { key: 'cdc',      label: "Cahier des charges" },
  { key: 'risques',  label: "Risques" },
  { key: 'taches',   label: "Tâches" },
  { key: 'raci',     label: "RACI" },
  { key: 'planning', label: "Planning" },
  { key: 'copil',    label: "COPIL" },
  { key: 'equipe',   label: "Équipe" },
  { key: 'aide',     label: "Aide" },
  { key: 'budget',   label: "Budget", onlyClient: true },
]

export function mergeProjetForUi(prev, patch) {
  if (!prev) return patch
  return {
    ...prev,
    ...patch,
    // Les endpoints PATCH projet ne renvoient pas toujours ces champs métier.
    mon_role: patch?.mon_role ?? prev.mon_role,
    mes_pages: patch?.mes_pages ?? prev.mes_pages,
  }
}
