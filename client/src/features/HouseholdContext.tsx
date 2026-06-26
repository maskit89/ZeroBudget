import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { HouseholdMemberDto } from '../types'

/**
 * The household's shape, derived from how many members it has. A person is a
 * member, so a household of one (just you) is "solo" and a household of two or
 * more is "shared". The multi-member surfaces (Members, Allocation,
 * per-transaction attribution and cost-splitting) only make sense once there's
 * someone to split with, so we reveal them progressively at two members. A brand-new
 * account has no member records yet (income lives on the budget's income lines), so
 * both 0 and 1 members are treated the same: solo.
 */
interface HouseholdState {
  /** Active household members (the server already excludes archived ones). */
  members: HouseholdMemberDto[]
  /** True once the budget is shared between two or more members. */
  isShared: boolean
  /** Still fetching the member list for the first time. */
  loading: boolean
  /** Re-fetch the member list (call after adding/archiving a member). */
  refresh: () => Promise<void>
}

/** Two or more members means the budget is shared; 0 or 1 is solo. */
const SHARED_THRESHOLD = 2

/**
 * Solo-safe default for consumers rendered without a provider (e.g. page tests):
 * not shared, and `loading` stays true so the multi-member UI never flashes in.
 */
const DEFAULT: HouseholdState = {
  members: [],
  isShared: false,
  loading: true,
  refresh: async () => {},
}

const HouseholdContext = createContext<HouseholdState>(DEFAULT)

/** The current household shape. Defaults to "solo" when no provider is present. */
export function useHousehold(): HouseholdState {
  return useContext(HouseholdContext)
}

/** Loads the household's members once (when authenticated) and shares them with the app. */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [members, setMembers] = useState<HouseholdMemberDto[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setMembers([])
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get<HouseholdMemberDto[]>('/members')
      setMembers(Array.isArray(data) ? data : [])
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Initial load + reload whenever the signed-in user changes. A separate
  // cancelled guard keeps an in-flight fetch from setting state after unmount.
  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get<HouseholdMemberDto[]>('/members')
      .then(({ data }) => {
        if (!cancelled) setMembers(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setMembers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const value: HouseholdState = {
    members,
    isShared: members.length >= SHARED_THRESHOLD,
    loading,
    refresh,
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
