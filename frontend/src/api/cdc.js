import client from './client'

export const getCdc    = (projetId)           => client.get('/cdc/',  { params: { projet_id: projetId } })
export const updateCdc = (projetId, contenu)  => client.put('/cdc/', { contenu }, { params: { projet_id: projetId } })
