import client from './client'

export const getCdc    = ()        => client.get('/cdc/')
export const updateCdc = (contenu) => client.put('/cdc/', { contenu })
