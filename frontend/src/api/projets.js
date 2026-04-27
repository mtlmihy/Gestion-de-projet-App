import client from './client'

export const getProjets   = ()       => client.get('/projets/')
export const createProjet = (data)   => client.post('/projets/', data)
export const updateProjet = (id, d)  => client.put(`/projets/${id}`, d)
export const deleteProjet = (id)     => client.delete(`/projets/${id}`)
