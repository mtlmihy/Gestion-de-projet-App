import { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth'

const AuthContext = createContext(null)

function loadUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

// Filet de sécurité : efface côté JS le cookie csrf_token (non HttpOnly)
// au cas où la suppression cross-site (SameSite=None) côté serveur échoue.
// access_token est HttpOnly, donc inaccessible - seul le serveur peut le purger.
function clearCsrfCookieClientSide() {
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure'
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  const login = useCallback(async (email, password) => {
    await apiLogin(email, password)
    const { data } = await getMe()
    localStorage.setItem('user', JSON.stringify(data))
    setUser(data)
  }, [])

  const logout = useCallback(async () => {
    try { await apiLogout() } catch { /* ignore */ }
    clearCsrfCookieClientSide()
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  // Vérifie si l'utilisateur a accès à une page donnée.
  // Admin → toujours accès. pages_autorisees null → toutes les pages.
  const canAccess = useCallback((page) => {
    if (!user) return false
    if (user.is_admin) return true
    if (user.pages_autorisees == null) return true
    return user.pages_autorisees.includes(page)
  }, [user])

  const authenticated    = !!user
  const isAdmin          = !!user?.is_admin
  const peutCreerProjet  = !!user?.is_admin || !!user?.peut_creer_projet

  return (
    <AuthContext.Provider value={{ authenticated, user, isAdmin, peutCreerProjet, login, logout, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

