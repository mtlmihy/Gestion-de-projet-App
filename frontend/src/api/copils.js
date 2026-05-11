import client from './client'

export const getCopils   = (projetId)       => client.get('/copils/', { params: { projet_id: projetId } })
export const createCopil = (projetId, data) => client.post('/copils/', data, { params: { projet_id: projetId } })
export const updateCopil = (id, data)       => client.put(`/copils/${id}`, data)
export const deleteCopil = (id)             => client.delete(`/copils/${id}`)

export const getCopilNotes = (copilId)      => client.get(`/copils/${copilId}/notes`)
export const createCopilNote = (copilId, data) => client.post(`/copils/${copilId}/notes`, data)
export const updateCopilNote = (noteId, data) => client.put(`/copils/notes/${noteId}`, data)
export const deleteCopilNote = (noteId) => client.delete(`/copils/notes/${noteId}`)
