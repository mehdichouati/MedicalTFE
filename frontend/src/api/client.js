import axios from 'axios'

const API_BASE_URL = 'http://127.0.0.1:8000/api'

// Pages accessibles sans connexion : on n'y redirige pas vers /login.
const PUBLIC_PATHS = ['/', '/login', '/register']

const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

// Supprime les tokens (session expiree ou invalide).
function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// Un seul refresh a la fois : si plusieurs requetes recoivent un 401 en
// meme temps, elles attendent toutes le meme renouvellement. Sans cela,
// avec la rotation des tokens (ROTATE_REFRESH_TOKENS + liste noire),
// le deuxieme refresh utiliserait un token deja mis sur liste noire.
let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('Aucun refresh token')
  }

  const { data } = await axios.post(`${API_BASE_URL}/auth/login/refresh/`, {
    refresh: refreshToken,
  })
  localStorage.setItem('access_token', data.access)
  // Le backend renvoie un nouveau refresh token a chaque renouvellement
  // (l'ancien est mis sur liste noire) : il faut le conserver.
  if (data.refresh) {
    localStorage.setItem('refresh_token', data.refresh)
  }
  return data.access
}

// Ajoute automatiquement le token JWT a chaque requete, s'il existe.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si le token a expire (401), on tente un refresh automatique une seule fois.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Pas de refresh pour la connexion elle-meme (mauvais mot de passe = 401).
    const isLoginRequest = originalRequest.url?.startsWith('/auth/login')
    if (error.response?.status !== 401 || originalRequest._retry || isLoginRequest) {
      return Promise.reject(error)
    }
    originalRequest._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newAccessToken = await refreshPromise
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch {
      // Session impossible a renouveler : on nettoie les tokens morts.
      clearTokens()
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  }
)

// Recupere toutes les pages d'une liste paginee par l'API (PAGE_SIZE = 20)
export async function fetchAllPages(url, params = {}) {
  let page = 1
  let all = []
  while (true) {
    const { data } = await apiClient.get(url, { params: { ...params, page } })
    if (Array.isArray(data)) return data
    all = all.concat(data.results)
    if (!data.next) return all
    page += 1
  }
}

export default apiClient