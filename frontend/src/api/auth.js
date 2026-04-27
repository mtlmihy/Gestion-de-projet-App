import client from './client'

export const login  = (email, password) => client.post('/auth/login',  { email, password })
export const logout = ()               => client.post('/auth/logout')
export const getMe  = ()               => client.get('/auth/me')
