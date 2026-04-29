import client from './client'

export const getEquipe     = (projetId)               => client.get('/equipe/',    { params: { projet_id: projetId } })
export const createMembre  = (projetId, data)         => client.post('/equipe/', data, { params: { projet_id: projetId } })
export const updateMembre  = (projetId, id, data)     => client.put(`/equipe/${id}`, data, { params: { projet_id: projetId } })
export const deleteMembre  = (projetId, id)           => client.delete(`/equipe/${id}`, { params: { projet_id: projetId } })
