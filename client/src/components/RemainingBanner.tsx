import { formatEuro } from '../lib/money'

interface Props {
  totalIncome: number
  totalPlanned: number
  remainingToBudget: number
}

/**
 * The reactive ZBB banner. It re-renders from props every time a planned amount
 * changes, so the user watches the pool move toward the €0.00 goal in real time.
 *   == 0  -> green  "Every Euro has a job"
 *   > 0   -> amber  "money still to assign"
 *   < 0   -> red    "over-budgeted"
 */
export function RemainingBanner({ totalIncome, totalPlanned, remainingToBudget }: Props) {
  const balanced = remainingToBudget === 0
  const over = remainingToBudget < 0

  const tone = balanced
    ? { bar: 'bg-emerald-600', ring: 'ring-emerald-200', label: 'Every Euro has a job 🎉' }
    : over
      ? { bar: 'bg-rose-600', ring: 'ring-rose-200', label: 'Over-budgeted — trim a category' }
      : { bar: 'bg-amber-500', ring: 'ring-amber-200', label: 'Still to assign' }

  return (
    <div className={`rounded-2xl ${tone.bar} text-white shadow-lg ring-4 ${tone.ring} transition-colors`}>
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-white/80">
            Remaining to Budget
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{formatEuro(remainingToBudget)}</p>
          <p className="mt-1 text-sm text-white/90">{tone.label}</p>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Income</p>
            <p className="text-lg font-semibold tabular-nums">{formatEuro(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Assigned</p>
            <p className="text-lg font-semibold tabular-nums">{formatEuro(totalPlanned)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
