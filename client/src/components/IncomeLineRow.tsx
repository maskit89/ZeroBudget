import { useEffect, useState } from 'react'
import type { ItemVM } from '../budgetModel'
import { currencySymbol, parseMinor, toEditString, type Minor } from '../lib/money'

interface Props {
  item: ItemVM
  currency: string
  saving: boolean
  onRename: (itemId: string, name: string) => void
  onCommitPlanned: (itemId: string, plannedMinor: Minor) => void
  onDelete: (itemId: string) => void
}

/**
 * A single income source: an editable name and an inline-editable planned
 * amount (parsed straight to integer minor units — no floating point), plus a
 * delete affordance. Income lines have no "actual/remaining" columns — they
 * feed the pool to allocate, they are not spending.
 */
export function IncomeLineRow({
  item,
  currency,
  saving,
  onRename,
  onCommitPlanned,
  onDelete,
}: Props) {
  const [name, setName] = useState(item.name)
  const [draft, setDraft] = useState(toEditString(item.plannedMinor))

  // Re-sync when the underlying value changes (optimistic update or rollback).
  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setDraft(toEditString(item.plannedMinor)), [item.plannedMinor])

  function commitName() {
    const trimmed = name.trim()
    if (trimmed === '') {
      setName(item.name) // revert empty
      return
    }
    if (trimmed !== item.name) onRename(item.id, trimmed)
  }

  function commitPlanned() {
    const parsed = parseMinor(draft)
    if (parsed === null) {
      setDraft(toEditString(item.plannedMinor)) // revert invalid input
      return
    }
    if (parsed !== item.plannedMinor) onCommitPlanned(item.id, parsed)
  }

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 hover:bg-emerald-50/40">
      <div className="col-span-6 flex items-center gap-2">
        <input
          type="text"
          value={name}
          aria-label="Income source name"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setName(item.name)
          }}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {saving && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
            title="Saving…"
            aria-label="Saving"
          />
        )}
      </div>

      <div className="col-span-4 flex items-center justify-end">
        <span className="mr-1 text-slate-400">{currencySymbol(currency)}</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          aria-label={`Planned amount for ${item.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitPlanned}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(toEditString(item.plannedMinor))
          }}
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="col-span-2 flex justify-end">
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          aria-label={`Delete ${item.name}`}
          title="Delete income source"
          className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
