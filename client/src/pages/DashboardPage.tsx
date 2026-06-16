import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { AppShell } from '../components/AppShell'
import type {
  BudgetMonthDto,
  BudgetMonthSummaryDto,
  BudgetTemplateDto,
} from '../types'
import {
  billAlerts,
  billsSummary,
  fromDto,
  findItem,
  isFund,
  isIncome,
  monthPlanned,
  remainingToBudget,
  totalIncome,
  withCategoryName,
  withItemActual,
  withItemBill,
  withItemName,
  withItemPaid,
  withItemPlanned,
  withNewCategory,
  withNewItem,
  withoutCategory,
  withoutItem,
  withReorderedExpenseCategories,
  withReorderedItems,
  type MonthVM,
} from '../budgetModel'
import { formatMoney, toAmount, type Minor } from '../lib/money'
import { RemainingBanner } from '../components/RemainingBanner'
import { CategoryAccordion } from '../components/CategoryAccordion'
import { FundGroup } from '../components/FundGroup'
import { IncomeGroup } from '../components/IncomeGroup'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const now = new Date()

export function DashboardPage({ today = new Date() }: { today?: Date } = {}) {
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [month, setMonth] = useState<MonthVM | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIsFund, setNewCategoryIsFund] = useState(false)
  const [months, setMonths] = useState<BudgetMonthSummaryDto[]>([])
  const [templates, setTemplates] = useState<BudgetTemplateDto[]>([])

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

  // The quick-start templates are a static catalogue — load them once.
  useEffect(() => {
    api
      .get<BudgetTemplateDto[]>('/budget/templates')
      .then(({ data }) => setTemplates(data))
      .catch(() => {})
  }, [])

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

  // Create the viewed month from a quick-start template.
  const createFromTemplate = useCallback(
    async (templateKey: string) => {
      setCreating(true)
      setError(null)
      try {
        const { data } = await api.post<BudgetMonthDto>('/budget', {
          year: view.year,
          month: view.month,
          copyFromPrevious: false,
          templateKey,
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

  // Mark a line as a bill due on a day of the month (or clear it with null).
  const setBill = useCallback(
    async (itemId: string, dueDay: number | null) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setSavingItemId(itemId)
      setMonth(withItemBill(month, itemId, dueDay)) // optimistic

      try {
        await api.put(`/budget/items/${itemId}/bill`, { dueDay })
      } catch {
        setMonth(snapshot)
        setError('Could not update that bill — reverted.')
      } finally {
        setSavingItemId(null)
      }
    },
    [month],
  )

  // Toggle a bill line's paid status for this month.
  const setPaid = useCallback(
    async (itemId: string, isPaid: boolean) => {
      if (!month) return

      const snapshot = month
      setError(null)
      setSavingItemId(itemId)
      setMonth(withItemPaid(month, itemId, isPaid)) // optimistic

      try {
        await api.put(`/budget/items/${itemId}/paid`, { isPaid })
      } catch {
        setMonth(snapshot)
        setError('Could not update that bill — reverted.')
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
          fundAvailableMinor: null,
          dueDay: null,
          isPaid: false,
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

  // Add an expense or fund category group. Temp group shown instantly, then reconciled.
  const addCategory = useCallback(
    async (name: string, asFund: boolean) => {
      if (!month) return

      const snapshot = month
      const tempId = `temp-cat-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setError(null)
      setMonth(
        withNewCategory(month, {
          id: tempId,
          name,
          kind: asFund ? 'fund' : 'expense',
          displayOrder: Number.MAX_SAFE_INTEGER,
          items: [],
        }),
      )

      try {
        const { data } = await api.post<BudgetMonthDto>('/budget/categories', {
          budgetMonthId: month.id,
          name,
          isFund: asFund,
        })
        setMonth(fromDto(data)) // reconcile temp group -> real server group
      } catch {
        setMonth(snapshot)
        setError(`Could not add that ${asFund ? 'fund group' : 'group'} — reverted.`)
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

      const expense = month.categories.filter((c) => c.kind === 'expense')
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
    addCategory(trimmed, newCategoryIsFund)
    setNewCategoryName('')
  }

  return (
    <AppShell active="budget" maxWidth="4xl">
        {/* Page heading + month navigator — always visible so you can move between / create months. */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Budget</h1>
            <p className="mt-1 text-sm text-slate-500">
              Give every euro a job until “Remaining to Budget” reaches €0.00.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              ◀
            </button>
            <h2 className="min-w-40 text-center text-lg font-semibold tabular-nums text-slate-800">
              {MONTH_NAMES[view.month - 1]} {view.year}
            </h2>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => goToMonth(now.getFullYear(), now.getMonth() + 1)}
              className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              This month
            </button>
          </div>
        </div>

        {loading && <p className="text-slate-500">Loading your budget…</p>}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {notFound && !loading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-surface px-6 py-12 text-center shadow-card">
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

            {templates.length > 0 && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <p className="text-sm font-medium text-slate-500">Or start from a template</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {templates.map((t) => {
                    const lineCount = t.groups.reduce((n, g) => n + g.lines.length, 0)
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => createFromTemplate(t.key)}
                        disabled={creating}
                        aria-label={`Start from the ${t.name} template`}
                        className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-surface p-4 text-left transition hover:border-brand-500 hover:bg-brand-50/40 hover:shadow-card disabled:opacity-50"
                      >
                        <span className="font-semibold text-slate-800">{t.name}</span>
                        <span className="text-xs text-slate-500">{t.description}</span>
                        <span className="mt-1 text-xs text-slate-400">
                          {t.groups.length} groups · {lineCount} lines
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {month && (
          <>
            <RemainingBanner
              totalIncomeMinor={totalIncome(month)}
              totalPlannedMinor={monthPlanned(month)}
              remainingMinor={remainingToBudget(month)}
              currency={month.currency}
            />

            {(() => {
              const bills = billsSummary(month)
              if (bills.total === 0) return null
              const allPaid = bills.paid === bills.total
              const alerts = billAlerts(month, today)
              const tone = alerts.overdue > 0
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : allPaid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              return (
                <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${tone}`}>
                  <span className="font-medium">
                    📅 Bills: {bills.paid}/{bills.total} paid
                    {alerts.overdue > 0 && (
                      <span className="ml-2 font-semibold">· {alerts.overdue} overdue</span>
                    )}
                    {alerts.overdue === 0 && alerts.dueSoon > 0 && (
                      <span className="ml-2">· {alerts.dueSoon} due soon</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {allPaid
                      ? 'All bills paid 🎉'
                      : `${formatMoney(bills.unpaidMinor, month.currency)} left to pay`}
                  </span>
                </div>
              )
            })()}

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
                .filter((c) => c.kind === 'expense')
                .map((category, i, arr) => (
                  <CategoryAccordion
                    key={category.id}
                    category={category}
                    currency={month.currency}
                    savingItemId={savingItemId}
                    monthYear={month.year}
                    monthNumber={month.month}
                    today={today}
                    isFirst={i === 0}
                    isLast={i === arr.length - 1}
                    onCommitItem={commitItem}
                    onCommitActual={commitActual}
                    onSetActualMode={setActualMode}
                    onSetBill={setBill}
                    onSetPaid={setPaid}
                    onRenameItem={renameItem}
                    onDeleteItem={deleteItem}
                    onAddItem={addItem}
                    onRenameCategory={renameCategory}
                    onDeleteCategory={deleteCategory}
                    onMove={moveCategory}
                    onReorderItems={reorderItems}
                  />
                ))}

              {/* Sinking funds render below expenses; their balances roll over. */}
              {month.categories.filter(isFund).map((category) => (
                <FundGroup
                  key={category.id}
                  category={category}
                  currency={month.currency}
                  savingItemId={savingItemId}
                  onCommitItem={commitItem}
                  onCommitActual={commitActual}
                  onSetActualMode={setActualMode}
                  onRenameItem={renameItem}
                  onDeleteItem={deleteItem}
                  onAddItem={addItem}
                  onRenameCategory={renameCategory}
                  onDeleteCategory={deleteCategory}
                />
              ))}

              {/* Add a new expense or fund group (EveryDollar "Add Group"). */}
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-surface/60 px-4 py-3">
                <input
                  type="text"
                  value={newCategoryName}
                  placeholder={
                    newCategoryIsFund
                      ? 'Add a fund group (e.g. Sinking Funds, Savings)…'
                      : 'Add a category group (e.g. Subscriptions, Insurance)…'
                  }
                  aria-label="New category group name"
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewCategory()
                  }}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <select
                  value={newCategoryIsFund ? 'fund' : 'expense'}
                  aria-label="New group kind"
                  onChange={(e) => setNewCategoryIsFund(e.target.value === 'fund')}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="expense">Expense</option>
                  <option value="fund">Fund</option>
                </select>
                <button
                  type="button"
                  onClick={submitNewCategory}
                  aria-label="Add category group"
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  + Add group
                </button>
              </div>
            </div>
          </>
        )}
    </AppShell>
  )
}
