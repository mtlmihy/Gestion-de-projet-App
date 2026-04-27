import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RisquesPage from './pages/RisquesPage'
import TachesPage from './pages/TachesPage'
import PlanningPage from './pages/PlanningPage'
import CdcPage from './pages/CdcPage'
import EquipePage from './pages/EquipePage'
import AidePage from './pages/AidePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/risques" replace />} />
            <Route path="risques"  element={<RisquesPage />} />
            <Route path="taches"   element={<TachesPage />} />
            <Route path="planning" element={<PlanningPage />} />
            <Route path="cdc"      element={<CdcPage />} />
            <Route path="equipe"   element={<EquipePage />} />
            <Route path="aide"     element={<AidePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
