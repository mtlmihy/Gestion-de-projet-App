import axios from 'axios'

// En dev : baseURL vide → proxy Vite (vite.config.js) gère localhost:8000
// En prod : VITE_API_URL pointe vers l'API déployée (ex: https://app.onrender.com)
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

// ── Protection CSRF (double-submit cookie) ───────────────────────────────────
// Le backend pose un cookie 'csrf_token' (non HttpOnly) à la connexion.
// On le lit et on le renvoie dans l'en-tête X-CSRF-Token sur toute
// requête mutable. Un site tiers ne pourra pas lire ce cookie (politique
// d'origine) donc ne pourra pas forger l'en-tête.
const CSRF_SAFE_METHODS = new Set(['get', 'head', 'options'])

function readCookie(name) {
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'),
  )
  return match ? decodeURIComponent(match[1]) : null
}

client.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!CSRF_SAFE_METHODS.has(method)) {
    const token = readCookie('csrf_token')
    if (token) {
      config.headers = config.headers || {}
      config.headers['X-CSRF-Token'] = token
    }
  }
  return config
})

// Redirection vers /login en cas de 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('user')
      window.location.replace('/login')
    }
    return Promise.reject(err)
  },
)

export default client
