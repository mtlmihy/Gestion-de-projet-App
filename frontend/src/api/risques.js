import client from './client'

export const getRisques    = ()        => client.get('/risques/')
export const createRisque  = (data)    => client.post('/risques/', data)
export const updateRisque  = (id, data) => client.put(`/risques/${id}`, data)
export const deleteRisque  = (id)      => client.delete(`/risques/${id}`)
