import { createContext, useContext, useState, useCallback } from 'react'

const ProjectContext = createContext(null)

function loadProjet() {
  try { return JSON.parse(localStorage.getItem('projet') || 'null') } catch { return null }
}

export function ProjectProvider({ children }) {
  const [projet, setProjetState] = useState(loadProjet)

  const setProjet = useCallback((p) => {
    if (p) localStorage.setItem('projet', JSON.stringify(p))
    else localStorage.removeItem('projet')
    setProjetState(p)
  }, [])

  const clearProjet = useCallback(() => {
    localStorage.removeItem('projet')
    setProjetState(null)
  }, [])

  return (
    <ProjectContext.Provider value={{ projet, setProjet, clearProjet }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => useContext(ProjectContext)
