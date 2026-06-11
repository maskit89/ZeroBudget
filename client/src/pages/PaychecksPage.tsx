import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetMonthDto, PaycheckDto } from '../types'
import { formatMoney, fromAmount, parseMinor, sumMinor, toAmount } from '../lib/money'

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type AllocRow = { budgetItemId: string; amount: string }

export function PaychecksPage() {
  const { logout } = useAuth()
  const [month, setMonth] = useState<BudgetMonthDto | null>(null)
  const [paychecks, setPaychecks] = useState<PaycheckDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add-paycheck form.
  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [adding, setAdding] = useState(false)

  // Inline edit.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eDate, setEDate] = useState('')
  const [eAmount, setEAmount] = useState('')

  // Allocation editor.
  const [allocatingId, setAllocatingId] = useState<string | null>(null)
  const [allocRows, setAllocRows] = useState<AllocRow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<BudgetMonthDto>('/budget/current')
      .then(async ({ data }) => {
        if (cancelled) return
        setMonth(data)
        const { data: list } = await api.get<PaycheckDto[]>(`/paychecks?year=${data.year}&month=${data.month}`)
        if (!cancelled) setPaychecks(list)
      })
      .catch(() => !cancelled && setMonth(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const currency = month?.baseCurrency ?? 'EUR'

  // The lines a paycheck can fund: expense + fund groups (not income sources).
  const lineOptions = useMemo(() => {
    if (!month) return []
    return month.categories
      .filter((c) => c.kind !== 'Income')
      .map((c) => ({ category: c.name, items: c.items.map((i) => ({ id: i.id, name: i.name })) }))
      .filter((g) => g.items.length > 0)
  }, [month])

  const addPaycheck = useCallback(async () => {
    if (!month) return
    if (name.trim() === '') {
      setError('Give the paycheck a name.')
      return
    }
    const minor = parseMinor(amount)
    if (minor === null || minor <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const { data } = await api.post<PaycheckDto>('/paychecks', {
        budgetMonthId: month.id,
        name: name.trim(),
        date,
        plannedAmount: toAmount(minor),
      })
      setPaychecks((prev) => [...prev, data])
      setName('')
      setAmount('')
    } catch {
      setError('Could not add that paycheck.')
    } finally {
      setAdding(false)
    }
  }, [month, name, date, amount])

  function startEdit(p: PaycheckDto) {
    setAllocatingId(null)
    setEditingId(p.id)
    setEName(p.name)
    setEDate(p.date)
    setEAmount(String(p.plannedAmount))
  }

  const saveEdit = useCallback(
    async (id: string) => {
      const minor = parseMinor(eAmount)
      if (eName.trim() === '' || minor === null || minor <= 0) {
        setError('A paycheck needs a name and an amount greater than zero.')
        return
      }
      setSavingId(id)
      setError(null)
      try {
        const { data } = await api.put<PaycheckDto>(`/paychecks/${id}`, {
          name: eName.trim(),
          date: eDate,
          plannedAmount: toAmount(minor),
        })
        setPaychecks((prev) => prev.map((p) => (p.id === id ? data : p)))
        setEditingId(null)
      } catch {
        setError('Could not save that paycheck.')
      } finally {
        setSavingId(null)
      }
    },
    [eName, eDate, eAmount],
  )

  const remove = useCallback(async (id: string) => {
    setSavingId(id)
    setError(null)
    try {
      await api.delete(`/paychecks/${id}`)
      setPaychecks((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Could not delete that paycheck.')
    } finally {
      setSavingId(null)
    }
  }, [])

  function startAllocate(p: PaycheckDto) {
    setEditingId(null)
    setAllocatingId(p.id)
    setAllocRows(
      p.allocations.length > 0
        ? p.allocations.map((a) => ({ budgetItemId: a.budgetItemId ?? '', amount: String(a.amount) }))
        : [{ budgetItemId: '', amount: '' }],
    )
  }

  function updateAllocRow(index: number, patch: Partial<AllocRow>) {
    setAllocRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addAllocRow() {
    setAllocRows((rows) => [...rows, { budgetItemId: '', amount: '' }])
  }

  function removeAllocRow(index: number) {
    setAllocRows((rows) => rows.filter((_, i) => i !== index))
  }

  const saveAllocations = useCallback(
    async (p: PaycheckDto) => {
      const rows = allocRows.filter((r) => r.budgetItemId !== '')
      const parsed = rows.map((r) => ({ budgetItemId: r.budgetItemId, minor: parseMinor(r.amount) }))
      if (parsed.some((a) => a.minor === null || a.minor <= 0)) {
        setError('Give every allocation a line and an amount greater than zero.')
        return
      }
      setSavingId(p.id)
      setError(null)
      try {
        const { data } = await api.put<PaycheckDto>(`/paychecks/${p.id}/allocations`, {
          allocations: parsed.map((a) => ({ budgetItemId: a.budgetItemId, amount: toAmount(a.minor as number) })),
        })
        setPaychecks((prev) => prev.map((x) => (x.id === p.id ? data : x)))
        setAllocatingId(null)
      } catch {
        setError('Could not save those allocations.')
      } finally {
        setSavingId(null)
      }
    },
    [allocRows],
  )

  const monthLabel = month ? `${SHORT_MONTHS[month.month - 1]} ${month.year}` : ''

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💶</span>
              <h1 className="text-lg font-bold text-slate-800">ZeroBudget</h1>
            </div>
            <nav className="flex gap-1 text-sm">
              <Link to="/" className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100">
                Budget
              </Link>
              <span className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800">Paychecks</span>
              <Link
                to="/transactions"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Transactions
              </Link>
              <Link
                to="/accounts"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Accounts
              </Link>
              <Link
                to="/reports"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Reports
              </Link>
              <Link
                to="/rules"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Rules
              </Link>
            </nav>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Paycheck planning{month && <span className="text-slate-400"> · {monthLabel}</span>}
          </h2>
          <p className="text-sm text-slate-500">
            Plan which paycheck funds which budget lines. Allocate each paycheck across your expense and
            fund lines; the remainder is what's still to assign.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading && <p className="text-slate-500">Loading…</p>}

        {!loading && !month && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            Create this month's budget on the Budget page first, then plan your paychecks here.
          </div>
        )}

        {month && (
          <>
            {/* Add-paycheck form. */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Add a paycheck</h3>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                  Name
                  <input
                    type="text"
                    value={name}
                    placeholder="e.g. 1st paycheck"
                    aria-label="Paycheck name"
                    onChange={(e) => setName(e.target.value)}
                    className="min-w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                  Date
                  <input
                    type="date"
                    value={date}
                    aria-label="Paycheck date"
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                  Amount
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    placeholder="0,00"
                    aria-label="Paycheck amount"
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addPaycheck()
                    }}
                    className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={addPaycheck}
                  disabled={adding}
                  aria-label="Add paycheck"
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {paychecks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
                No paychecks yet. Add the deposits you expect this month, then allocate each across your
                budget lines.
              </div>
            )}

            <div className="space-y-3">
              {paychecks.map((p) => {
                const editing = editingId === p.id
                const allocating = allocatingId === p.id
                const plannedMinor = fromAmount(p.plannedAmount)
                const allocatedMinor = sumMinor(allocRows.map((r) => parseMinor(r.amount) ?? 0))
                const remainderMinor = plannedMinor - allocatedMinor
                return (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {editing ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                          Name
                          <input
                            type="text"
                            value={eName}
                            aria-label={`Name for ${p.name}`}
                            onChange={(e) => setEName(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                          Date
                          <input
                            type="date"
                            value={eDate}
                            aria-label={`Date for ${p.name}`}
                            onChange={(e) => setEDate(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                          Amount
                          <input
                            type="text"
                            inputMode="decimal"
                            value={eAmount}
                            aria-label={`Amount for ${p.name}`}
                            onChange={(e) => setEAmount(e.target.value)}
                            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => saveEdit(p.id)}
                          disabled={savingId === p.id}
                          aria-label={`Save ${p.name}`}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel edit"
                          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-800">{p.name}</div>
                          <div className="text-xs text-slate-400 tabular-nums">{p.date}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-semibold tabular-nums text-slate-800">
                              {formatMoney(plannedMinor, currency)}
                            </div>
                            <div
                              className={`text-xs tabular-nums ${
                                fromAmount(p.remaining) < 0 ? 'text-rose-600' : 'text-slate-500'
                              }`}
                            >
                              {formatMoney(fromAmount(p.remaining), currency)} left to assign
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => startAllocate(p)}
                              aria-label={`Allocate ${p.name}`}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Allocate
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              aria-label={`Edit ${p.name}`}
                              title="Edit paycheck"
                              className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(p.id)}
                              disabled={savingId === p.id}
                              aria-label={`Delete ${p.name}`}
                              title="Delete paycheck"
                              className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Allocation summary (when not editing that paycheck). */}
                    {!allocating && p.allocations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                        {p.allocations.map((a) => (
                          <span
                            key={a.id}
                            className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          >
                            {a.budgetItemName ?? 'Unassigned'} {formatMoney(fromAmount(a.amount), currency)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Allocation editor. */}
                    {allocating && (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-700">Allocate “{p.name}”</h4>
                          <span
                            aria-label="Remaining to allocate"
                            className={`text-xs font-semibold tabular-nums ${
                              remainderMinor < 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {formatMoney(remainderMinor, currency)} left
                          </span>
                        </div>

                        {lineOptions.length === 0 && (
                          <p className="text-xs text-rose-600">Add some expense or fund lines first.</p>
                        )}

                        {allocRows.map((row, index) => (
                          <div key={index} className="flex flex-wrap items-center gap-2">
                            <select
                              value={row.budgetItemId}
                              aria-label={`Allocation ${index + 1} line`}
                              onChange={(e) => updateAllocRow(index, { budgetItemId: e.target.value })}
                              className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="">Choose a line…</option>
                              {lineOptions.map((g) => (
                                <optgroup key={g.category} label={g.category}>
                                  {g.items.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.amount}
                              placeholder="0,00"
                              aria-label={`Allocation ${index + 1} amount`}
                              onChange={(e) => updateAllocRow(index, { amount: e.target.value })}
                              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => removeAllocRow(index)}
                              aria-label={`Remove allocation ${index + 1}`}
                              title="Remove allocation"
                              className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={addAllocRow}
                            aria-label="Add allocation line"
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                          >
                            + Add line
                          </button>
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => saveAllocations(p)}
                            disabled={savingId === p.id}
                            aria-label={`Save allocations for ${p.name}`}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllocatingId(null)}
                            aria-label="Cancel allocation"
                            className="rounded-md px-3 py-1 text-xs text-slate-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
