import client from './client'

export const login          = (email, password) => client.post('/auth/login',  { email, password })
export const logout         = ()                => client.post('/auth/logout')
export const logoutAll      = ()                => client.post('/auth/logout-all')
export const getMe          = ()                => client.get('/auth/me')
export const getPinnedProjects = ()             => client.get('/auth/pinned-projects')
export const updatePinnedProjects = (projetIds) => client.put('/auth/pinned-projects', { projet_ids: projetIds })
export const changePassword = (currentPassword, newPassword) =>
  client.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword })
