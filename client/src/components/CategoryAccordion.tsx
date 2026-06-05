import { useState } from 'react'
import type { CategoryVM } from '../budgetModel'
import { categoryPlanned } from '../budgetModel'
import { formatMoney, type Minor } from '../lib/money'
import { BudgetItemRow } from './BudgetItemRow'

interface Props {
  category: CategoryVM
  currency: string
  savingItemId: string | null
  defaultOpen?: boolean
  onCommitItem: (itemId: string, plannedMinor: Minor) => void
}

export function CategoryAccordion({
  category,
  currency,
  savingItemId,
  defaultOpen = true,
  onCommitItem,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="font-semibold text-slate-800">{category.name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {category.items.length}
          </span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-600">
          {formatMoney(categoryPlanned(category), currency)}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <div className="col-span-5">Line</div>
            <div className="col-span-3 text-right">Planned</div>
            <div className="col-span-2 text-right">Actual</div>
            <div className="col-span-2 text-right">Remaining</div>
          </div>
          <div className="divide-y divide-slate-100">
            {category.items.map((item) => (
              <BudgetItemRow
                key={item.id}
                item={item}
                currency={currency}
                saving={savingItemId === item.id}
                onCommit={onCommitItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
