import axios from 'axios'

const client = axios.create({
  baseURL: '', // proxy Vite → pas de CORS en dev
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
