import { useEffect, useState } from 'react'
import type { BudgetItemDto } from '../types'
import { formatEuro } from '../lib/money'

interface Props {
  item: BudgetItemDto
  saving: boolean
  onCommit: (itemId: string, plannedAmount: number) => void
}

/**
 * A single budget line with an inline-editable planned amount. The edit commits
 * on blur or Enter (Escape reverts). Only fires onCommit when the value actually
 * changed and is a valid non-negative number.
 */
export function BudgetItemRow({ item, saving, onCommit }: Props) {
  const [draft, setDraft] = useState(item.plannedAmount.toString())

  // Keep the input in sync when the server returns a fresh value.
  useEffect(() => {
    setDraft(item.plannedAmount.toString())
  }, [item.plannedAmount])

  function commit() {
    const parsed = Number(draft.replace(',', '.'))
    if (Number.isNaN(parsed) || parsed < 0) {
      setDraft(item.plannedAmount.toString()) // revert invalid input
      return
    }
    if (parsed !== item.plannedAmount) {
      onCommit(item.id, parsed)
    }
  }

  const overspent = item.remaining < 0

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
      <div className="col-span-5 truncate text-sm font-medium text-slate-700">{item.name}</div>

      <div className="col-span-3 flex items-center justify-end">
        <span className="mr-1 text-slate-400">€</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(item.plannedAmount.toString())
          }}
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        />
      </div>

      <div className="col-span-2 text-right text-sm tabular-nums text-slate-500">
        {formatEuro(item.actualAmount)}
      </div>

      <div
        className={`col-span-2 text-right text-sm font-semibold tabular-nums ${
          overspent ? 'text-rose-600' : 'text-slate-700'
        }`}
      >
        {formatEuro(item.remaining)}
      </div>
    </div>
  )
}
