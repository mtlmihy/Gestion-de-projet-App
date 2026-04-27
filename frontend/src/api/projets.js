import client from './client'

export const getProjets       = ()       => client.get('/projets/')
export const createProjet     = (data)   => client.post('/projets/', data)
export const updateProjet     = (id, d)  => client.put(`/projets/${id}`, d)
export const deleteProjet     = (id)     => client.delete(`/projets/${id}`)
export const cloturerProjet   = (id)     => client.post(`/projets/${id}/cloturer`)
export const reactiverProjet  = (id)     => client.post(`/projets/${id}/reactiver`)
