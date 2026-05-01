import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProjectProvider } from './context/ProjectContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAuth } from './context/AuthContext'
import { useProject } from './context/ProjectContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ProjectsPage from './pages/ProjectsPage'
import RisquesPage from './pages/RisquesPage'
import TachesPage from './pages/TachesPage'
import PlanningPage from './pages/PlanningPage'
import CdcPage from './pages/CdcPage'
import EquipePage from './pages/EquipePage'
import AidePage from './pages/AidePage'
import AdminPage from './pages/AdminPage'

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
      </div>
      <h1 className="text-lg font-bold text-gray-800">Accès non autorisé</h1>
      <p className="text-sm text-gray-500">Vous n'avez pas accès à cette page.<br/>Contactez votre administrateur.</p>
    </div>
  )
}

// Ordre de priorité des pages pour la redirection auto
const PAGES_ORDRE = ['cdc', 'planning', 'risques', 'taches', 'equipe', 'aide']

function PageGuard({ page, children }) {
  const { canAccess } = useAuth()
  const { canAccessPage } = useProject()
  if (canAccess(page) && canAccessPage(page)) return <>{children}</>
  // Cherche la première page accessible et y redirige (jamais de message d'accès refusé)
  const fallback = PAGES_ORDRE.find((p) => canAccess(p) && canAccessPage(p))
  if (fallback && fallback !== page) return <Navigate to={`/${fallback}`} replace />
  // Aucune page accessible : on affiche tout de même un message (cas extrême)
  return <AccessDenied />
}

// Redirige vers /projets si aucun projet sélectionné (sauf pour /admin)
function ProjectRoute({ children }) {
  const { projet } = useProject()
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return <>{children}</>
  return projet ? <>{children}</> : <Navigate to="/projets" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/projets" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <ProjectRoute>
                    <Layout />
                  </ProjectRoute>
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/cdc" replace />} />
              <Route path="risques"  element={<PageGuard page="risques"><RisquesPage /></PageGuard>} />
              <Route path="taches"   element={<PageGuard page="taches"><TachesPage /></PageGuard>} />
              <Route path="planning" element={<PageGuard page="planning"><PlanningPage /></PageGuard>} />
              <Route path="cdc"      element={<PageGuard page="cdc"><CdcPage /></PageGuard>} />
              <Route path="equipe"   element={<PageGuard page="equipe"><EquipePage /></PageGuard>} />
              <Route path="aide"     element={<PageGuard page="aide"><AidePage /></PageGuard>} />
              <Route path="admin"    element={<AdminPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

