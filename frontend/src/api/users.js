import client from './client'

// ── Utilisateurs (admin) ─────────────────────────────────────────────────────
export const getUsers        = ()          => client.get('/users/')
export const getUsersDisponibles = ()      => client.get('/users/disponibles')
export const createUser      = (data)      => client.post('/users/', data)
export const updateUser      = (id, data)  => client.put(`/users/${id}`, data)
export const deleteUser      = (id)        => client.delete(`/users/${id}`)
export const resetPassword   = (id, pwd)   => client.post(`/users/${id}/reset-password`, { password: pwd })

// ── Membres d'un projet ──────────────────────────────────────────────────────
export const getMembres      = (pid)            => client.get(`/projets/${pid}/membres`)
export const addMembre       = (pid, data)      => client.post(`/projets/${pid}/membres`, data)
export const updateMembre    = (pid, uid, role) => client.put(`/projets/${pid}/membres/${uid}`, { role })
export const removeMembre    = (pid, uid)       => client.delete(`/projets/${pid}/membres/${uid}`)
