import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetMonthDto, BudgetTrendsDto } from '../types'
import { formatMoney, fromAmount, type Minor } from '../lib/money'

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const monthLabel = (year: number, month: number) => `${SHORT_MONTHS[month - 1]} ${year}`

interface CategorySpend {
  id: string
  name: string
  kind: string
  spentMinor: Minor
}

export function ReportsPage() {
  const { logout } = useAuth()
  const [trends, setTrends] = useState<BudgetTrendsDto | null>(null)
  const [latest, setLatest] = useState<BudgetMonthDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<BudgetTrendsDto>('/reports/trends?months=6')
      .then(async ({ data }) => {
        if (cancelled) return
        setTrends(data)
        // The most recent point is the latest budget — load it for the breakdown.
        const last = data.points.at(-1)
        if (last) {
          const { data: month } = await api.get<BudgetMonthDto>(`/budget/${last.year}/${last.month}`)
          if (!cancelled) setLatest(month)
        }
      })
      .catch(() => !cancelled && setError('Could not load your reports.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const currency = latest?.baseCurrency ?? 'EUR'

  // Scale the income-vs-spending bars to the largest value in the window.
  const trendMaxMinor = useMemo(() => {
    if (!trends) return 0
    return trends.points.reduce(
      (max, p) => Math.max(max, fromAmount(p.income), fromAmount(p.spent)),
      0,
    )
  }, [trends])

  // Spending by category for the latest month (non-income groups, biggest first).
  const categorySpend = useMemo<CategorySpend[]>(() => {
    if (!latest) return []
    return latest.categories
      .filter((c) => c.kind !== 'Income')
      .map((c) => ({ id: c.id, name: c.name, kind: c.kind, spentMinor: fromAmount(c.totalActual) }))
      .filter((c) => c.spentMinor > 0)
      .sort((a, b) => b.spentMinor - a.spentMinor)
  }, [latest])

  const categoryTotalMinor = categorySpend.reduce((s, c) => s + c.spentMinor, 0)
  const categoryMaxMinor = categorySpend.reduce((m, c) => Math.max(m, c.spentMinor), 0)

  const hasData = trends !== null && trends.points.length > 0
  const totalIncomeMinor = trends ? fromAmount(trends.totalIncome) : 0
  const totalSpentMinor = trends ? fromAmount(trends.totalSpent) : 0
  const netMinor = totalIncomeMinor - totalSpentMinor

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
              <Link to="/" className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100">
                Budget
              </Link>
              <Link
                to="/transactions"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Transactions
              </Link>
              <span className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800">
                Reports
              </span>
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

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reports</h2>
          <p className="text-sm text-slate-500">
            How your spending and income have tracked over your most recent months.
          </p>
        </div>

        {loading && <p className="text-slate-500">Loading your reports…</p>}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && !hasData && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            No budget data yet. Once you’ve built a budget or two, your trends will appear here.
          </div>
        )}

        {!loading && hasData && trends && (
          <>
            {/* Window summary. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard label="Income (budgeted)" minor={totalIncomeMinor} currency={currency} tone="income" />
              <SummaryCard label="Spent" minor={totalSpentMinor} currency={currency} tone="spent" />
              <SummaryCard label="Net" minor={netMinor} currency={currency} tone="net" />
            </div>

            {/* Income vs spending per month. */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Income vs spending</h3>
              <div className="space-y-4">
                {trends.points.map((p) => {
                  const incomeMinor = fromAmount(p.income)
                  const spentMinor = fromAmount(p.spent)
                  const overspent = spentMinor > incomeMinor
                  return (
                    <div key={p.key} aria-label={`Trend for ${monthLabel(p.year, p.month)}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">{monthLabel(p.year, p.month)}</span>
                        <span className={`tabular-nums ${overspent ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {overspent ? '−' : '+'}
                          {formatMoney(Math.abs(incomeMinor - spentMinor), currency)}
                        </span>
                      </div>
                      <Bar
                        widthPct={pct(incomeMinor, trendMaxMinor)}
                        className="bg-emerald-500"
                        label={`Income ${formatMoney(incomeMinor, currency)}`}
                      />
                      <div className="h-1" />
                      <Bar
                        widthPct={pct(spentMinor, trendMaxMinor)}
                        className={overspent ? 'bg-rose-500' : 'bg-slate-400'}
                        label={`Spent ${formatMoney(spentMinor, currency)}`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm bg-emerald-500" /> Income (budgeted)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm bg-slate-400" /> Spent
                </span>
              </div>
            </section>

            {/* Spending by category for the latest month. */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Spending by category</h3>
              {latest && (
                <p className="mb-4 text-xs text-slate-400">{monthLabel(latest.year, latest.month)}</p>
              )}
              {categorySpend.length === 0 ? (
                <p className="text-sm text-slate-400">No spending recorded for this month yet.</p>
              ) : (
                <div className="space-y-3">
                  {categorySpend.map((c) => (
                    <div key={c.id} aria-label={`Spending for ${c.name}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">
                          {c.name}
                          {c.kind === 'Fund' && (
                            <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700">
                              Fund
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-slate-500">
                          {formatMoney(c.spentMinor, currency)} ·{' '}
                          {categoryTotalMinor === 0
                            ? '0%'
                            : `${Math.round((c.spentMinor / categoryTotalMinor) * 100)}%`}
                        </span>
                      </div>
                      <Bar widthPct={pct(c.spentMinor, categoryMaxMinor)} className="bg-indigo-500" label={c.name} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function pct(value: Minor, max: Minor): number {
  if (max <= 0 || value <= 0) return 0
  return Math.max(2, Math.round((value / max) * 100)) // a visible sliver for tiny non-zero values
}

function Bar({ widthPct, className, label }: { widthPct: number; className: string; label: string }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
      <div className={`h-full rounded-full ${className}`} style={{ width: `${widthPct}%` }} />
    </div>
  )
}

function SummaryCard({
  label,
  minor,
  currency,
  tone,
}: {
  label: string
  minor: Minor
  currency: string
  tone: 'income' | 'spent' | 'net'
}) {
  const color =
    tone === 'income'
      ? 'text-emerald-600'
      : tone === 'spent'
        ? 'text-slate-800'
        : minor < 0
          ? 'text-rose-600'
          : 'text-emerald-600'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{formatMoney(minor, currency)}</p>
    </div>
  )
}
