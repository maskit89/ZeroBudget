import { useState } from 'react'
import type { CategoryVM } from '../budgetModel'
import { categoryPlanned } from '../budgetModel'
import { formatMoney, type Minor } from '../lib/money'
import { IncomeLineRow } from './IncomeLineRow'
import { Badge } from './ui'
import { useAuth } from '../auth/AuthContext'

interface Props {
  category: CategoryVM
  currency: string
  savingItemId: string | null
  onRenameItem: (itemId: string, name: string) => void
  onCommitPlanned: (itemId: string, plannedMinor: Minor) => void
  onCommitReceived: (itemId: string, actualMinor: Minor) => void
  onSetActualMode: (itemId: string, trackByTransactions: boolean) => void
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
  onCommitReceived,
  onSetActualMode,
  onDeleteItem,
  onAddItem,
}: Props) {
  const { canWrite } = useAuth()
  const [open, setOpen] = useState(true)
  const [newName, setNewName] = useState('')

  function submitNew() {
    const trimmed = newName.trim()
    if (trimmed === '') return
    onAddItem(category.id, trimmed)
    setNewName('')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-surface shadow-card dark:border-emerald-500/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-emerald-50 px-5 py-4 text-left transition-colors hover:bg-emerald-100/70 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-emerald-500 transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="text-base font-semibold text-emerald-900 dark:text-emerald-200">{category.name}</span>
          <Badge tone="brand">{category.items.length}</Badge>
        </div>
        <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
          {formatMoney(categoryPlanned(category), currency)}
        </span>
      </button>

      {open && (
        <div className="border-t border-emerald-100 dark:border-emerald-500/20">
          <div className="grid grid-cols-12 gap-2 bg-emerald-50/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
            <div className="col-span-5">Source</div>
            <div className="col-span-3 text-right">Planned</div>
            <div className="col-span-3 text-right">Received</div>
            <div className="col-span-1" />
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
                onCommitReceived={onCommitReceived}
                onSetActualMode={onSetActualMode}
                onDelete={onDeleteItem}
              />
            ))}
            {category.items.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">
                No income yet — add your first source below.
              </p>
            )}
          </div>

          {canWrite && (
            <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50/30 px-4 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
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
          )}
        </div>
      )}
    </div>
  )
}
