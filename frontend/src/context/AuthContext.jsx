import { createContext, useContext, useState, useEffect } from 'react'
import i18n from '../i18n'
import apiClient from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async () => {
    try {
      const { data } = await apiClient.get('/auth/me/')
      setUser(data)
      if (data.language) {
        i18n.changeLanguage(data.language)
      }
    } catch {
      // Session invalide : client.js a deja supprime les tokens morts.
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Un refresh token suffit : client.js renouvellera le token d'acces.
    const hasSession = localStorage.getItem('access_token') || localStorage.getItem('refresh_token')
    if (hasSession) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const { data } = await apiClient.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    await fetchProfile()
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)

    // Met le refresh token sur liste noire cote serveur : meme vole,
    // il ne pourra plus servir a obtenir un nouveau token d'acces.
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout/', { refresh: refreshToken })
      } catch {
        // Token deja expire ou invalide : rien d'autre a faire.
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit etre utilise a l\'interieur de AuthProvider')
  }
  return context
}