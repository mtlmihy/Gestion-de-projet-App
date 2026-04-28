import axios from 'axios'

// En dev : baseURL vide → proxy Vite (vite.config.js) gère localhost:8000
// En prod : VITE_API_URL pointe vers l'API déployée (ex: https://app.onrender.com)
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

// Redirection vers /login en cas de 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('auth')
      window.location.replace('/login')
    }
    return Promise.reject(err)
  },
)

export default client
