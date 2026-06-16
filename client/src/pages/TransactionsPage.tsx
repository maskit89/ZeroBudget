import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Card } from '../components/ui'
import { api } from '../lib/api'
import type { AccountDto, BudgetMonthDto, TransactionDto } from '../types'
import { TransactionType } from '../types'
import { formatMoney, fromAmount, parseMinor, sumMinor, toAmount } from '../lib/money'
import { buildItemOptions, transactionTypeLabel } from '../lib/transactions'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionDto[]>([])
  const [month, setMonth] = useState<BudgetMonthDto | null>(null)
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add-transaction form state.
  const [date, setDate] = useState(today)
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<number>(TransactionType.Expense)
  const [assignTo, setAssignTo] = useState('')
  const [account, setAccount] = useState('')
  const [adding, setAdding] = useState(false)

  // Filters (client-side — the per-user list is small).
  const [search, setSearch] = useState('')
  const [unassignedOnly, setUnassignedOnly] = useState(false)

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eDate, setEDate] = useState('')
  const [ePayee, setEPayee] = useState('')
  const [eAmount, setEAmount] = useState('')
  const [eType, setEType] = useState<number>(TransactionType.Expense)
  const [eAccount, setEAccount] = useState('')

  // Split editor state.
  const [splittingId, setSplittingId] = useState<string | null>(null)
  const [splitRows, setSplitRows] = useState<{ budgetItemId: string; amount: string }[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<TransactionDto[]>('/transactions'),
      api.get<BudgetMonthDto>('/budget/current').catch(() => null),
      api.get<AccountDto[]>('/accounts').catch(() => null),
    ])
      .then(([tx, budget, acc]) => {
        if (cancelled) return
        setTransactions(tx.data)
        setMonth(budget?.data ?? null)
        setAccounts(Array.isArray(acc?.data) ? acc.data : [])
      })
      .catch(() => !cancelled && setError('Could not load transactions.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const assign = useCallback(async (id: string, budgetItemId: string | null) => {
    setSavingId(id)
    setError(null)
    try {
      const { data } = await api.put<TransactionDto>(`/transactions/${id}/assignment`, { budgetItemId })
      setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)))
    } catch {
      setError('Could not save that assignment.')
    } finally {
      setSavingId(null)
    }
  }, [])

  const addTransaction = useCallback(async () => {
    const minor = parseMinor(amount)
    if (minor === null || minor <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const { data } = await api.post<TransactionDto>('/transactions', {
        date,
        payee,
        amount: toAmount(minor),
        type,
        budgetItemId: assignTo || null,
        accountId: account || null,
      })
      setTransactions((prev) => [data, ...prev])
      setPayee('')
      setAmount('')
    } catch {
      setError('Could not add that transaction.')
    } finally {
      setAdding(false)
    }
  }, [date, payee, amount, type, assignTo, account])

  const removeTransaction = useCallback(async (id: string) => {
    setSavingId(id)
    setError(null)
    try {
      await api.delete(`/transactions/${id}`)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch {
      setError('Could not delete that transaction.')
    } finally {
      setSavingId(null)
    }
  }, [])

  function startEdit(t: TransactionDto) {
    setSplittingId(null)
    setEditingId(t.id)
    setEDate(t.date)
    setEPayee(t.payee)
    setEAmount(String(t.amount))
    setEType(t.type)
    setEAccount(t.accountId ?? '')
  }

  const saveEdit = useCallback(
    async (id: string) => {
      const minor = parseMinor(eAmount)
      if (minor === null || minor <= 0) {
        setError('Enter a valid amount greater than zero.')
        return
      }
      setSavingId(id)
      setError(null)
      try {
        const { data } = await api.put<TransactionDto>(`/transactions/${id}`, {
          date: eDate,
          payee: ePayee,
          amount: toAmount(minor),
          type: eType,
          accountId: eAccount || null,
        })
        setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)))
        setEditingId(null)
      } catch {
        setError('Could not save that change.')
      } finally {
        setSavingId(null)
      }
    },
    [eDate, ePayee, eAmount, eType, eAccount],
  )

  function startSplit(t: TransactionDto) {
    setEditingId(null)
    setSplittingId(t.id)
    if (t.isSplit && t.splits.length > 0) {
      setSplitRows(t.splits.map((s) => ({ budgetItemId: s.budgetItemId ?? '', amount: String(s.amount) })))
    } else {
      setSplitRows([
        { budgetItemId: t.budgetItemId ?? '', amount: '' },
        { budgetItemId: '', amount: '' },
      ])
    }
  }

  function cancelSplit() {
    setSplittingId(null)
    setSplitRows([])
  }

  const removeSplit = useCallback(
    async (id: string) => {
      await assign(id, null) // clearing the assignment drops the split server-side
      cancelSplit()
    },
    [assign],
  )

  function updateSplitRow(index: number, patch: Partial<{ budgetItemId: string; amount: string }>) {
    setSplitRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addSplitRow() {
    setSplitRows((rows) => [...rows, { budgetItemId: '', amount: '' }])
  }

  function removeSplitRow(index: number) {
    setSplitRows((rows) => (rows.length > 2 ? rows.filter((_, i) => i !== index) : rows))
  }

  const saveSplit = useCallback(
    async (t: TransactionDto) => {
      const parsed = splitRows.map((r) => ({ budgetItemId: r.budgetItemId, minor: parseMinor(r.amount) }))
      if (parsed.length < 2 || parsed.some((a) => !a.budgetItemId || a.minor === null || a.minor <= 0)) {
        setError('Give every split line a category and an amount greater than zero.')
        return
      }
      const allocatedMinor = sumMinor(parsed.map((a) => a.minor as number))
      if (allocatedMinor !== fromAmount(t.amount)) {
        setError('The split lines must add up to the transaction total.')
        return
      }
      setSavingId(t.id)
      setError(null)
      try {
        const { data } = await api.put<TransactionDto>(`/transactions/${t.id}/splits`, {
          allocations: parsed.map((a) => ({
            budgetItemId: a.budgetItemId,
            amount: toAmount(a.minor as number),
          })),
        })
        setTransactions((prev) => prev.map((x) => (x.id === t.id ? data : x)))
        cancelSplit()
      } catch {
        setError('Could not save that split.')
      } finally {
        setSavingId(null)
      }
    },
    [splitRows],
  )

  const optionGroups = buildItemOptions(month)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter(
      (t) =>
        (!unassignedOnly || t.budgetItemId === null) &&
        (q === '' || (t.payee ?? '').toLowerCase().includes(q)),
    )
  }, [transactions, search, unassignedOnly])

  return (
    <AppShell active="transactions">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Transactions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add what you’ve spent (or received) by hand, then assign each to a budget line — its
            spending rolls up into that line.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Add-transaction form (the manual "sheet" entry). */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Add a transaction</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Date
              <input
                type="date"
                value={date}
                aria-label="Transaction date"
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
              Payee
              <input
                type="text"
                value={payee}
                placeholder="e.g. Tesco"
                aria-label="Transaction payee"
                onChange={(e) => setPayee(e.target.value)}
                className="min-w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Amount
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                placeholder="0,00"
                aria-label="Transaction amount"
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTransaction()
                }}
                className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Type
              <select
                value={type}
                aria-label="Transaction type"
                onChange={(e) => setType(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value={TransactionType.Expense}>Expense</option>
                <option value={TransactionType.Income}>Income</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Assign to
              <select
                value={assignTo}
                aria-label="Assign transaction to"
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Unassigned</option>
                {optionGroups.map((g) => (
                  <optgroup key={g.category} label={g.category}>
                    {g.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {accounts.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Account
                <select
                  value={account}
                  aria-label="Transaction account"
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">No account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={addTransaction}
              disabled={adding}
              aria-label="Add transaction"
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </Card>

        {loading && <p className="text-slate-500">Loading…</p>}

        {!loading && transactions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-card">
            No transactions yet. Add one above, or import a CAMT.053 statement from the Budget page.
          </div>
        )}

        {transactions.length > 0 && (
          <>
            {/* Filter bar. */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={search}
                placeholder="Search payee…"
                aria-label="Search transactions"
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={unassignedOnly}
                  aria-label="Unassigned only"
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Unassigned only
              </label>
            </div>

            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Payee</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Assigned to</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No transactions match your filters.
                      </td>
                    </tr>
                  )}
                  {visible.map((t) => {
                    const isIncome = transactionTypeLabel(t.type) === 'Income'
                    const editing = editingId === t.id
                    const splitting = splittingId === t.id
                    const splitOptions = buildItemOptions(month, t.type)
                    const totalMinor = fromAmount(t.amount)
                    const allocatedMinor = sumMinor(splitRows.map((r) => parseMinor(r.amount) ?? 0))
                    const remainderMinor = totalMinor - allocatedMinor
                    return (
                      <Fragment key={t.id}>
                      <tr className="hover:bg-slate-50">
                        {editing ? (
                          <>
                            <td className="px-4 py-2">
                              <input
                                type="date"
                                value={eDate}
                                aria-label="Edit date"
                                onChange={(e) => setEDate(e.target.value)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={ePayee}
                                  aria-label="Edit payee"
                                  onChange={(e) => setEPayee(e.target.value)}
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                                />
                                {accounts.length > 0 && (
                                  <select
                                    value={eAccount}
                                    aria-label="Edit account"
                                    onChange={(e) => setEAccount(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600"
                                  >
                                    <option value="">No account</option>
                                    {accounts.map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={eAmount}
                                aria-label="Edit amount"
                                onChange={(e) => setEAmount(e.target.value)}
                                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={eType}
                                aria-label="Edit type"
                                onChange={(e) => setEType(Number(e.target.value))}
                                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                              >
                                <option value={TransactionType.Expense}>Expense</option>
                                <option value={TransactionType.Income}>Income</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(t.id)}
                                  disabled={savingId === t.id}
                                  aria-label="Save transaction"
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
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 tabular-nums text-slate-500">{t.date}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">
                              {t.payee || '—'}
                              {t.accountName && (
                                <span className="block text-xs font-normal text-slate-400">
                                  {t.accountName}
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                                isIncome ? 'text-emerald-600' : 'text-slate-700'
                              }`}
                            >
                              {isIncome ? '+' : '−'}
                              {formatMoney(fromAmount(t.amount), t.currency)}
                            </td>
                            <td className="px-4 py-2.5">
                              {t.isSplit ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">
                                    Split
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {t.splits
                                      .map(
                                        (s) =>
                                          `${s.budgetItemName ?? 'Unassigned'} ${formatMoney(
                                            fromAmount(s.amount),
                                            t.currency,
                                          )}`,
                                      )
                                      .join(' · ')}
                                  </span>
                                </div>
                              ) : (
                                <select
                                  value={t.budgetItemId ?? ''}
                                  disabled={savingId === t.id}
                                  aria-label={`Assign ${t.payee || 'transaction'}`}
                                  onChange={(e) => assign(t.id, e.target.value || null)}
                                  className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                >
                                  <option value="">Unassigned</option>
                                  {optionGroups.map((g) => (
                                    <optgroup key={g.category} label={g.category}>
                                      {g.items.map((i) => (
                                        <option key={i.id} value={i.id}>
                                          {i.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(t)}
                                  aria-label={`Edit transaction: ${t.payee || t.date}`}
                                  title="Edit transaction"
                                  className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startSplit(t)}
                                  aria-label={`Split transaction: ${t.payee || t.date}`}
                                  title="Split across budget lines"
                                  className="rounded-md px-2 py-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                                >
                                  ⑂
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeTransaction(t.id)}
                                  disabled={savingId === t.id}
                                  aria-label={`Delete transaction: ${t.payee || t.date}`}
                                  title="Delete transaction"
                                  className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                      {splitting && (
                        <tr className="bg-violet-50/40">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-700">
                                  Split “{t.payee || t.date}” ({formatMoney(totalMinor, t.currency)})
                                </h4>
                                <span
                                  aria-label="Remaining to allocate"
                                  className={`text-xs font-semibold tabular-nums ${
                                    remainderMinor === 0 ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {remainderMinor === 0
                                    ? 'Fully allocated'
                                    : `${formatMoney(remainderMinor, t.currency)} left`}
                                </span>
                              </div>

                              {splitOptions.length === 0 && (
                                <p className="text-xs text-rose-600">
                                  Add some {isIncome ? 'income' : 'expense'} budget lines first.
                                </p>
                              )}

                              {splitRows.map((row, index) => (
                                <div key={index} className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={row.budgetItemId}
                                    aria-label={`Split line ${index + 1} category`}
                                    onChange={(e) => updateSplitRow(index, { budgetItemId: e.target.value })}
                                    className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                  >
                                    <option value="">Choose a line…</option>
                                    {splitOptions.map((g) => (
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
                                    aria-label={`Split line ${index + 1} amount`}
                                    onChange={(e) => updateSplitRow(index, { amount: e.target.value })}
                                    className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                  />
                                  {splitRows.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => removeSplitRow(index)}
                                      aria-label={`Remove split line ${index + 1}`}
                                      title="Remove line"
                                      className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={addSplitRow}
                                  aria-label="Add split line"
                                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                                >
                                  + Add line
                                </button>
                                {t.isSplit && (
                                  <button
                                    type="button"
                                    onClick={() => removeSplit(t.id)}
                                    disabled={savingId === t.id}
                                    aria-label="Remove split"
                                    className="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    Remove split
                                  </button>
                                )}
                                <div className="flex-1" />
                                <button
                                  type="button"
                                  onClick={() => saveSplit(t)}
                                  disabled={savingId === t.id || remainderMinor !== 0}
                                  aria-label="Save split"
                                  className="rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                                >
                                  Save split
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelSplit}
                                  aria-label="Cancel split"
                                  className="rounded-md px-3 py-1 text-xs text-slate-500 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </>
        )}
    </AppShell>
  )
}
