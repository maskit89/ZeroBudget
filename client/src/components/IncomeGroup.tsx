import { useState } from 'react'
import type { CategoryVM } from '../budgetModel'
import { categoryPlanned } from '../budgetModel'
import { formatMoney, type Minor } from '../lib/money'
import { IncomeLineRow } from './IncomeLineRow'

interface Props {
  category: CategoryVM
  currency: string
  savingItemId: string | null
  onRenameItem: (itemId: string, name: string) => void
  onCommitPlanned: (itemId: string, plannedMinor: Minor) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (categoryId: string, name: string) => void
}

/**
 * The Income group — always rendered at the top of the budget (EveryDollar
 * style). Its planned total is the pool the user assigns down to €0,00. Users
 * can add, rename, set the amount of, and remove income sources here.
 */
export function IncomeGroup({
  category,
  currency,
  savingItemId,
  onRenameItem,
  onCommitPlanned,
  onDeleteItem,
  onAddItem,
}: Props) {
  const [open, setOpen] = useState(true)
  const [newName, setNewName] = useState('')

  function submitNew() {
    const trimmed = newName.trim()
    if (trimmed === '') return
    onAddItem(category.id, trimmed)
    setNewName('')
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100/70"
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-emerald-500 transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="font-semibold text-emerald-900">{category.name}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
            {category.items.length}
          </span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-emerald-800">
          {formatMoney(categoryPlanned(category), currency)}
        </span>
      </button>

      {open && (
        <div className="border-t border-emerald-100">
          <div className="grid grid-cols-12 gap-2 bg-emerald-50/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-emerald-700/70">
            <div className="col-span-6">Source</div>
            <div className="col-span-4 text-right">Planned</div>
            <div className="col-span-2" />
          </div>

          <div className="divide-y divide-slate-100">
            {category.items.map((item) => (
              <IncomeLineRow
                key={item.id}
                item={item}
                currency={currency}
                saving={savingItemId === item.id}
                onRename={onRenameItem}
                onCommitPlanned={onCommitPlanned}
                onDelete={onDeleteItem}
              />
            ))}
            {category.items.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">
                No income yet — add your first source below.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50/30 px-4 py-2.5">
            <input
              type="text"
              value={newName}
              placeholder="Add income source (e.g. Freelance, Child Benefit)…"
              aria-label="New income source name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew()
              }}
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={submitNew}
              aria-label="Add income source"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              + Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
