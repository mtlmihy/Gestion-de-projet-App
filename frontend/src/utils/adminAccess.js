export const inp = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
export const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

export const MIN_PASSWORD_LENGTH = 12

export function getPasswordPolicyError(password) {
  if (!password || typeof password !== 'string') return 'Le mot de passe est requis.'
  if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule.'
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule.'
  if (!/\d/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial.'
  return null
}

export const ROLE_LABELS = {
  Proprietaire: 'Propriétaire',
  Editeur: 'Éditeur',
  Lecteur: 'Lecteur',
  Client_Limite: 'Client',
}
export const ROLE_BADGES = {
  Proprietaire: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Editeur:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Lecteur:      'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  Client_Limite:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

// Seuil au-delà duquel un compte est considéré comme dormant.
export const INACTIVITY_DAYS = 90

export function daysSince(dateStr) {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86_400_000)
}

export function formatLastLogin(dateStr) {
  if (!dateStr) return 'Jamais'
  const d = daysSince(dateStr)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Hier'
  if (d < 30) return `Il y a ${d} j`
  if (d < 365) return `Il y a ${Math.floor(d / 30)} mois`
  return `Il y a ${Math.floor(d / 365)} an${Math.floor(d / 365) > 1 ? 's' : ''}`
}
