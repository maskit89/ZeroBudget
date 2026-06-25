import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Select } from '../components/ui'
import { MembersIcon } from '../components/icons'
import { api } from '../lib/api'
import { EVENTS, track } from '../analytics'
import type { AccountDto, HouseholdMemberDto, MemberSpendingDto } from '../types'
import { formatMoney, fromAmount, parseMinor, toAmount, toEditString } from '../lib/money'

const CURRENCY = 'EUR'

/** Parse a non-negative amount string into a wire decimal; '' → 0; null when invalid. */
function parseAmount(input: string): number | null {
  if (input.trim() === '') return 0
  const minor = parseMinor(input)
  return minor === null ? null : toAmount(minor)
}

function sharePct(share: number): string {
  return `${(share * 100).toFixed(1)}%`
}

export function MembersPage() {
  const [members, setMembers] = useState<HouseholdMemberDto[]>([])
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [spending, setSpending] = useState<MemberSpendingDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add form.
  const [name, setName] = useState('')
  const [income, setIncome] = useState('')
  const [savings, setSavings] = useState('')
  const [adding, setAdding] = useState(false)

  // Inline edit.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eIncome, setEIncome] = useState('')
  const [eSavings, setESavings] = useState('')

  const reload = useCallback(async () => {
    const { data } = await api.get<HouseholdMemberDto[]>('/members')
    setMembers(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<HouseholdMemberDto[]>('/members'),
      api.get<AccountDto[]>('/accounts').catch(() => ({ data: [] })),
      api.get<MemberSpendingDto[]>('/members/spending').catch(() => ({ data: [] })),
    ])
      .then(([m, acc, spend]) => {
        if (cancelled) return
        setMembers(m.data)
        setAccounts(Array.isArray(acc?.data) ? acc.data : [])
        setSpending(Array.isArray(spend?.data) ? spend.data : [])
      })
      .catch(() => !cancelled && setError('Could not load household members.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  function accountName(id: string | null): string {
    if (!id) return '—'
    return accounts.find((a) => a.id === id)?.name ?? '—'
  }

  function memberSpent(id: string): number {
    return spending.find((s) => s.memberId === id)?.spent ?? 0
  }

  const addMember = useCallback(async () => {
    if (name.trim() === '') {
      setError('Give the member a name.')
      return
    }
    const netMonthlyIncome = parseAmount(income)
    if (netMonthlyIncome === null) {
      setError('Enter a valid monthly income.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await api.post<HouseholdMemberDto>('/members', {
        name: name.trim(),
        netMonthlyIncome,
        personalSavingsAccountId: savings || null,
      })
      track(EVENTS.memberAdded)
      await reload() // income shares shift when a member is added
      setName('')
      setIncome('')
      setSavings('')
    } catch {
      setError('Could not add that member.')
    } finally {
      setAdding(false)
    }
  }, [name, income, savings, reload])

  function startEdit(m: HouseholdMemberDto) {
    setEditingId(m.id)
    setEName(m.name)
    setEIncome(toEditString(fromAmount(m.netMonthlyIncome)))
    setESavings(m.personalSavingsAccountId ?? '')
  }

  const saveEdit = useCallback(
    async (id: string) => {
      if (eName.trim() === '') {
        setError('Give the member a name.')
        return
      }
      const netMonthlyIncome = parseAmount(eIncome)
      if (netMonthlyIncome === null) {
        setError('Enter a valid monthly income.')
        return
      }
      setSavingId(id)
      setError(null)
      try {
        await api.put<HouseholdMemberDto>(`/members/${id}`, {
          name: eName.trim(),
          netMonthlyIncome,
          personalSavingsAccountId: eSavings || null,
        })
        track(EVENTS.memberEdited)
        await reload()
        setEditingId(null)
      } catch {
        setError('Could not save that member.')
      } finally {
        setSavingId(null)
      }
    },
    [eName, eIncome, eSavings, reload],
  )

  const archive = useCallback(
    async (id: string) => {
      setSavingId(id)
      setError(null)
      try {
        await api.put(`/members/${id}/archive`, { archived: true })
        await reload()
      } catch {
        setError('Could not archive that member.')
      } finally {
        setSavingId(null)
      }
    },
    [reload],
  )

  return (
    <AppShell active="members">
      <PageHeader
        title="Household members"
        subtitle="The people who share this budget. Their net incomes set how shared costs and the monthly surplus are split; the savings account is where their allocated surplus lands."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a member</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
            Name
            <Input
              type="text"
              value={name}
              placeholder="e.g. Chris"
              aria-label="Member name"
              onChange={(e) => setName(e.target.value)}
              className="min-w-32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Net monthly income
            <Input
              type="text"
              inputMode="decimal"
              value={income}
              placeholder="0,00"
              aria-label="Net monthly income"
              onChange={(e) => setIncome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addMember()
              }}
              className="w-36 text-right tabular-nums"
            />
          </label>
          {accounts.length > 0 && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Savings account
              <Select
                value={savings}
                aria-label="Savings account"
                onChange={(e) => setSavings(e.target.value)}
                className="w-40"
              >
                <option value="">None</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <Button onClick={addMember} disabled={adding} aria-label="Add member">
            Add
          </Button>
        </div>
      </Card>

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && members.length === 0 && (
        <EmptyState
          icon={<MembersIcon className="h-6 w-6" />}
          title="No members yet"
          description="Add the people who share this budget — their incomes drive how the surplus is split."
        />
      )}

      {members.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 text-right font-medium">Net monthly income</th>
                <th className="px-4 py-2 text-right font-medium">Income share</th>
                <th className="px-4 py-2 text-right font-medium">Spent</th>
                <th className="px-4 py-2 font-medium">Savings</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const editing = editingId === m.id
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    {editing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={eName}
                            aria-label={`Name for ${m.name}`}
                            onChange={(e) => setEName(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={eIncome}
                            aria-label={`Net monthly income for ${m.name}`}
                            onChange={(e) => setEIncome(e.target.value)}
                            className="w-32 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{sharePct(m.incomeSharePct)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                          {formatMoney(fromAmount(memberSpent(m.id)), CURRENCY)}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={eSavings}
                            aria-label={`Savings account for ${m.name}`}
                            onChange={(e) => setESavings(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600"
                          >
                            <option value="">None</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(m.id)}
                              disabled={savingId === m.id}
                              aria-label={`Save ${m.name}`}
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
                        <td className="px-4 py-2.5 font-medium text-slate-700">{m.name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                          {formatMoney(fromAmount(m.netMonthlyIncome), CURRENCY)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{sharePct(m.incomeSharePct)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                          {formatMoney(fromAmount(memberSpent(m.id)), CURRENCY)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{accountName(m.personalSavingsAccountId)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(m)}
                              aria-label={`Edit ${m.name}`}
                              title="Edit member"
                              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => archive(m.id)}
                              disabled={savingId === m.id}
                              aria-label={`Archive ${m.name}`}
                              title="Archive member"
                              className="rounded-md px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
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
          </table>
        </Card>
      )}
    </AppShell>
  )
}
