import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import NavBar from './NavBar'
import { useProject } from '../context/ProjectContext'
import { useAuth } from '../context/AuthContext'
import { PROJECT_NAV_LINKS, getOrderedVisibleProjectNavLinks } from '../config/navigation'

const APP_NAME = 'QimProject'
const PAGE_TITLES = {
  '/admin':    'Administration',
  '/projets':  'Projets',
  ...Object.fromEntries(PROJECT_NAV_LINKS.map((item) => [item.to, item.title])),
}

const SWIPE_THRESHOLD = 60
const SWIPE_HORIZONTAL_RATIO = 1.2

function isInteractiveElement(target) {
  if (!target || !(target instanceof Element)) return false
  return !!target.closest('input, textarea, select, button, [contenteditable="true"]')
}

export default function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { projet, canAccessPage } = useProject()
  const { canAccess } = useAuth()
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const touchEndX = useRef(null)
  const touchEndY = useRef(null)

  const orderedVisiblePages = useMemo(
    () => getOrderedVisibleProjectNavLinks({ projet, canAccess, canAccessPage }),
    [projet, canAccess, canAccessPage]
  )

  const currentPath = `/${pathname.split('/')[1] || ''}`

  const currentIndex = useMemo(
    () => orderedVisiblePages.findIndex(({ to }) => to === currentPath),
    [orderedVisiblePages, currentPath]
  )

  const previousPage = currentIndex > 0 ? orderedVisiblePages[currentIndex - 1] : null
  const nextPage = currentIndex >= 0 && currentIndex < orderedVisiblePages.length - 1
    ? orderedVisiblePages[currentIndex + 1]
    : null

  const goToSiblingPage = useCallback((direction) => {
    const target = direction === 'next' ? nextPage : previousPage
    if (!target) return
    navigate(target.to, { replace: true })
  }, [navigate, nextPage, previousPage])

  const isSwipeEnabled = currentIndex >= 0 && !pathname.startsWith('/admin')

  const handleTouchStart = useCallback((e) => {
    if (!isSwipeEnabled) return
    if (isInteractiveElement(e.target)) return
    touchStartX.current = e.touches[0]?.clientX ?? null
    touchStartY.current = e.touches[0]?.clientY ?? null
    touchEndX.current = touchStartX.current
    touchEndY.current = touchStartY.current
  }, [isSwipeEnabled])

  const handleTouchMove = useCallback((e) => {
    if (!isSwipeEnabled) return
    if (touchStartX.current == null || touchStartY.current == null) return
    touchEndX.current = e.touches[0]?.clientX ?? touchEndX.current
    touchEndY.current = e.touches[0]?.clientY ?? touchEndY.current
  }, [isSwipeEnabled])

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current == null || touchStartY.current == null) return

    const dx = (touchEndX.current ?? touchStartX.current) - touchStartX.current
    const dy = (touchEndY.current ?? touchStartY.current) - touchStartY.current
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    const isHorizontalSwipe = absDx >= SWIPE_THRESHOLD && absDx > absDy * SWIPE_HORIZONTAL_RATIO
    if (isHorizontalSwipe) {
      if (dx < 0) goToSiblingPage('next')
      else goToSiblingPage('prev')
    }

    touchStartX.current = null
    touchStartY.current = null
    touchEndX.current = null
    touchEndY.current = null
  }, [goToSiblingPage])

  useEffect(() => {
    const match = Object.keys(PAGE_TITLES).find((p) => pathname.startsWith(p))
    const page = match ? PAGE_TITLES[match] : null
    const projectName = projet?.nom
    document.title = [page, projectName, APP_NAME].filter(Boolean).join(' · ')
  }, [pathname, projet?.nom])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <NavBar />
      <main
        className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {currentIndex >= 0 && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => goToSiblingPage('prev')}
              disabled={!previousPage}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span aria-hidden="true">←</span>
              <span>Page précédente</span>
            </button>
            <button
              type="button"
              onClick={() => goToSiblingPage('next')}
              disabled={!nextPage}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Page suivante</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
