import client from './client'

export const getTaches    = (projetId)           => client.get('/taches/',    { params: { projet_id: projetId } })
export const createTache  = (projetId, data)     => client.post('/taches/', data, { params: { projet_id: projetId } })
export const updateTache  = (id, data)           => client.put(`/taches/${id}`, data)
export const deleteTache  = (id)                 => client.delete(`/taches/${id}`)
