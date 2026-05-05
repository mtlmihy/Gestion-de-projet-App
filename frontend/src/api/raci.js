import client from './client'

export const getRaciMatrix = (projetId) =>
  client.get('/raci/', { params: { projet_id: projetId } })

export const updateRaciTache = (projetId, tacheId, assignations) =>
  client.put(`/raci/taches/${tacheId}`, { assignations }, { params: { projet_id: projetId } })
