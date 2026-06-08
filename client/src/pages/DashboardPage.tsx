import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetMonthDto, BudgetMonthSummaryDto, ImportStatementResult } from '../types'
import {
  fromDto,
  findItem,
  isIncome,
  monthPlanned,
  remainingToBudget,
  totalIncome,
  withCategoryName,
  withItemActual,
  withItemName,
  withItemPlanned,
  withNewCategory,
  withNewItem,
  withoutCategory,
  withoutItem,
  withReorderedExpenseCategories,
  withReorderedItems,
  type MonthVM,
} from '../budgetModel'
import { toAmount, type Minor } from '../lib/money'
import { RemainingBanner } from '../components/RemainingBanner'
import { CategoryAccordion } from '../components/CategoryAccordion'
import { IncomeGroup } from '../components/IncomeGroup'
import { ImportStatementButton } from '../components/ImportStatementButton'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const now = new Date()

export function DashboardPage() {
  const { email, logout } = useAuth()
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [month, setMonth] = useState<MonthVM | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<ImportStatementResult | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [months, setMonths] = useState<BudgetMonthSummaryDto[]>([])

  // Load the viewed month whenever it changes; a 404 means "no budget yet".
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)
    api
      .get<BudgetMonthDto>(`/budget/${view.year}/${view.month}`)
      .then(({ data }) => {
        if (!cancelled) setMonth(fromDto(data))
      })
      .catch((err) => {
        if (cancelled) return
        setMonth(null)
        if (err?.response?.status === 404) setNotFound(true)
        else setError('Could not load your budget. Is the API running?')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view])

  const refreshMonths = useCallback(() => {
    api
      .get<BudgetMonthSummaryDto[]>('/budget/months')
      .then(({ data }) => setMonths(data))
      .catch(() => {})
  }, [])

  useEffect(() => refreshMonths(), [refreshMonths])

  const hasPrevBudget = useMemo(
    () =>
      months.some(
        (m) => m.year < view.year || (m.year === view.year && m.month < view.month),
      ),
    [months, view],
  )

  const goToMonth = useCallback((year: number, month: number) => setView({ year, month }), [])
  const goPrev = useCallback(
    () => setView((v) => (v.month === 1 ? { year: v.year - 1, month: 12 } : { ...v, month: v.month - 1 })),
    [],
  )
  const goNext = useCallback(
    () => setView((v) => (v.month === 12 ? { year: v.year + 1, month: 1 } : { ...v, month: v.month + 1 })),
    [],
  )

  // Create the viewed month — copying the previous month's plan, or blank.
  const createMonth = useCallback(
    async (copyFromPrevious: boolean) => {
      setCreating(true)
      setError(null)
      try {
        const { data } = await api.post<BudgetMonthDto>('/budget', {
          year: view.year,
          month: view.month,
          copyFromPrevious,
        })
        setMonth(fromDto(data))
        setNotFound(false)
        refreshMonths()
      } catch {
        setError('Could not create that budget.')
      } finally {
        setCreating(false)
      }
    },
    [view, refreshMonths],
  )

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

  // Set a line's manual spent amount (for users tracking actuals by hand).
  // The banner is unaffected — Remaining-to-Budget is about planning, not spending —
  // but the line's own Remaining recomputes instantly.
  const commitActual = useCallback(
    async (itemId: string, actualMinor: Minor) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setSavingItemId(itemId)
      setMonth(withItemActual(month, itemId, actualMinor)) // optimistic

      try {
        await api.put(`/budget/items/${itemId}/actual`, { actualAmount: toAmount(actualMinor) })
      } catch {
        setMonth(snapshot)
        setError('Could not save that spent amount — reverted to the previous value.')
      } finally {
        setSavingItemId(null)
      }
    },
    [month],
  )

  // Switch a line between manual spent entry and transaction tracking. The new
  // actual is server-derived (we don't know the transaction sum client-side), so
  // we reconcile from the response rather than guessing optimistically.
  const setActualMode = useCallback(
    async (itemId: string, trackByTransactions: boolean) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setSavingItemId(itemId)

      try {
        const { data } = await api.put<BudgetMonthDto>(`/budget/items/${itemId}/actual-mode`, {
          trackByTransactions,
        })
        setMonth(fromDto(data))
      } catch {
        setMonth(snapshot)
        setError('Could not change how that line is tracked — reverted.')
      } finally {
        setSavingItemId(null)
      }
    },
    [month],
  )

  // Rename a line. The update endpoint takes the planned amount too, so we send
  // the line's current planned value alongside the new name.
  const renameItem = useCallback(
    async (itemId: string, name: string) => {
      if (!month) return
      const current = findItem(month, itemId)
      if (!current) return

      const snapshot = month
      setError(null)
      setSavingItemId(itemId)
      setMonth(withItemName(month, itemId, name)) // optimistic

      try {
        await api.put(`/budget/items/${itemId}`, {
          plannedAmount: toAmount(current.plannedMinor),
          name,
        })
      } catch {
        setMonth(snapshot)
        setError('Could not rename that line — reverted to the previous name.')
      } finally {
        setSavingItemId(null)
      }
    },
    [month],
  )

  // Add a line to a category. We show a temp row instantly, then reconcile from
  // the server response to pick up the real id and display order.
  const addItem = useCallback(
    async (categoryId: string, name: string) => {
      if (!month) return

      const snapshot = month
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setError(null)
      setMonth(
        withNewItem(month, categoryId, {
          id: tempId,
          name,
          displayOrder: Number.MAX_SAFE_INTEGER,
          plannedMinor: 0,
          actualMinor: 0,
          actualIsTracked: false,
        }),
      )

      try {
        const { data } = await api.post<BudgetMonthDto>(
          `/budget/categories/${categoryId}/items`,
          { name, plannedAmount: 0 },
        )
        setMonth(fromDto(data)) // reconcile temp row -> real server row
      } catch {
        setMonth(snapshot)
        setError('Could not add that line — reverted.')
      }
    },
    [month],
  )

  // Delete a line. Optimistically remove it, then reconcile from the response.
  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setSavingItemId(itemId)
      setMonth(withoutItem(month, itemId)) // optimistic

      try {
        const { data } = await api.delete<BudgetMonthDto>(`/budget/items/${itemId}`)
        setMonth(fromDto(data))
      } catch {
        setMonth(snapshot)
        setError('Could not delete that line — reverted.')
      } finally {
        setSavingItemId(null)
      }
    },
    [month],
  )

  // Add an expense category group. Temp group shown instantly, then reconciled.
  const addCategory = useCallback(
    async (name: string) => {
      if (!month) return

      const snapshot = month
      const tempId = `temp-cat-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setError(null)
      setMonth(
        withNewCategory(month, {
          id: tempId,
          name,
          kind: 'expense',
          displayOrder: Number.MAX_SAFE_INTEGER,
          items: [],
        }),
      )

      try {
        const { data } = await api.post<BudgetMonthDto>('/budget/categories', {
          budgetMonthId: month.id,
          name,
        })
        setMonth(fromDto(data)) // reconcile temp group -> real server group
      } catch {
        setMonth(snapshot)
        setError('Could not add that group — reverted.')
      }
    },
    [month],
  )

  const renameCategory = useCallback(
    async (categoryId: string, name: string) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setMonth(withCategoryName(month, categoryId, name)) // optimistic

      try {
        await api.put(`/budget/categories/${categoryId}`, { name })
      } catch {
        setMonth(snapshot)
        setError('Could not rename that group — reverted to the previous name.')
      }
    },
    [month],
  )

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setMonth(withoutCategory(month, categoryId)) // optimistic

      try {
        const { data } = await api.delete<BudgetMonthDto>(`/budget/categories/${categoryId}`)
        setMonth(fromDto(data))
      } catch {
        setMonth(snapshot)
        setError('Could not delete that group — reverted.')
      }
    },
    [month],
  )

  // Move an expense group up (-1) or down (+1) among the expense groups.
  const moveCategory = useCallback(
    async (categoryId: string, direction: -1 | 1) => {
      if (!month) return

      const expense = month.categories.filter((c) => !isIncome(c))
      const idx = expense.findIndex((c) => c.id === categoryId)
      const swap = idx + direction
      if (idx < 0 || swap < 0 || swap >= expense.length) return

      const reordered = [...expense]
      ;[reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]]
      const orderedIds = reordered.map((c) => c.id)

      const snapshot = month
      setError(null)
      setMonth(withReorderedExpenseCategories(month, orderedIds)) // optimistic

      try {
        const { data } = await api.put<BudgetMonthDto>('/budget/categories/order', {
          budgetMonthId: month.id,
          orderedCategoryIds: orderedIds,
        })
        setMonth(fromDto(data))
      } catch {
        setMonth(snapshot)
        setError('Could not reorder the groups — reverted.')
      }
    },
    [month],
  )

  // Reorder the lines within a category (CategoryAccordion computes the new order).
  const reorderItems = useCallback(
    async (categoryId: string, orderedItemIds: string[]) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setMonth(withReorderedItems(month, categoryId, orderedItemIds)) // optimistic

      try {
        const { data } = await api.put<BudgetMonthDto>(
          `/budget/categories/${categoryId}/items/order`,
          { orderedItemIds },
        )
        setMonth(fromDto(data))
      } catch {
        setMonth(snapshot)
        setError('Could not reorder the lines — reverted.')
      }
    },
    [month],
  )

  function submitNewCategory() {
    const trimmed = newCategoryName.trim()
    if (trimmed === '') return
    addCategory(trimmed)
    setNewCategoryName('')
  }

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
        {/* Month navigator — always visible so you can move between / create months. */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              ◀
            </button>
            <h2 className="min-w-44 text-center text-2xl font-bold tabular-nums text-slate-800">
              {MONTH_NAMES[view.month - 1]} {view.year}
            </h2>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            onClick={() => goToMonth(now.getFullYear(), now.getMonth() + 1)}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            This month
          </button>
        </div>

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
              {importSummary.autoCategorized > 0 && `, ${importSummary.autoCategorized} auto-categorized`}
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

        {notFound && !loading && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-slate-600">
              No budget for {MONTH_NAMES[view.month - 1]} {view.year} yet.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {hasPrevBudget && (
                <button
                  type="button"
                  onClick={() => createMonth(true)}
                  disabled={creating}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Copy last month’s budget
                </button>
              )}
              <button
                type="button"
                onClick={() => createMonth(false)}
                disabled={creating}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Start a blank budget
              </button>
            </div>
          </div>
        )}

        {month && (
          <>
            <p className="text-sm text-slate-500">
              Assign every Euro of income until “Remaining to Budget” reaches €0.00.
            </p>

            <RemainingBanner
              totalIncomeMinor={totalIncome(month)}
              totalPlannedMinor={monthPlanned(month)}
              remainingMinor={remainingToBudget(month)}
              currency={month.currency}
            />

            <div className="space-y-3">
              {/* Income groups always render first (EveryDollar style). */}
              {month.categories.filter(isIncome).map((category) => (
                <IncomeGroup
                  key={category.id}
                  category={category}
                  currency={month.currency}
                  savingItemId={savingItemId}
                  onRenameItem={renameItem}
                  onCommitPlanned={commitItem}
                  onCommitReceived={commitActual}
                  onSetActualMode={setActualMode}
                  onDeleteItem={deleteItem}
                  onAddItem={addItem}
                />
              ))}
              {month.categories
                .filter((c) => !isIncome(c))
                .map((category, i, arr) => (
                  <CategoryAccordion
                    key={category.id}
                    category={category}
                    currency={month.currency}
                    savingItemId={savingItemId}
                    isFirst={i === 0}
                    isLast={i === arr.length - 1}
                    onCommitItem={commitItem}
                    onCommitActual={commitActual}
                    onSetActualMode={setActualMode}
                    onRenameItem={renameItem}
                    onDeleteItem={deleteItem}
                    onAddItem={addItem}
                    onRenameCategory={renameCategory}
                    onDeleteCategory={deleteCategory}
                    onMove={moveCategory}
                    onReorderItems={reorderItems}
                  />
                ))}

              {/* Add a new expense category group (EveryDollar "Add Group"). */}
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-3">
                <input
                  type="text"
                  value={newCategoryName}
                  placeholder="Add a category group (e.g. Subscriptions, Insurance)…"
                  aria-label="New category group name"
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewCategory()
                  }}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={submitNewCategory}
                  aria-label="Add category group"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  + Add group
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
