import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetMonthDto, TransactionDto } from '../types'
import { formatMoney, fromAmount } from '../lib/money'
import { buildItemOptions, transactionTypeLabel } from '../lib/transactions'

export function TransactionsPage() {
  const { logout } = useAuth()
  const [transactions, setTransactions] = useState<TransactionDto[]>([])
  const [month, setMonth] = useState<BudgetMonthDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<TransactionDto[]>('/transactions'),
      api.get<BudgetMonthDto>('/budget/current').catch(() => null),
    ])
      .then(([tx, budget]) => {
        if (cancelled) return
        setTransactions(tx.data)
        setMonth(budget?.data ?? null)
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

  const optionGroups = buildItemOptions(month)

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
              <span className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800">
                Transactions
              </span>
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
          <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
          <p className="text-sm text-slate-500">
            Assign each transaction to a budget line — its spending then rolls up into that line.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading && <p className="text-slate-500">Loading…</p>}

        {!loading && transactions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            No transactions yet. Import a CAMT.053 statement from the Budget page.
          </div>
        )}

        {transactions.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Payee</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Assigned to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => {
                  const isIncome = transactionTypeLabel(t.type) === 'Income'
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 tabular-nums text-slate-500">{t.date}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{t.payee || '—'}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          isIncome ? 'text-emerald-600' : 'text-slate-700'
                        }`}
                      >
                        {isIncome ? '+' : '−'}
                        {formatMoney(fromAmount(t.amount), t.currency)}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={t.budgetItemId ?? ''}
                          disabled={savingId === t.id}
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
