import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../config.js'

const TOKEN_KEY = 'verifeye_token'
const REDIRECT_PATH_KEY = 'verifeye_redirect_path'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [oauthError, setOauthError] = useState(null)

  const setToken = useCallback((newToken) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
      setTokenState(newToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      setTokenState(null)
      setUser(null)
    }
  }, [])

  const fetchUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json()
      if (data.success && data.user) {
        setUser(data.user)
        setTokenState(t)
      } else {
        setToken(null)
      }
    } catch {
      setToken(null)
    } finally {
      setLoading(false)
    }
  }, [setToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authToken = params.get('auth_token')
    const authError = params.get('auth_error')
    if (authToken) {
      setToken(authToken)
      setOauthError(null)
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (authError) {
      setOauthError(decodeURIComponent(authError))
      setToken(null)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (token) {
      fetchUser()
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [token, fetchUser, setToken])

  useEffect(() => {
    if (!token) return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchUser()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [token, fetchUser])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Login failed')
    setToken(data.token)
    setUser(data.user)
    setLoading(false)
    return data.user
  }, [setToken])

  const register = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Registration failed')
    setToken(data.token)
    setUser(data.user)
    setLoading(false)
    return data.user
  }, [setToken])

  const logout = useCallback(() => {
    localStorage.removeItem(REDIRECT_PATH_KEY)
    sessionStorage.removeItem('verifeye_nav')
    setToken(null)
  }, [setToken])

  const refreshUser = useCallback(() => {
    if (token) fetchUser()
  }, [token, fetchUser])

  const getAuthHeaders = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        oauthError,
        clearOauthError: () => setOauthError(null),
        login,
        register,
        logout,
        refreshUser,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
