import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Button, Card, Input, Select } from '../components/ui'
import { api } from '../lib/api'
import type { AccountDto } from '../types'
import { ACCOUNT_TYPE_LABELS, AccountType } from '../types'
import { formatMoney, fromAmount, parseMinor, toAmount, toEditString } from '../lib/money'

// ZeroBudget runs as a single-currency app today (the multi-currency engine is kept
// dormant in the backend for future expansion). All money is shown in euros.
const CURRENCY = 'EUR'

const TYPE_OPTIONS = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}))

/** Parse a possibly-negative amount string into a wire decimal; '' → 0; null when invalid. */
function parseSignedAmount(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  const negative = trimmed.startsWith('-')
  const magnitude = parseMinor(negative ? trimmed.slice(1) : trimmed)
  if (magnitude === null) return null
  return toAmount(negative ? -magnitude : magnitude)
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add-account form.
  const [name, setName] = useState('')
  const [type, setType] = useState<number>(AccountType.Current)
  const [opening, setOpening] = useState('')
  const [adding, setAdding] = useState(false)

  // Inline edit.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eType, setEType] = useState<number>(AccountType.Current)
  const [eOpening, setEOpening] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<AccountDto[]>('/accounts')
      .then(({ data }) => !cancelled && setAccounts(data))
      .catch(() => !cancelled && setError('Could not load your accounts.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const addAccount = useCallback(async () => {
    if (name.trim() === '') {
      setError('Give the account a name.')
      return
    }
    const openingBalance = parseSignedAmount(opening)
    if (openingBalance === null) {
      setError('Enter a valid opening balance.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const { data } = await api.post<AccountDto>('/accounts', {
        name: name.trim(),
        type,
        currency: CURRENCY,
        openingBalance,
      })
      setAccounts((prev) => [...prev, data])
      setName('')
      setOpening('')
    } catch {
      setError('Could not add that account.')
    } finally {
      setAdding(false)
    }
  }, [name, type, opening])

  function startEdit(a: AccountDto) {
    setEditingId(a.id)
    setEName(a.name)
    setEType(a.type)
    setEOpening(toEditString(fromAmount(a.openingBalance)))
  }

  const saveEdit = useCallback(
    async (id: string) => {
      if (eName.trim() === '') {
        setError('Give the account a name.')
        return
      }
      const openingBalance = parseSignedAmount(eOpening)
      if (openingBalance === null) {
        setError('Enter a valid opening balance.')
        return
      }
      setSavingId(id)
      setError(null)
      try {
        const { data } = await api.put<AccountDto>(`/accounts/${id}`, {
          name: eName.trim(),
          type: eType,
          openingBalance,
        })
        setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)))
        setEditingId(null)
      } catch {
        setError('Could not save that account.')
      } finally {
        setSavingId(null)
      }
    },
    [eName, eType, eOpening],
  )

  const remove = useCallback(async (id: string) => {
    setSavingId(id)
    setError(null)
    try {
      await api.delete(`/accounts/${id}`)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError('Could not delete that account.')
    } finally {
      setSavingId(null)
    }
  }, [])

  // Net balance across all accounts (single-currency).
  const netMinor = useMemo(
    () => accounts.reduce((sum, a) => sum + fromAmount(a.currentBalance), 0),
    [accounts],
  )

  return (
    <AppShell active="accounts">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Where your money actually sits. Each balance is your opening balance plus every transaction
            assigned to the account — so the register stays the source of truth.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Add-account form. */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Add an account</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
              Name
              <Input
                type="text"
                value={name}
                placeholder="e.g. Everyday current"
                aria-label="Account name"
                onChange={(e) => setName(e.target.value)}
                className="min-w-32"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Type
              <Select
                value={type}
                aria-label="Account type"
                onChange={(e) => setType(Number(e.target.value))}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Opening balance
              <Input
                type="text"
                inputMode="decimal"
                value={opening}
                placeholder="0,00"
                aria-label="Opening balance"
                onChange={(e) => setOpening(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addAccount()
                }}
                className="w-32 text-right tabular-nums"
              />
            </label>
            <Button onClick={addAccount} disabled={adding} aria-label="Add account">
              Add
            </Button>
          </div>
        </Card>

        {loading && <p className="text-slate-500">Loading…</p>}

        {!loading && accounts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-card">
            No accounts yet. Add one above, then tag transactions to it to track its balance.
          </div>
        )}

        {accounts.length > 0 && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Opening</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((a) => {
                  const editing = editingId === a.id
                  const balanceMinor = fromAmount(a.currentBalance)
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      {editing ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={eName}
                              aria-label={`Name for ${a.name}`}
                              onChange={(e) => setEName(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={eType}
                              aria-label={`Type for ${a.name}`}
                              onChange={(e) => setEType(Number(e.target.value))}
                              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={eOpening}
                              aria-label={`Opening balance for ${a.name}`}
                              onChange={(e) => setEOpening(e.target.value)}
                              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                            />
                          </td>
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => saveEdit(a.id)}
                                disabled={savingId === a.id}
                                aria-label={`Save ${a.name}`}
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
                          <td className="px-4 py-2.5 font-medium text-slate-700">{a.name}</td>
                          <td className="px-4 py-2.5 text-slate-500">{ACCOUNT_TYPE_LABELS[a.type] ?? 'Other'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                            {formatMoney(fromAmount(a.openingBalance), CURRENCY)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                              balanceMinor < 0 ? 'text-rose-600' : 'text-slate-800'
                            }`}
                          >
                            {formatMoney(balanceMinor, CURRENCY)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(a)}
                                aria-label={`Edit ${a.name}`}
                                title="Edit account"
                                className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(a.id)}
                                disabled={savingId === a.id}
                                aria-label={`Delete ${a.name}`}
                                title="Delete account"
                                className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold text-slate-800">
                  <td className="px-4 py-2" colSpan={3}>
                    Net
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      netMinor < 0 ? 'text-rose-600' : 'text-slate-800'
                    }`}
                  >
                    {formatMoney(netMinor, CURRENCY)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
    </AppShell>
  )
}
