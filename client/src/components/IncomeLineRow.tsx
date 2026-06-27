import { useEffect, useState } from 'react'
import type { ItemVM } from '../budgetModel'
import { currencySymbol, formatMoney, parseMinor, toEditString, type Minor } from '../lib/money'
import { useAuth } from '../auth/AuthContext'

interface Props {
  item: ItemVM
  currency: string
  saving: boolean
  onRename: (itemId: string, name: string) => void
  onCommitPlanned: (itemId: string, plannedMinor: Minor) => void
  onDelete: (itemId: string) => void
}

/**
 * A single income source: an editable name, an inline-editable planned amount,
 * a (read-only) received amount rolled up from the assigned income
 * transactions, plus a delete. Planned income feeds the pool to allocate;
 * received is just this line's actual inflow.
 */
export function IncomeLineRow({
  item,
  currency,
  saving,
  onRename,
  onCommitPlanned,
  onDelete,
}: Props) {
  // Editing income lines (structure + amounts) needs Admin+ (canWrite).
  const { canWrite } = useAuth()
  const [name, setName] = useState(item.name)
  const [draft, setDraft] = useState(toEditString(item.plannedMinor))

  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setDraft(toEditString(item.plannedMinor)), [item.plannedMinor])

  function commitName() {
    const trimmed = name.trim()
    if (trimmed === '') {
      setName(item.name)
      return
    }
    if (trimmed !== item.name) onRename(item.id, trimmed)
  }

  function commitPlanned() {
    const parsed = parseMinor(draft)
    if (parsed === null) {
      setDraft(toEditString(item.plannedMinor))
      return
    }
    if (parsed !== item.plannedMinor) onCommitPlanned(item.id, parsed)
  }

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 hover:bg-emerald-50/40">
      <div className="col-span-5 flex items-center gap-2">
        {canWrite ? (
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
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        ) : (
          <span className="w-full px-2 py-1 text-sm font-medium text-slate-700">{item.name}</span>
        )}
        {saving && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
            title="Saving…"
            aria-label="Saving"
          />
        )}
      </div>

      <div className="col-span-3 flex items-center justify-end">
        <span className="mr-1 text-slate-500">{currencySymbol(currency)}</span>
        {canWrite ? (
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
            className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right text-sm font-medium tabular-nums text-slate-800 transition hover:bg-slate-100 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        ) : (
          <span className="w-24 px-2 py-1 text-right text-sm font-medium tabular-nums text-slate-800">
            {toEditString(item.plannedMinor)}
          </span>
        )}
      </div>

      <div className="col-span-3 flex items-center justify-end">
        <span
          className="text-sm tabular-nums text-slate-500"
          title="Total of the income transactions assigned to this line"
        >
          {formatMoney(item.actualMinor, currency)}
        </span>
      </div>

      <div className="col-span-1 flex justify-end">
        {canWrite && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label={`Delete ${item.name}`}
            title="Delete income source"
            className="rounded-md px-1.5 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
