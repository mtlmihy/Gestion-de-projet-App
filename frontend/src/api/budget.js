import client from './client'

export const getDepenses   = (projetId)       => client.get('/budget/',         { params: { projet_id: projetId } })
export const createDepense = (projetId, data)  => client.post('/budget/',        data, { params: { projet_id: projetId } })
export const updateDepense = (ligneId, data)   => client.put(`/budget/${ligneId}`, data)
export const deleteDepense = (ligneId)         => client.delete(`/budget/${ligneId}`)
