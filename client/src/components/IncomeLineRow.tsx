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
  onCommitReceived: (itemId: string, actualMinor: Minor) => void
  onSetActualMode: (itemId: string, trackByTransactions: boolean) => void
  onDelete: (itemId: string) => void
}

/**
 * A single income source: an editable name, an inline-editable planned amount,
 * a received amount (typed manually, or rolled up from assigned income
 * transactions), plus a tracking toggle and delete. Planned income feeds the
 * pool to allocate; received is just this line's actual inflow.
 */
export function IncomeLineRow({
  item,
  currency,
  saving,
  onRename,
  onCommitPlanned,
  onCommitReceived,
  onSetActualMode,
  onDelete,
}: Props) {
  // Editing income lines (structure + amounts) needs Admin+ (canWrite).
  const { canWrite } = useAuth()
  const [name, setName] = useState(item.name)
  const [draft, setDraft] = useState(toEditString(item.plannedMinor))
  const [receivedDraft, setReceivedDraft] = useState(toEditString(item.actualMinor))

  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setDraft(toEditString(item.plannedMinor)), [item.plannedMinor])
  useEffect(() => setReceivedDraft(toEditString(item.actualMinor)), [item.actualMinor])

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

  function commitReceived() {
    const parsed = parseMinor(receivedDraft)
    if (parsed === null) {
      setReceivedDraft(toEditString(item.actualMinor))
      return
    }
    if (parsed !== item.actualMinor) onCommitReceived(item.id, parsed)
  }

  const receivedEditable = canWrite && !item.actualIsTracked

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

      <div className="col-span-3 flex items-center justify-end gap-1">
        {canWrite && (
          <button
            type="button"
            onClick={() => onSetActualMode(item.id, !item.actualIsTracked)}
            aria-label={
              item.actualIsTracked
                ? `Enter ${item.name} received manually`
                : `Track ${item.name} by transactions`
            }
            title={
              item.actualIsTracked
                ? 'Received from transactions — switch to manual entry'
                : 'Manual entry — switch to transaction tracking'
            }
            className="shrink-0 rounded px-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-600"
          >
            {item.actualIsTracked ? '🔗' : '✎'}
          </button>
        )}
        {receivedEditable ? (
          <input
            type="text"
            inputMode="decimal"
            value={receivedDraft}
            aria-label={`Received for ${item.name}`}
            onChange={(e) => setReceivedDraft(e.target.value)}
            onBlur={commitReceived}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setReceivedDraft(toEditString(item.actualMinor))
            }}
            className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums text-slate-600 transition hover:bg-slate-100 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        ) : (
          <span className="text-sm tabular-nums text-slate-500" title="Received from transactions">
            {formatMoney(item.actualMinor, currency)}
          </span>
        )}
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
