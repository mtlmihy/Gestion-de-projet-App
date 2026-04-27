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

  return (
    <ProjectContext.Provider value={{ projet, setProjet, clearProjet, estLecteur, estProprietaire }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => useContext(ProjectContext)
