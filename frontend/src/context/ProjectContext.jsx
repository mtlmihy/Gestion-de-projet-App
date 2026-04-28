import { createContext, useContext, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

const ProjectContext = createContext(null)

const ROLES_LECTURE_SEULE = ['Lecteur', 'Client_Limite']

function loadProjet() {
  try { return JSON.parse(localStorage.getItem('projet') || 'null') } catch { return null }
}

export function ProjectProvider({ children }) {
  const [projet, setProjetState] = useState(loadProjet)
  const { isAdmin } = useAuth()

  const setProjet = useCallback((p) => {
    if (p) localStorage.setItem('projet', JSON.stringify(p))
    else localStorage.removeItem('projet')
    setProjetState(p)
  }, [])

  const clearProjet = useCallback(() => {
    localStorage.removeItem('projet')
    setProjetState(null)
  }, [])

  // Lecture seule si : projet clôturé (sauf admin) OU rôle Lecteur/Client_Limite
  const estLecteur     = !isAdmin && (projet?.est_cloture || ROLES_LECTURE_SEULE.includes(projet?.mon_role))
  // Peut gérer les membres : admin ou Propriétaire du projet
  const estProprietaire = isAdmin || projet?.mon_role === 'Proprietaire'

  // Vérifie l'accès à une page pour l'utilisateur courant dans ce projet.
  // Admin / Proprietaire / Editeur / Lecteur → toutes les pages.
  // Client_Limite → uniquement les pages listées dans mes_pages (null = toutes).
  const canAccessPage = (page) => {
    if (isAdmin) return true
    if (projet?.mon_role !== 'Client_Limite') return true
    if (projet?.mes_pages == null) return true
    return projet.mes_pages.includes(page)
  }

  return (
    <ProjectContext.Provider value={{ projet, setProjet, clearProjet, estLecteur, estProprietaire, canAccessPage }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => useContext(ProjectContext)
