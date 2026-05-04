import client from './client'

export const getCopils   = (projetId)       => client.get('/copils/', { params: { projet_id: projetId } })
export const createCopil = (projetId, data) => client.post('/copils/', data, { params: { projet_id: projetId } })
export const updateCopil = (id, data)       => client.put(`/copils/${id}`, data)
export const deleteCopil = (id)             => client.delete(`/copils/${id}`)
