export const PROJECT_NAV_LINKS = [
  { to: '/cdc', label: 'Cahier des Charges', page: 'cdc', title: 'Cahier des charges' },
  { to: '/planning', label: 'Planning', page: 'planning', title: 'Planning' },
  { to: '/copil', label: 'COPIL', page: 'copil', title: 'COPIL' },
  { to: '/risques', label: 'Risques', page: 'risques', title: 'Risques' },
  { to: '/taches', label: 'Tâches', page: 'taches', title: 'Tâches' },
  { to: '/raci', label: 'RACI', page: 'raci', title: 'Matrice RACI' },
  { to: '/equipe', label: 'Équipe', page: 'equipe', title: 'Équipe' },
  { to: '/aide', label: 'Aide', page: 'aide', title: 'Aide' },
  { to: '/budget', label: 'Budget', page: 'budget', title: 'Budget', onlyClient: true },
]

export function getOrderedVisibleProjectNavLinks({ projet, canAccess, canAccessPage }) {
  const filtered = PROJECT_NAV_LINKS.filter(({ page, onlyClient }) => (
    canAccess(page) && canAccessPage(page) && (!onlyClient || projet?.type_projet === 'Client')
  ))

  const defaultOrder = PROJECT_NAV_LINKS.map((item) => item.page)
  const configuredOrder = Array.isArray(projet?.pages_ordre) && projet.pages_ordre.length
    ? projet.pages_ordre
    : defaultOrder

  const configuredRank = new Map(configuredOrder.map((page, index) => [page, index]))
  const fallbackRank = new Map(defaultOrder.map((page, index) => [page, index]))

  return [...filtered].sort((a, b) => {
    const rankA = configuredRank.has(a.page)
      ? configuredRank.get(a.page)
      : 10000 + (fallbackRank.get(a.page) ?? 0)
    const rankB = configuredRank.has(b.page)
      ? configuredRank.get(b.page)
      : 10000 + (fallbackRank.get(b.page) ?? 0)
    return rankA - rankB
  })
}
