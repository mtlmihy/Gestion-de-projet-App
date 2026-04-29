import client from './client'

export const getLiens         = (projetId)            => client.get(`/projets/${projetId}/liens`)
export const createLien       = (projetId, data)      => client.post(`/projets/${projetId}/liens`, data)
export const updateLien       = (projetId, id, data)  => client.put(`/projets/${projetId}/liens/${id}`, data)
export const setLienVisible   = (projetId, id, vis)   => client.patch(`/projets/${projetId}/liens/${id}/visibilite`, { visible: vis })
export const deleteLien       = (projetId, id)        => client.delete(`/projets/${projetId}/liens/${id}`)
