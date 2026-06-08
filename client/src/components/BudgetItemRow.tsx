import { useEffect, useState } from 'react'
import type { ItemVM } from '../budgetModel'
import { itemRemaining } from '../budgetModel'
import { currencySymbol, formatMoney, parseMinor, toEditString, type Minor } from '../lib/money'

interface Props {
  item: ItemVM
  currency: string
  saving: boolean
  onCommit: (itemId: string, plannedMinor: Minor) => void
  /** When provided, the line name is inline-editable. */
  onRename?: (itemId: string, name: string) => void
  /** When provided, a delete affordance is shown. */
  onDelete?: (itemId: string) => void
  /** When provided, the spent amount is manually editable (unless transaction-tracked). */
  onCommitActual?: (itemId: string, actualMinor: Minor) => void
  /** When provided, a toggle switches the line between manual entry and transaction tracking. */
  onSetActualMode?: (itemId: string, trackByTransactions: boolean) => void
  /** When provided, ▲▼ controls reorder the line within its category. */
  onMove?: (itemId: string, direction: -1 | 1) => void
  isFirst?: boolean
  isLast?: boolean
}

/**
 * A single budget line: an (optionally) editable name, an inline-editable
 * planned amount parsed straight to integer minor units (no floating point),
 * its actual + remaining, and an optional delete. Commits on blur or Enter
 * (Escape reverts), only when the value actually changed and is valid.
 */
export function BudgetItemRow({
  item,
  currency,
  saving,
  onCommit,
  onRename,
  onDelete,
  onCommitActual,
  onSetActualMode,
  onMove,
  isFirst = false,
  isLast = false,
}: Props) {
  const [name, setName] = useState(item.name)
  const [draft, setDraft] = useState(toEditString(item.plannedMinor))
  const [actualDraft, setActualDraft] = useState(toEditString(item.actualMinor))

  // Re-sync when the underlying values change (optimistic update or rollback).
  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setDraft(toEditString(item.plannedMinor)), [item.plannedMinor])
  useEffect(() => setActualDraft(toEditString(item.actualMinor)), [item.actualMinor])

  function commitName() {
    if (!onRename) return
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
    if (parsed !== item.plannedMinor) onCommit(item.id, parsed)
  }

  function commitActual() {
    if (!onCommitActual) return
    const parsed = parseMinor(actualDraft)
    if (parsed === null) {
      setActualDraft(toEditString(item.actualMinor)) // revert invalid input
      return
    }
    if (parsed !== item.actualMinor) onCommitActual(item.id, parsed)
  }

  const remaining = itemRemaining(item)
  const overspent = remaining < 0
  // The spent cell is editable only when manual (no transactions drive it).
  const actualEditable = Boolean(onCommitActual) && !item.actualIsTracked

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
      <div className="col-span-4 flex items-center gap-1">
        {onMove && (
          <div className="flex shrink-0 flex-col leading-none">
            <button
              type="button"
              onClick={() => onMove(item.id, -1)}
              disabled={isFirst}
              aria-label={`Move ${item.name} up`}
              title="Move line up"
              className="text-[10px] text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onMove(item.id, 1)}
              disabled={isLast}
              aria-label={`Move ${item.name} down`}
              title="Move line down"
              className="text-[10px] text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300"
            >
              ▼
            </button>
          </div>
        )}
        {onRename ? (
          <input
            type="text"
            value={name}
            aria-label={`Rename ${item.name}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setName(item.name)
            }}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        ) : (
          <span className="truncate px-2 text-sm font-medium text-slate-700">{item.name}</span>
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
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1">
        {onSetActualMode && (
          <button
            type="button"
            onClick={() => onSetActualMode(item.id, !item.actualIsTracked)}
            aria-label={
              item.actualIsTracked
                ? `Enter ${item.name} spent manually`
                : `Track ${item.name} by transactions`
            }
            title={
              item.actualIsTracked
                ? 'Tracked by transactions — switch to manual entry'
                : 'Manual entry — switch to transaction tracking'
            }
            className="shrink-0 rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {item.actualIsTracked ? '🔗' : '✎'}
          </button>
        )}
        {actualEditable ? (
          <input
            type="text"
            inputMode="decimal"
            value={actualDraft}
            aria-label={`Spent for ${item.name}`}
            onChange={(e) => setActualDraft(e.target.value)}
            onBlur={commitActual}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setActualDraft(toEditString(item.actualMinor))
            }}
            className="w-16 rounded-md border border-slate-200 px-2 py-1 text-right text-sm tabular-nums text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        ) : (
          <span
            className="text-sm tabular-nums text-slate-500"
            title="Tracked from transactions"
          >
            {formatMoney(item.actualMinor, currency)}
          </span>
        )}
      </div>

      <div
        className={`col-span-2 text-right text-sm font-semibold tabular-nums ${
          overspent ? 'text-rose-600' : 'text-slate-700'
        }`}
      >
        {formatMoney(remaining, currency)}
      </div>

      <div className="col-span-1 flex justify-end">
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label={`Delete ${item.name}`}
            title="Delete line"
            className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
