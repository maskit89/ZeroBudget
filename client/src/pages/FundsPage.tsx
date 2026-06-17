import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Select } from '../components/ui'
import { FundsIcon } from '../components/icons'
import { api } from '../lib/api'
import type { SinkingFundDto } from '../types'
import {
  AccrualMethod,
  ACCRUAL_METHOD_LABELS,
  FundKind,
  FUND_KIND_LABELS,
} from '../types'
import { formatMoney, fromAmount, parseMinor, toAmount, toEditString } from '../lib/money'

const CURRENCY = 'EUR'

const KIND_OPTIONS = Object.entries(FUND_KIND_LABELS).map(([value, label]) => ({ value: Number(value), label }))
const ACCRUAL_OPTIONS = Object.entries(ACCRUAL_METHOD_LABELS).map(([value, label]) => ({ value: Number(value), label }))

// Status → Badge tone and human label. Brand reads as "good" (it's the emerald ramp).
const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'rose' | 'amber'> = {
  FullyFunded: 'brand',
  OnTrack: 'brand',
  Behind: 'amber',
  Overspent: 'rose',
  Unfunded: 'neutral',
}
const STATUS_LABEL: Record<string, string> = {
  FullyFunded: 'Fully funded',
  OnTrack: 'On track',
  Behind: 'Behind',
  Overspent: 'Overspent',
  Unfunded: 'No target',
}
// Progress-bar fill colour by status (the bar is decorative; meaning is in the badge/text).
const STATUS_BAR: Record<string, string> = {
  FullyFunded: 'bg-brand-600',
  OnTrack: 'bg-brand-600',
  Behind: 'bg-amber-500',
  Overspent: 'bg-rose-500',
  Unfunded: 'bg-slate-300',
}

/** Parse a non-negative amount string into a wire decimal; '' → 0; null when invalid. */
function parseAmount(input: string): number | null {
  if (input.trim() === '') return 0
  const minor = parseMinor(input)
  return minor === null ? null : toAmount(minor)
}

interface FormState {
  name: string
  kind: number
  target: string
  targetDate: string
  accrual: number
  opening: string
  recurAnnually: boolean
}

const BLANK_FORM: FormState = {
  name: '',
  kind: FundKind.Annual,
  target: '',
  targetDate: '',
  accrual: AccrualMethod.TargetByDate,
  opening: '',
  recurAnnually: false,
}

export function FundsPage() {
  const [funds, setFunds] = useState<SinkingFundDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<SinkingFundDto[]>('/sinkingfunds')
      .then(({ data }) => !cancelled && setFunds(data))
      .catch(() => !cancelled && setError('Could not load your sinking funds.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm(BLANK_FORM)
  }, [])

  const submit = useCallback(async () => {
    if (form.name.trim() === '') {
      setError('Give the fund a name.')
      return
    }
    const targetAmount = parseAmount(form.target)
    const openingBalance = parseAmount(form.opening)
    if (targetAmount === null || openingBalance === null) {
      setError('Enter valid amounts.')
      return
    }

    const body = {
      name: form.name.trim(),
      kind: form.kind,
      targetAmount,
      targetDate: form.targetDate || null,
      coverStart: null,
      coverEnd: null,
      accrual: form.accrual,
      recurAnnually: form.recurAnnually,
      openingBalance,
      openingAsOf: null,
      fundingAccountId: null,
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const { data } = await api.put<SinkingFundDto>(`/sinkingfunds/${editingId}`, body)
        setFunds((prev) => prev.map((f) => (f.id === editingId ? data : f)))
      } else {
        const { data } = await api.post<SinkingFundDto>('/sinkingfunds', body)
        setFunds((prev) => [...prev, data])
      }
      resetForm()
    } catch {
      setError(editingId ? 'Could not save that fund.' : 'Could not add that fund.')
    } finally {
      setSaving(false)
    }
  }, [form, editingId, resetForm])

  function startEdit(f: SinkingFundDto) {
    setEditingId(f.id)
    setForm({
      name: f.name,
      kind: f.kind,
      target: toEditString(fromAmount(f.targetAmount)),
      targetDate: f.targetDate ?? '',
      accrual: f.accrual,
      opening: toEditString(fromAmount(f.openingBalance)),
      recurAnnually: f.recurAnnually,
    })
  }

  const archive = useCallback(async (f: SinkingFundDto) => {
    setSaving(true)
    setError(null)
    try {
      await api.put(`/sinkingfunds/${f.id}/archive`, { archived: true })
      setFunds((prev) => prev.filter((x) => x.id !== f.id))
    } catch {
      setError('Could not archive that fund.')
    } finally {
      setSaving(false)
    }
  }, [])

  return (
    <AppShell active="funds">
      <PageHeader
        title="Sinking funds"
        subtitle="Save a little each month toward irregular and future costs. Each fund tracks its balance, the contribution it needs, and whether it's on pace for its target date."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Add / edit form. */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {editingId ? 'Edit fund' : 'Add a fund'}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
            Name
            <Input
              type="text"
              value={form.name}
              placeholder="e.g. Home insurance"
              aria-label="Fund name"
              onChange={(e) => set('name', e.target.value)}
              className="min-w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Kind
            <Select value={form.kind} aria-label="Fund kind" onChange={(e) => set('kind', Number(e.target.value))}>
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Target
            <Input
              type="text"
              inputMode="decimal"
              value={form.target}
              placeholder="0,00"
              aria-label="Target amount"
              onChange={(e) => set('target', e.target.value)}
              className="w-28 text-right tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Target date
            <Input
              type="date"
              value={form.targetDate}
              aria-label="Target date"
              onChange={(e) => set('targetDate', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Accrual
            <Select value={form.accrual} aria-label="Accrual method" onChange={(e) => set('accrual', Number(e.target.value))}>
              {ACCRUAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Saved so far
            <Input
              type="text"
              inputMode="decimal"
              value={form.opening}
              placeholder="0,00"
              aria-label="Opening balance"
              onChange={(e) => set('opening', e.target.value)}
              className="w-28 text-right tabular-nums"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.recurAnnually}
              aria-label="Renews each year"
              onChange={(e) => set('recurAnnually', e.target.checked)}
              className="h-4 w-4 rounded border-slate-400"
            />
            Renews yearly
          </label>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving} aria-label={editingId ? 'Save fund' : 'Add fund'}>
              {editingId ? 'Save' : 'Add'}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={resetForm} aria-label="Cancel edit">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && funds.length === 0 && (
        <EmptyState
          icon={<FundsIcon className="h-6 w-6" />}
          title="No sinking funds yet"
          description="Add one above — give it a target and a date, and we'll work out what to set aside each month."
        />
      )}

      {funds.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((f) => (
            <FundCard key={f.id} fund={f} onEdit={() => startEdit(f)} onArchive={() => archive(f)} disabled={saving} />
          ))}
        </div>
      )}
    </AppShell>
  )
}

function FundCard({
  fund,
  onEdit,
  onArchive,
  disabled,
}: {
  fund: SinkingFundDto
  onEdit: () => void
  onArchive: () => void
  disabled: boolean
}) {
  const balanceMinor = fromAmount(fund.currentBalance)
  const targetMinor = fromAmount(fund.targetAmount)
  const pct = targetMinor > 0 ? Math.min(100, Math.max(0, Math.round((balanceMinor / targetMinor) * 100))) : 0
  const tone = STATUS_TONE[fund.status] ?? 'neutral'
  const barColor = STATUS_BAR[fund.status] ?? 'bg-slate-300'

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{fund.name}</h3>
        <Badge tone={tone}>{STATUS_LABEL[fund.status] ?? fund.status}</Badge>
      </div>

      {/* Thermometer. */}
      <div
        role="progressbar"
        aria-label={`${fund.name} funding progress`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="text-sm text-slate-600">
        <span className="font-semibold tabular-nums text-slate-800">{formatMoney(balanceMinor, CURRENCY)}</span>
        {targetMinor > 0 && (
          <>
            {' '}of <span className="tabular-nums">{formatMoney(targetMinor, CURRENCY)}</span>
          </>
        )}
      </p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
        <dt>Monthly</dt>
        <dd className="text-right font-medium tabular-nums text-slate-700">
          {formatMoney(fromAmount(fund.requiredMonthlyContribution), CURRENCY)}
        </dd>
        {fund.targetDate && (
          <>
            <dt>Target date</dt>
            <dd className="text-right tabular-nums text-slate-700">{fund.targetDate}</dd>
          </>
        )}
        {fund.projectedFullyFundedDate && (
          <>
            <dt>Funded by</dt>
            <dd className="text-right tabular-nums text-slate-700">{fund.projectedFullyFundedDate}</dd>
          </>
        )}
      </dl>

      <div className="mt-auto flex justify-end gap-1 pt-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${fund.name}`}
          title="Edit fund"
          className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={disabled}
          aria-label={`Archive ${fund.name}`}
          title="Archive fund"
          className="rounded-md px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </Card>
  )
}
