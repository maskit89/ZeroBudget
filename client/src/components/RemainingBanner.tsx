import { formatEuro, type Minor } from '../lib/money'

interface Props {
  totalIncomeMinor: Minor
  totalPlannedMinor: Minor
  remainingMinor: Minor
}

/**
 * The reactive ZBB banner. It re-renders from integer minor units every time a
 * planned amount changes, so the user watches the pool move toward the €0.00
 * goal in real time — exactly, with no floating-point drift.
 *   == 0  -> green  "Every Euro has a job"
 *   > 0   -> amber  "money still to assign"
 *   < 0   -> red    "over-budgeted"
 */
export function RemainingBanner({ totalIncomeMinor, totalPlannedMinor, remainingMinor }: Props) {
  const balanced = remainingMinor === 0
  const over = remainingMinor < 0

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
          <p className="mt-1 text-4xl font-bold tabular-nums">{formatEuro(remainingMinor)}</p>
          <p className="mt-1 text-sm text-white/90">{tone.label}</p>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Income</p>
            <p className="text-lg font-semibold tabular-nums">{formatEuro(totalIncomeMinor)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Assigned</p>
            <p className="text-lg font-semibold tabular-nums">{formatEuro(totalPlannedMinor)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
