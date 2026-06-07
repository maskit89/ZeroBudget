import { useEffect, useState } from 'react'
import type { ItemVM } from '../budgetModel'
import { itemRemaining } from '../budgetModel'
import { currencySymbol, formatMoney, parseMinor, toEditString, type Minor } from '../lib/money'

interface Props {
  item: ItemVM
  currency: string
  saving: boolean
  onCommit: (itemId: string, plannedMinor: Minor) => void
}

/**
 * A single budget line with an inline-editable planned amount. The value is
 * parsed straight to integer minor units (no floating point). Commits on blur
 * or Enter (Escape reverts), and only when the value actually changed and is a
 * valid non-negative number.
 */
export function BudgetItemRow({ item, currency, saving, onCommit }: Props) {
  const [draft, setDraft] = useState(toEditString(item.plannedMinor))

  // Re-sync when the underlying value changes (optimistic update or rollback).
  useEffect(() => {
    setDraft(toEditString(item.plannedMinor))
  }, [item.plannedMinor])

  function commit() {
    const parsed = parseMinor(draft)
    if (parsed === null) {
      setDraft(toEditString(item.plannedMinor)) // revert invalid input
      return
    }
    if (parsed !== item.plannedMinor) {
      onCommit(item.id, parsed)
    }
  }

  const remaining = itemRemaining(item)
  const overspent = remaining < 0

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
      <div className="col-span-5 flex items-center gap-2 truncate text-sm font-medium text-slate-700">
        <span className="truncate">{item.name}</span>
        {saving && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
            title="Saving…"
            aria-label="Saving"
          />
        )}
      </div>

      <div className="col-span-3 flex items-center justify-end">
        <span className="mr-1 text-slate-400">{currencySymbol(currency)}</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          aria-label={`Planned amount for ${item.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(toEditString(item.plannedMinor))
          }}
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="col-span-2 text-right text-sm tabular-nums text-slate-500">
        {formatMoney(item.actualMinor, currency)}
      </div>

      <div
        className={`col-span-2 text-right text-sm font-semibold tabular-nums ${
          overspent ? 'text-rose-600' : 'text-slate-700'
        }`}
      >
        {formatMoney(remaining, currency)}
      </div>
    </div>
  )
}
