export const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

export function fmtDate(d) {
  if (!d || isNaN(d)) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtShort(d) {
  if (!d || isNaN(d)) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function fmtCurrency(n, devise = 'CHF') {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: devise, maximumFractionDigits: 0 }).format(n)
}

export const TASK_WEIGHT = (imp) => {
  const v = (imp || '').toLowerCase()
  if (v === 'faible')  return 1
  if (v === 'moyenne') return 2
  if (v === 'élevée' || v === 'elevee') return 3
  if (v === 'critique') return 4
  return 2
}

export function jalonStatus(jalon, tasks) {
  const linked = tasks.filter((t) => (t.jalon ?? '').trim() === jalon.label.trim())
  if (linked.length > 0) {
    const avg = linked.reduce((s, t) => s + (t.avancement ?? 0), 0) / linked.length
    if (avg >= 100) return { badge: '✓ Terminé',      color: '#16a34a' }
    if (avg >= 50)  return { badge: '▶ En cours',     color: '#2563eb' }
    if (avg > 0)    return { badge: '◐ Démarré',      color: '#f59e0b' }
    return                  { badge: '○ Non démarré', color: '#ef4444' }
  }
  const diff = (jalon.date - TODAY) / 86400000
  if (diff < 0)   return { badge: '✓ Passé',    color: '#94a3b8' }
  if (diff <= 30) return { badge: '⚡ Prochain', color: '#f59e0b' }
  return                  { badge: '→ À venir',  color: '#2563eb' }
}

export function jalonAvg(jalon, tasks) {
  const linked = tasks.filter((t) => (t.jalon ?? '').trim() === jalon.label.trim())
  if (!linked.length) return null
  return Math.round(linked.reduce((s, t) => s + (t.avancement ?? 0), 0) / linked.length)
}
