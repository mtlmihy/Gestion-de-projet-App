import client from './client'

export const getEquipe     = ()         => client.get('/equipe/')
export const createMembre  = (data)     => client.post('/equipe/', data)
export const updateMembre  = (id, data) => client.put(`/equipe/${id}`, data)
export const deleteMembre  = (id)       => client.delete(`/equipe/${id}`)
