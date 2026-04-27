import client from './client'

export const getTaches    = ()         => client.get('/taches/')
export const createTache  = (data)     => client.post('/taches/', data)
export const updateTache  = (id, data) => client.put(`/taches/${id}`, data)
export const deleteTache  = (id)       => client.delete(`/taches/${id}`)
