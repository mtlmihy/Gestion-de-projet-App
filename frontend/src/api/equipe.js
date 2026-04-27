import client from './client'

export const getEquipe     = (projetId)           => client.get('/equipe/',    { params: { projet_id: projetId } })
export const createMembre  = (projetId, data)     => client.post('/equipe/', data, { params: { projet_id: projetId } })
export const updateMembre  = (id, data)           => client.put(`/equipe/${id}`, data)
export const deleteMembre  = (id)                 => client.delete(`/equipe/${id}`)
