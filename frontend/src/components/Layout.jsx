import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import NavBar from './NavBar'
import { useProject } from '../context/ProjectContext'

const APP_NAME = 'QimProject'
const PAGE_TITLES = {
  '/cdc':      'Cahier des charges',
  '/planning': 'Planning',
  '/risques':  'Risques',
  '/taches':   'Tâches',
  '/equipe':   'Équipe',
  '/aide':     'Aide',
  '/admin':    'Administration',
  '/projets':  'Projets',
}

export default function Layout() {
  const { pathname } = useLocation()
  const { projet } = useProject()

  useEffect(() => {
    const match = Object.keys(PAGE_TITLES).find((p) => pathname.startsWith(p))
    const page = match ? PAGE_TITLES[match] : null
    const projectName = projet?.nom
    document.title = [page, projectName, APP_NAME].filter(Boolean).join(' · ')
  }, [pathname, projet?.nom])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <NavBar />
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
