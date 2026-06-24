import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from '../lib/api'
import { HouseholdRole, type AuthResponse, type MeResponse } from '../types'

interface AuthState {
  token: string | null
  email: string | null
  displayName: string | null
  /** Numeric HouseholdRole for the current login (defaults to Owner until resolved). */
  role: number
  isAuthenticated: boolean
  /** Owner only — may manage members and access. */
  canManageHousehold: boolean
  /** Admin and above — may change budget structure, accounts, funds, members. */
  canWrite: boolean
  /** Limited and above (i.e. not read-only) — may record day-to-day data. */
  canEnterData: boolean
  isReadOnly: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  acceptInvite: (token: string, password: string, displayName?: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

const EMAIL_KEY = 'zbb.email'
const ROLE_KEY = 'zbb.role'
const NAME_KEY = 'zbb.displayName'

function storedRole(): number {
  const raw = localStorage.getItem(ROLE_KEY)
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : HouseholdRole.Owner
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken())
  const [email, setEmail] = useState<string | null>(localStorage.getItem(EMAIL_KEY))
  const [displayName, setDisplayName] = useState<string | null>(localStorage.getItem(NAME_KEY))
  const [role, setRole] = useState<number>(storedRole())

  function apply(res: AuthResponse) {
    setToken(res.token)
    setTokenState(res.token)
    setEmail(res.email)
    setRole(res.role)
    setDisplayName(res.displayName)
    localStorage.setItem(EMAIL_KEY, res.email)
    localStorage.setItem(ROLE_KEY, String(res.role))
    if (res.displayName) localStorage.setItem(NAME_KEY, res.displayName)
    else localStorage.removeItem(NAME_KEY)
  }

  // Refresh the role from the server whenever there's a token — a role change (or revoke)
  // takes effect on next load without needing a fresh login.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const request = api.get<MeResponse>('/auth/me')
    // Guard against a non-promise (e.g. an incomplete mock) so the provider never throws.
    if (!request || typeof request.then !== 'function') return
    request
      .then((res) => {
        const data = res?.data
        if (cancelled || !data) return
        setRole(data.role)
        setEmail(data.email)
        setDisplayName(data.displayName)
        localStorage.setItem(ROLE_KEY, String(data.role))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  async function login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    apply(data)
  }

  async function register(email: string, password: string, displayName?: string) {
    const { data } = await api.post<AuthResponse>('/auth/register', { email, password, displayName })
    apply(data)
  }

  async function acceptInvite(inviteToken: string, password: string, displayName?: string) {
    const { data } = await api.post<AuthResponse>('/auth/accept-invite', {
      token: inviteToken,
      password,
      displayName,
    })
    apply(data)
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  }

  function logout() {
    setToken(null)
    setTokenState(null)
    setEmail(null)
    setDisplayName(null)
    setRole(HouseholdRole.Owner)
    localStorage.removeItem(EMAIL_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(NAME_KEY)
  }

  const value = useMemo<AuthState>(
    () => ({
      token,
      email,
      displayName,
      role,
      isAuthenticated: !!token,
      canManageHousehold: role === HouseholdRole.Owner,
      canWrite: role <= HouseholdRole.Admin,
      canEnterData: role <= HouseholdRole.Limited,
      isReadOnly: role === HouseholdRole.ReadOnly,
      login,
      register,
      acceptInvite,
      changePassword,
      logout,
    }),
    [token, email, displayName, role],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
