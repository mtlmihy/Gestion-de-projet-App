import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import ThemeToggleButton from './ThemeToggleButton'
import Logo from './Logo'

const LINKS = [
  { to: '/cdc',      label: 'Cahier des Charges', page: 'cdc'      },
  { to: '/planning', label: 'Planning',            page: 'planning' },
  { to: '/risques',  label: 'Risques',             page: 'risques'  },
  { to: '/taches',   label: 'Tâches',              page: 'taches'   },
  { to: '/equipe',   label: 'Équipe',              page: 'equipe'   },
  { to: '/aide',     label: 'Aide',                page: 'aide'     },
]

function UserAvatar({ user }) {
  if (!user) return null
  const initials = (user.nom ?? user.email)
    .split(' ').map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')
  return (
    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">
      {initials}
    </span>
  )
}

export default function NavBar() {
  const { logout, user, isAdmin, canAccess } = useAuth()
  const { projet, clearProjet, canAccessPage } = useProject()
  const navigate = useNavigate()

  const handleLogout = async () => {
    clearProjet()
    await logout()
    navigate('/login', { replace: true })
  }

  const handleChangeProjet = () => {
    clearProjet()
    navigate('/projets', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 shadow-sm transition-colors">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
        {/* Logo + projet actif */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 font-bold text-blue-600 text-sm">
            <Logo className="w-6 h-6" />
          </span>
          {projet && (
            <>
              <span className="text-gray-200">/</span>
              <button
                onClick={handleChangeProjet}
                className="flex items-center gap-1.5 max-w-[160px] group"
                title="Changer de projet"
              >
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {projet.nom}
                </span>
                <svg className="w-3 h-3 text-gray-400 group-hover:text-blue-500 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 overflow-x-auto flex-1">
          {LINKS.filter(({ page }) => canAccess(page) && canAccessPage(page)).map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-gray-800 dark:bg-slate-700 text-white'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-800 dark:hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              Administration
            </NavLink>
          )}
        </nav>

        {/* Utilisateur connecté + Déconnexion */}
        <div className="shrink-0 flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <UserAvatar user={user} />
              <span className="hidden md:block font-medium">{user.nom ?? user.email}</span>
              {isAdmin && (
                <span className="hidden md:block bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold px-1.5 py-0.5 rounded">Admin</span>
              )}
            </div>
          )}
          {/* Bouton jour / nuit */}
          <ThemeToggleButton />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:block">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  )
}

