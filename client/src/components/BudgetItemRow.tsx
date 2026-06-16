import { useEffect, useState } from 'react'
import type { BillStatus, ItemVM } from '../budgetModel'
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
  /** When provided, the line can be tracked as a bill with a due day (null clears it). */
  onSetBill?: (itemId: string, dueDay: number | null) => void
  /** When provided, a bill line shows a paid checkbox. */
  onSetPaid?: (itemId: string, isPaid: boolean) => void
  /** Urgency of this line's bill relative to today (drives the due-date pill colour). */
  billStatus?: BillStatus | null
  /** When provided, ▲▼ controls reorder the line within its category. */
  onMove?: (itemId: string, direction: -1 | 1) => void
  isFirst?: boolean
  isLast?: boolean
  /**
   * For a fund line: the rolled-over available balance. When set, the last column
   * shows this (the fund's running balance) instead of the single-month remaining.
   */
  availableMinor?: Minor | null
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
  onSetBill,
  onSetPaid,
  onMove,
  isFirst = false,
  isLast = false,
  availableMinor,
  billStatus,
}: Props) {
  const [name, setName] = useState(item.name)
  const [draft, setDraft] = useState(toEditString(item.plannedMinor))
  const [actualDraft, setActualDraft] = useState(toEditString(item.actualMinor))
  const [billEditing, setBillEditing] = useState(false)
  const [billDraft, setBillDraft] = useState(item.dueDay?.toString() ?? '')

  // Re-sync when the underlying values change (optimistic update or rollback).
  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setDraft(toEditString(item.plannedMinor)), [item.plannedMinor])
  useEffect(() => setActualDraft(toEditString(item.actualMinor)), [item.actualMinor])
  useEffect(() => setBillDraft(item.dueDay?.toString() ?? ''), [item.dueDay])

  function commitBill() {
    if (!onSetBill) return
    const n = Number(billDraft)
    setBillEditing(false)
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      setBillDraft(item.dueDay?.toString() ?? '') // revert invalid input
      return
    }
    if (n !== item.dueDay) onSetBill(item.id, n)
  }

  function clearBill() {
    setBillEditing(false)
    onSetBill?.(item.id, null)
  }

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
  // A fund line shows its rolled-over available balance instead of the remaining.
  const showAvailable = availableMinor !== undefined && availableMinor !== null
  const fundOverdrawn = showAvailable && (availableMinor as Minor) < 0
  const overdue = billStatus === 'overdue'
  const dueSoon = billStatus === 'due-soon'
  const billPillClass = overdue
    ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/40 dark:hover:bg-rose-500/25'
    : dueSoon
      ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/40 dark:hover:bg-amber-500/25'
      : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25'
  const billTitle = overdue
    ? `Overdue — was due on day ${item.dueDay}`
    : dueSoon
      ? `Due soon — day ${item.dueDay}`
      : `Bill due on day ${item.dueDay}`

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
      <div className="col-span-4 flex items-center gap-1">
        {onMove && (
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => onMove(item.id, -1)}
              disabled={isFirst}
              aria-label={`Move ${item.name} up`}
              title="Move line up"
              className="flex h-5 w-5 items-center justify-center text-[11px] leading-none text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-500"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onMove(item.id, 1)}
              disabled={isLast}
              aria-label={`Move ${item.name} down`}
              title="Move line down"
              className="flex h-5 w-5 items-center justify-center text-[11px] leading-none text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-500"
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
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate px-2 text-sm font-medium text-slate-700">{item.name}</span>
        )}
        {saving && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
            title="Saving…"
            aria-label="Saving"
          />
        )}

        {onSetBill &&
          (billEditing ? (
            <span className="flex shrink-0 items-center gap-0.5">
              <input
                type="number"
                min={1}
                max={31}
                value={billDraft}
                aria-label={`Due day for ${item.name}`}
                onChange={(e) => setBillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitBill()
                  if (e.key === 'Escape') {
                    setBillEditing(false)
                    setBillDraft(item.dueDay?.toString() ?? '')
                  }
                }}
                className="h-6 w-12 rounded-md border border-slate-400 px-1 text-xs tabular-nums focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <button
                type="button"
                onClick={commitBill}
                aria-label={`Save due day for ${item.name}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400"
              >
                ✓
              </button>
              {item.dueDay !== null && (
                <button
                  type="button"
                  onClick={clearBill}
                  aria-label={`Remove bill from ${item.name}`}
                  title="Remove bill"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  ✕
                </button>
              )}
            </span>
          ) : item.dueDay !== null ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBillEditing(true)}
                aria-label={`Edit due day for ${item.name}`}
                title={billTitle}
                className={`inline-flex min-h-6 items-center rounded px-1.5 text-[11px] font-medium tabular-nums ${billPillClass}`}
              >
                {overdue ? '⚠' : '📅'} {item.dueDay}
              </button>
              {onSetPaid && (
                <button
                  type="button"
                  onClick={() => onSetPaid(item.id, !item.isPaid)}
                  aria-pressed={item.isPaid}
                  aria-label={`Mark ${item.name} paid`}
                  title={item.isPaid ? 'Paid' : 'Mark as paid'}
                  className={`inline-flex min-h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium ${
                    item.isPaid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span aria-hidden>{item.isPaid ? '☑' : '☐'}</span>
                  Paid
                </button>
              )}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setBillEditing(true)}
              aria-label={`Add a due date to ${item.name}`}
              title="Track as a bill"
              className="inline-flex min-h-6 shrink-0 items-center rounded px-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-600"
            >
              📅
            </button>
          ))}
      </div>

      <div className="col-span-3 flex items-center justify-end">
        <span className="mr-1 text-slate-500">{currencySymbol(currency)}</span>
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
            className="shrink-0 rounded px-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-600"
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
            className="w-16 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums text-slate-600 transition hover:bg-slate-100 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
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

      {showAvailable ? (
        <div
          className={`col-span-2 text-right text-sm font-semibold tabular-nums ${
            fundOverdrawn ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
          }`}
          title="Available in this fund (rolled over from previous months)"
        >
          {formatMoney(availableMinor as Minor, currency)}
        </div>
      ) : (
        <div
          className={`col-span-2 text-right text-sm tabular-nums ${
            overspent ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-medium text-slate-500'
          }`}
        >
          {formatMoney(remaining, currency)}
        </div>
      )}

      <div className="col-span-1 flex justify-end">
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label={`Delete ${item.name}`}
            title="Delete line"
            className="rounded-md px-1.5 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
