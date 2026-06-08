import type { BudgetMonthDto, TransactionDto } from '../types'
import { TransactionType } from '../types'

export interface ItemOptionGroup {
  category: string
  items: { id: string; name: string }[]
}

/**
 * Build grouped <optgroup> options (category -> lines) for the assign dropdown.
 * Pass a transaction type to restrict the options to lines of the matching kind
 * (so an expense only offers expense lines, income only income lines).
 */
export function buildItemOptions(
  month: BudgetMonthDto | null,
  forType?: number,
): ItemOptionGroup[] {
  if (!month) return []
  const wantKind =
    forType === undefined ? null : forType === TransactionType.Income ? 'Income' : 'Expense'
  return month.categories
    .filter((c) => wantKind === null || c.kind === wantKind)
    .map((c) => ({
      category: c.name,
      items: c.items.map((i) => ({ id: i.id, name: i.name })),
    }))
    .filter((g) => g.items.length > 0)
}

export function transactionTypeLabel(type: number): 'Income' | 'Expense' {
  return type === TransactionType.Income ? 'Income' : 'Expense'
}

/** Income should read as a positive inflow, an expense as a negative outflow. */
export function signedAmountMinorFromAmount(t: Pick<TransactionDto, 'amount' | 'type'>): number {
  const magnitude = Math.round(t.amount * 10_000)
  return t.type === TransactionType.Income ? magnitude : -magnitude
}
