import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetMonthDto } from '../types'
import { RemainingBanner } from '../components/RemainingBanner'
import { CategoryAccordion } from '../components/CategoryAccordion'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function DashboardPage() {
  const { email, logout } = useAuth()
  const [budget, setBudget] = useState<BudgetMonthDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<BudgetMonthDto>('/budget/current')
      .then(({ data }) => {
        if (!cancelled) setBudget(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your budget. Is the API running?')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Commit a planned-amount edit. The API returns the fully recomputed month,
  // so we simply replace state and the banner + totals update reactively.
  const commitItem = useCallback(async (itemId: string, plannedAmount: number) => {
    setSavingItemId(itemId)
    setError(null)
    try {
      const { data } = await api.put<BudgetMonthDto>(`/budget/items/${itemId}`, { plannedAmount })
      setBudget(data)
    } catch {
      setError('Failed to save that change.')
    } finally {
      setSavingItemId(null)
    }
  }, [])

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💶</span>
            <h1 className="text-lg font-bold text-slate-800">ZeroBudget</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {loading && <p className="text-slate-500">Loading your budget…</p>}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {budget && (
          <>
            <div>
              <h2 className="mb-1 text-2xl font-bold text-slate-800">
                {MONTH_NAMES[budget.month - 1]} {budget.year}
              </h2>
              <p className="text-sm text-slate-500">
                Assign every Euro of income until “Remaining to Budget” reaches €0.00.
              </p>
            </div>

            <RemainingBanner
              totalIncome={budget.totalIncome}
              totalPlanned={budget.totalPlanned}
              remainingToBudget={budget.remainingToBudget}
            />

            <div className="space-y-3">
              {budget.categories.map((category) => (
                <CategoryAccordion
                  key={category.id}
                  category={category}
                  savingItemId={savingItemId}
                  onCommitItem={commitItem}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
