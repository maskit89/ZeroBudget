import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from '../lib/api'
import type { AuthResponse } from '../types'

interface AuthState {
  token: string | null
  email: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

const EMAIL_KEY = 'zbb.email'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken())
  const [email, setEmail] = useState<string | null>(localStorage.getItem(EMAIL_KEY))

  function apply(res: AuthResponse) {
    setToken(res.token)
    setTokenState(res.token)
    setEmail(res.email)
    localStorage.setItem(EMAIL_KEY, res.email)
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    apply(data)
  }

  async function register(email: string, password: string, displayName?: string) {
    const { data } = await api.post<AuthResponse>('/auth/register', { email, password, displayName })
    apply(data)
  }

  function logout() {
    setToken(null)
    setTokenState(null)
    setEmail(null)
    localStorage.removeItem(EMAIL_KEY)
  }

  const value = useMemo<AuthState>(
    () => ({ token, email, isAuthenticated: !!token, login, register, logout }),
    [token, email],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
