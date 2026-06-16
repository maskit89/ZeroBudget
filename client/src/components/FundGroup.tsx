import { useEffect, useState } from 'react'
import type { CategoryVM } from '../budgetModel'
import { categoryPlanned } from '../budgetModel'
import { formatMoney, type Minor } from '../lib/money'
import { BudgetItemRow } from './BudgetItemRow'
import { Badge } from './ui'

interface Props {
  category: CategoryVM
  currency: string
  savingItemId: string | null
  onCommitItem: (itemId: string, plannedMinor: Minor) => void
  onCommitActual: (itemId: string, actualMinor: Minor) => void
  onSetActualMode: (itemId: string, trackByTransactions: boolean) => void
  onRenameItem: (itemId: string, name: string) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (categoryId: string, name: string) => void
  onRenameCategory: (categoryId: string, name: string) => void
  onDeleteCategory: (categoryId: string) => void
}

/**
 * A group of sinking funds. Like a category group, but each line shows its
 * rolled-over **Available** balance (what's accumulated across months) instead of
 * a single month's remaining. The "Planned" column is the monthly contribution and
 * the "Spent" column draws the balance down.
 */
export function FundGroup({
  category,
  currency,
  savingItemId,
  onCommitItem,
  onCommitActual,
  onSetActualMode,
  onRenameItem,
  onDeleteItem,
  onAddItem,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
  const [open, setOpen] = useState(true)
  const [name, setName] = useState(category.name)
  const [newItemName, setNewItemName] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => setName(category.name), [category.name])

  function commitName() {
    const trimmed = name.trim()
    if (trimmed === '') {
      setName(category.name)
      return
    }
    if (trimmed !== category.name) onRenameCategory(category.id, trimmed)
  }

  function submitNewItem() {
    const trimmed = newItemName.trim()
    if (trimmed === '') return
    onAddItem(category.id, trimmed)
    setNewItemName('')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-surface shadow-card dark:border-violet-500/30">
      <div className="flex items-center justify-between gap-2 bg-violet-50/40 px-5 py-4 dark:bg-violet-500/10">
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? `Collapse ${category.name}` : `Expand ${category.name}`}
            className={`text-violet-400 transition-transform hover:text-violet-600 ${open ? 'rotate-90' : ''}`}
          >
            ▶
          </button>
          <Badge tone="violet">Fund</Badge>
          <input
            type="text"
            value={name}
            aria-label={`Rename group ${category.name}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setName(category.name)
            }}
            className="rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-slate-800 hover:border-violet-200 focus:border-violet-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <Badge>{category.items.length}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-slate-600">
            {formatMoney(categoryPlanned(category), currency)}
          </span>
          {confirmingDelete ? (
            <span className="flex items-center gap-1 text-xs">
              <span className="text-slate-500">Delete group?</span>
              <button
                type="button"
                onClick={() => onDeleteCategory(category.id)}
                aria-label={`Confirm delete ${category.name}`}
                className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                aria-label="Cancel delete"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete group ${category.name}`}
              title="Delete group"
              className="rounded-md px-1.5 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-violet-100 dark:border-violet-500/20">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <div className="col-span-4">Fund</div>
            <div className="col-span-3 text-right">Planned</div>
            <div className="col-span-2 text-right">Spent</div>
            <div className="col-span-2 text-right">Available</div>
            <div className="col-span-1" />
          </div>

          <div className="divide-y divide-slate-100">
            {category.items.map((item) => (
              <BudgetItemRow
                key={item.id}
                item={item}
                currency={currency}
                saving={savingItemId === item.id}
                onCommit={onCommitItem}
                onCommitActual={onCommitActual}
                onSetActualMode={onSetActualMode}
                onRename={onRenameItem}
                onDelete={onDeleteItem}
                availableMinor={item.fundAvailableMinor}
              />
            ))}
            {category.items.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-500">No funds yet — add one below.</p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
            <input
              type="text"
              value={newItemName}
              placeholder="Add a fund (e.g. Car, Holiday, Christmas)…"
              aria-label={`Add a fund to ${category.name}`}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewItem()
              }}
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={submitNewItem}
              aria-label={`Add fund to ${category.name}`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-surface"
            >
              + Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
