import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Select, SegmentedControl } from '../components/ui'
import { AllocationIcon } from '../components/icons'
import { useAuth } from '../auth/AuthContext'
import { useHousehold } from '../features/HouseholdContext'
import { api } from '../lib/api'
import { bucketCount, EVENTS, track } from '../analytics'
import type { AccountDto, AllocationProfileDto, AllocationResultDto, BudgetMonthDto } from '../types'
import { AllocationRuleType, ALLOCATION_RULE_LABELS, SplitMethod } from '../types'
import { formatMoney, fromAmount, parseMinor, toAmount, toEditString } from '../lib/money'

interface RuleSpec {
  order: number
  type: number
  split: number
  fixedAmountPerMember: number
}

function standardRules(costSplit: number, pocketAmount: number, savingsSplit: number): RuleSpec[] {
  return [
    { order: 0, type: AllocationRuleType.FundEnvelopes, split: costSplit, fixedAmountPerMember: 0 },
    { order: 1, type: AllocationRuleType.FundSinkingFunds, split: costSplit, fixedAmountPerMember: 0 },
    { order: 2, type: AllocationRuleType.FixedPerMember, split: SplitMethod.Equal, fixedAmountPerMember: pocketAmount },
    { order: 3, type: AllocationRuleType.SplitRemainderToMembers, split: savingsSplit, fixedAmountPerMember: 0 },
  ]
}

export function AllocationPage() {
  // Editing the allocation profile needs Admin+; running an allocation is day-to-day (Limited+).
  const { canWrite, canEnterData, preferredCurrency } = useAuth()
  const { isShared, loading: householdLoading } = useHousehold()
  const navigate = useNavigate()
  const CURRENCY = preferredCurrency
  const [profile, setProfile] = useState<AllocationProfileDto | null>(null)
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [preview, setPreview] = useState<AllocationResultDto | null>(null)
  const [period, setPeriod] = useState<{ year: number; month: number }>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState<number | null>(null)

  // Setup/edit form.
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [pocket, setPocket] = useState('')
  const [split, setSplit] = useState<number>(SplitMethod.Equal)
  const [savingsSplit, setSavingsSplit] = useState<number>(SplitMethod.BalanceTilt)
  const [lean, setLean] = useState('25')

  const loadPreview = useCallback(async (year: number, month: number) => {
    try {
      const { data } = await api.get<AllocationResultDto>(`/allocation/preview/${year}/${month}`)
      setPreview(data)
    } catch {
      setError('Could not compute the allocation preview.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<AllocationProfileDto | null>('/allocation/profile').catch(() => ({ data: null })),
      api.get<AccountDto[]>('/accounts').catch(() => ({ data: [] })),
      api.get<BudgetMonthDto>('/budget/current').catch(() => null),
    ])
      .then(async ([prof, acc, budget]) => {
        if (cancelled) return
        const p = prof?.data ?? null
        setProfile(p)
        setAccounts(Array.isArray(acc?.data) ? acc.data : [])
        const year = budget?.data?.year ?? period.year
        const month = budget?.data?.month ?? period.month
        setPeriod({ year, month })
        if (p) {
          setSourceAccountId(p.sourceAccountId ?? '')
          const pocketRule = p.rules.find((r) => r.type === AllocationRuleType.FixedPerMember)
          setPocket(pocketRule ? toEditString(fromAmount(pocketRule.fixedAmountPerMember)) : '')
          const fundRule = p.rules.find((r) => r.type === AllocationRuleType.FundEnvelopes)
          setSplit(fundRule?.split ?? SplitMethod.Equal)
          const savingsRule = p.rules.find((r) => r.type === AllocationRuleType.SplitRemainderToMembers)
          setSavingsSplit(savingsRule?.split ?? SplitMethod.BalanceTilt)
          setLean(String(p.balanceLeanPercent ?? 25))
          await loadPreview(year, month)
        }
      })
      .catch(() => !cancelled && setError('Could not load the allocation setup.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveProfile = useCallback(async () => {
    const pocketAmount = pocket.trim() === '' ? 0 : parseMinor(pocket)
    if (pocketAmount === null) {
      setError('Enter a valid pocket-money amount.')
      return
    }
    const leanValue = lean.trim() === '' ? 25 : Number.parseInt(lean, 10)
    if (Number.isNaN(leanValue) || leanValue < 0 || leanValue > 100) {
      setError('Balance lean must be a whole number between 0 and 100.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { data } = await api.put<AllocationProfileDto>('/allocation/profile', {
        id: profile?.id ?? null,
        name: profile?.name ?? 'Household allocation',
        sourceAccountId: sourceAccountId || null,
        balanceLeanPercent: leanValue,
        rules: standardRules(split, toAmount(pocketAmount as number), savingsSplit),
      })
      setProfile(data)
      track(EVENTS.allocationPreviewed, { split })
      await loadPreview(period.year, period.month)
    } catch {
      setError('Could not save the allocation profile.')
    } finally {
      setBusy(false)
    }
  }, [pocket, lean, split, savingsSplit, sourceAccountId, profile, period, loadPreview])

  const commit = useCallback(async () => {
    setBusy(true)
    setError(null)
    setCommitted(null)
    try {
      const { data } = await api.post<AllocationResultDto>(`/allocation/commit/${period.year}/${period.month}`, {})
      setPreview(data)
      setCommitted(data.transfersCreated)
      track(EVENTS.allocationCommitted, { count_bucket: bucketCount(data.transfersCreated) })
    } catch {
      setError('Could not commit the allocation. Check the source account and members’ savings accounts are set.')
    } finally {
      setBusy(false)
    }
  }, [period])

  const monthLabel = useMemo(
    () => new Date(period.year, period.month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    [period],
  )

  // Allocation only makes sense once the budget is shared. A solo user who reaches
  // this route directly gets a friendly nudge to add members rather than an empty engine.
  if (!householdLoading && !isShared) {
    return (
      <AppShell active="allocation">
        <PageHeader
          title="Income allocation"
          subtitle="Pool everyone’s income, cover the shared costs, then split what’s left into each person’s savings."
        />
        <EmptyState
          icon={<AllocationIcon className="h-6 w-6" />}
          title="Add people first"
          description="Allocation pools everyone’s income and divides the surplus into each person’s savings, so it needs the people you share money with. Add them to set this up."
        >
          <Button onClick={() => navigate('/people')}>Add people</Button>
        </EmptyState>
      </AppShell>
    )
  }

  return (
    <AppShell active="allocation">
      <PageHeader
        title="Income allocation"
        subtitle="Pool everyone’s income, cover the shared costs, then split what’s left into each person’s savings — previewed before anything moves."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && (
        <>
          {/* Setup / settings. Editing the profile is Admin+. */}
          {canWrite && (
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              {profile ? 'Allocation settings' : 'Set up allocation'}
            </h2>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Pay shared costs from
                <Select
                  value={sourceAccountId}
                  aria-label="Source account"
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-48"
                >
                  <option value="">Choose an account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Pocket money (each)
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pocket}
                  placeholder="0,00"
                  aria-label="Pocket money per member"
                  onChange={(e) => setPocket(e.target.value)}
                  className="w-32 text-right tabular-nums"
                />
              </label>
              <div className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Split shared costs
                <SegmentedControl
                  value={String(split)}
                  ariaLabel="Split method"
                  onChange={(v) => setSplit(Number(v))}
                  options={[
                    { value: String(SplitMethod.Equal), label: 'Equally' },
                    { value: String(SplitMethod.ByIncomeRatio), label: 'By income' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Send savings to
                <SegmentedControl
                  value={String(savingsSplit)}
                  ariaLabel="Savings split method"
                  onChange={(v) => setSavingsSplit(Number(v))}
                  options={[
                    { value: String(SplitMethod.BalanceTilt), label: 'Balance' },
                    { value: String(SplitMethod.Equal), label: 'Equally' },
                    { value: String(SplitMethod.ByIncomeRatio), label: 'By income' },
                  ]}
                />
              </div>
              {savingsSplit === SplitMethod.BalanceTilt && (
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                  Balance lean (0–100)
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={lean}
                    placeholder="25"
                    aria-label="Balance lean percent"
                    onChange={(e) => setLean(e.target.value)}
                    className="w-24 text-right tabular-nums"
                  />
                </label>
              )}
              <Button onClick={saveProfile} disabled={busy} aria-label="Save allocation settings">
                {profile ? 'Save' : 'Set up'}
              </Button>
            </div>
          </Card>
          )}

          {!profile && (
            <EmptyState
              icon={<AllocationIcon className="h-6 w-6" />}
              title="No allocation set up yet"
              description="Choose where shared costs come from and how to split them, then save — we’ll show you the monthly breakdown."
            />
          )}

          {profile && preview && (
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{monthLabel}</h2>
                  <p className="text-sm text-slate-500">
                    Pool{' '}
                    <span className="font-semibold tabular-nums text-slate-800">
                      {formatMoney(fromAmount(preview.pool), CURRENCY)}
                    </span>{' '}
                    net income
                  </p>
                </div>
                {canEnterData && (
                  <Button onClick={commit} disabled={busy} aria-label="Commit allocation">
                    Allocate {monthLabel}
                  </Button>
                )}
              </div>

              {committed !== null && (
                <div
                  role="status"
                  className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
                >
                  Allocated — created {committed} savings transfer{committed === 1 ? '' : 's'}.
                </div>
              )}

              {/* The waterfall: each step and its per-member split (the provenance). */}
              <ol className="space-y-2">
                {preview.steps.map((step, i) => {
                  const terminal = step.type === AllocationRuleType.SplitRemainderToMembers
                  return (
                    <li
                      key={i}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                        terminal ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone={terminal ? 'brand' : 'neutral'}>{ALLOCATION_RULE_LABELS[step.type] ?? 'Step'}</Badge>
                        <span className="text-sm font-medium text-slate-700">
                          {terminal ? 'to savings' : formatMoney(fromAmount(step.total), CURRENCY)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {step.perMember.map((m) => (
                          <span key={m.memberId} className="tabular-nums">
                            {m.name} {terminal ? '+' : '−'}
                            {formatMoney(fromAmount(m.amount), CURRENCY)}
                          </span>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ol>

              {/* Each member's surplus → their savings. */}
              <div className="grid gap-3 sm:grid-cols-2">
                {preview.members.map((m) => (
                  <div key={m.memberId} className="rounded-xl border border-slate-200/70 p-3">
                    <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Savings {formatMoney(fromAmount(m.savingsBalance), CURRENCY)} → saves
                    </p>
                    <p
                      className={`text-xl font-bold tabular-nums ${
                        m.residual < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-brand-700 dark:text-brand-200'
                      }`}
                    >
                      {formatMoney(fromAmount(m.residual), CURRENCY)}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500">
                      New balance {formatMoney(fromAmount(m.savingsBalance + m.residual), CURRENCY)}
                    </p>
                    {!m.savingsAccountId && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        No savings account set — won’t transfer on commit.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </AppShell>
  )
}
