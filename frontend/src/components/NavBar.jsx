import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import ThemeToggleButton from './ThemeToggleButton'
import ChangePasswordModal from './ChangePasswordModal'
import Logo from './Logo'

const LINKS = [
  { to: '/cdc',      label: 'Cahier des Charges', page: 'cdc'      },
  { to: '/planning', label: 'Planning',            page: 'planning' },
  { to: '/copil',    label: 'COPIL',               page: 'copil'    },
  { to: '/risques',  label: 'Risques',             page: 'risques'  },
  { to: '/taches',   label: 'Tâches',              page: 'taches'   },
  { to: '/raci',     label: 'RACI',                page: 'raci'     },
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
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    setMobileOpen(false)
    clearProjet()
    await logout()
    navigate('/login', { replace: true })
  }

  const handlePasswordChanged = async () => {
    // Le backend a invalidé la session ; on déconnecte proprement.
    setShowChangePwd(false)
    clearProjet()
    await logout()
    navigate('/login', { replace: true })
  }

  const handleChangeProjet = () => {
    setMobileOpen(false)
    clearProjet()
    navigate('/projets', { replace: true })
  }

  const visibleLinks = LINKS.filter(({ page }) => canAccess(page) && canAccessPage(page))

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
              {/* Desktop : séparateur + nom complet */}
              <span className="hidden sm:inline text-gray-200">/</span>
              <button
                onClick={handleChangeProjet}
                className="hidden sm:flex items-center gap-1.5 max-w-[160px] group"
                title="Changer de projet"
              >
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {projet.nom}
                </span>
                <svg className="w-3 h-3 text-gray-400 group-hover:text-blue-500 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </button>
              {/* Mobile : nom tronqué compact */}
              <span className="sm:hidden text-sm font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[110px]">
                {projet.nom}
              </span>
            </>
          )}
        </div>

        {/* Nav links — desktop uniquement */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {visibleLinks.map(({ to, label }) => (
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

        {/* Spacer mobile */}
        <div className="flex-1 md:hidden" />

        {/* Utilisateur + actions — desktop */}
        <div className="hidden md:flex shrink-0 items-center gap-2">
          {user && (
            <button
              onClick={() => setShowChangePwd(true)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg px-2 py-1 transition-colors"
              title="Changer mon mot de passe"
            >
              <UserAvatar user={user} />
              <span className="font-medium">{user.nom ?? user.email}</span>
              {isAdmin && (
                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold px-1.5 py-0.5 rounded">Admin</span>
              )}
            </button>
          )}
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
            <span>Déconnexion</span>
          </button>
        </div>

        {/* Mobile : avatar + thème + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          {user && (
            <button onClick={() => setShowChangePwd(true)} title="Changer mon mot de passe">
              <UserAvatar user={user} />
            </button>
          )}
          <ThemeToggleButton />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex flex-col gap-1">
          {/* Changer de projet */}
          {projet && (
            <>
              <button
                onClick={handleChangeProjet}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-left"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
                <span>Changer de projet</span>
                <span className="ml-auto text-xs text-gray-400 dark:text-slate-500 truncate max-w-[130px]">{projet.nom}</span>
              </button>
              <div className="h-px bg-gray-100 dark:bg-slate-700 my-1" />
            </>
          )}

          {/* Liens de navigation */}
          {visibleLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 dark:bg-slate-700 text-white'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-800 dark:hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              Administration
            </NavLink>
          )}

          {/* Séparateur + déconnexion */}
          <div className="h-px bg-gray-100 dark:bg-slate-700 my-1" />
          {user && (
            <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-slate-500 font-medium">
              {user.nom ?? user.email}{isAdmin && <span className="ml-2 text-red-500 font-bold">Admin</span>}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
          </button>
        </div>
      )}

      {showChangePwd && (
        <ChangePasswordModal
          onClose={() => setShowChangePwd(false)}
          onSuccess={handlePasswordChanged}
        />
      )}
    </header>
  )
}

