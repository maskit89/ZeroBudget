import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetMonthDto, ImportStatementResult } from '../types'
import {
  fromDto,
  monthPlanned,
  remainingToBudget,
  withItemPlanned,
  type MonthVM,
} from '../budgetModel'
import { toAmount, type Minor } from '../lib/money'
import { RemainingBanner } from '../components/RemainingBanner'
import { CategoryAccordion } from '../components/CategoryAccordion'
import { ImportStatementButton } from '../components/ImportStatementButton'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function DashboardPage() {
  const { email, logout } = useAuth()
  const [month, setMonth] = useState<MonthVM | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<ImportStatementResult | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<BudgetMonthDto>('/budget/current')
      .then(({ data }) => {
        if (!cancelled) setMonth(fromDto(data))
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

  // Optimistic commit: apply the edit locally and recompute the banner instantly
  // (exact integer math), then persist. The server stores precisely what we send,
  // so success keeps the optimistic state; a failure rolls back and explains why.
  const commitItem = useCallback(
    async (itemId: string, plannedMinor: Minor) => {
      if (!month) return

      const snapshot = month // captured synchronously for a clean rollback
      setError(null)
      setSavingItemId(itemId)
      setMonth(withItemPlanned(month, itemId, plannedMinor)) // optimistic

      try {
        await api.put(`/budget/items/${itemId}`, { plannedAmount: toAmount(plannedMinor) })
      } catch {
        setMonth(snapshot) // roll back to the pre-edit state
        setError('Could not save that change — reverted to the previous value.')
      } finally {
        setSavingItemId(null)
      }
    },
    [month],
  )

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💶</span>
              <h1 className="text-lg font-bold text-slate-800">ZeroBudget</h1>
            </div>
            <nav className="flex gap-1 text-sm">
              <span className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800">
                Budget
              </span>
              <Link
                to="/transactions"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Transactions
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>
            <ImportStatementButton
              onImported={(r) => {
                setError(null)
                setImportSummary(r)
              }}
              onError={(msg) => {
                setImportSummary(null)
                setError(msg)
              }}
            />
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

        {importSummary && (
          <div className="flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>
              Imported <strong>{importSummary.imported}</strong> of {importSummary.totalEntries} entries
              {importSummary.skippedDuplicates > 0 && ` (skipped ${importSummary.skippedDuplicates} duplicate${importSummary.skippedDuplicates === 1 ? '' : 's'})`}
              {' — '}
              {importSummary.credits} credit{importSummary.credits === 1 ? '' : 's'}, {importSummary.debits} debit{importSummary.debits === 1 ? '' : 's'}
              {importSummary.iban && ` · ${importSummary.iban}`}.
            </span>
            <button
              onClick={() => setImportSummary(null)}
              className="shrink-0 text-emerald-600 hover:text-emerald-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {month && (
          <>
            <div>
              <h2 className="mb-1 text-2xl font-bold text-slate-800">
                {MONTH_NAMES[month.month - 1]} {month.year}
              </h2>
              <p className="text-sm text-slate-500">
                Assign every Euro of income until “Remaining to Budget” reaches €0.00.
              </p>
            </div>

            <RemainingBanner
              totalIncomeMinor={month.totalIncomeMinor}
              totalPlannedMinor={monthPlanned(month)}
              remainingMinor={remainingToBudget(month)}
              currency={month.currency}
            />

            <div className="space-y-3">
              {month.categories.map((category) => (
                <CategoryAccordion
                  key={category.id}
                  category={category}
                  currency={month.currency}
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
