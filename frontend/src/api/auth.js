import client from './client'

export const login  = (password) => client.post('/auth/login',  { password })
export const logout = ()         => client.post('/auth/logout')
