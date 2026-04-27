import client from './client'

export const getRisques    = (projetId)           => client.get('/risques/',    { params: { projet_id: projetId } })
export const createRisque  = (projetId, data)     => client.post('/risques/', data, { params: { projet_id: projetId } })
export const updateRisque  = (id, data)           => client.put(`/risques/${id}`, data)
export const deleteRisque  = (id)                 => client.delete(`/risques/${id}`)
