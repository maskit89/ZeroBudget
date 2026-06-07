// Client-side view-model. The wire DTOs (types.ts) carry amounts as JSON
// numbers; we map them once into integer minor units so every calculation the
// UI performs is exact and provably identical to the server's domain logic.

import type { BudgetMonthDto } from './types'
import { fromAmount, sumMinor, type Minor } from './lib/money'

export type CategoryKind = 'income' | 'expense'

export interface ItemVM {
  id: string
  name: string
  displayOrder: number
  plannedMinor: Minor
  actualMinor: Minor
}

export interface CategoryVM {
  id: string
  name: string
  kind: CategoryKind
  displayOrder: number
  items: ItemVM[]
}

export interface MonthVM {
  id: string
  key: string
  year: number
  month: number
  currency: string
  categories: CategoryVM[]
}

/** Map an API DTO into the integer-minor view-model. */
export function fromDto(dto: BudgetMonthDto): MonthVM {
  return {
    id: dto.id,
    key: dto.key,
    year: dto.year,
    month: dto.month,
    currency: dto.baseCurrency,
    categories: dto.categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind === 'Income' ? 'income' : 'expense',
      displayOrder: c.displayOrder,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        displayOrder: i.displayOrder,
        plannedMinor: fromAmount(i.plannedAmount),
        actualMinor: fromAmount(i.actualAmount),
      })),
    })),
  }
}

// --- Derived selectors (mirror ZeroBudget.Domain) ---------------------------
// These are the single source of truth for the UI's totals. Because they sum
// integers, an optimistic edit recomputes the exact same numbers the server
// would return — the banner can never drift.

export const isIncome = (c: CategoryVM): boolean => c.kind === 'income'

export const itemRemaining = (i: ItemVM): Minor => i.plannedMinor - i.actualMinor

export const categoryPlanned = (c: CategoryVM): Minor =>
  sumMinor(c.items.map((i) => i.plannedMinor))

export const categoryActual = (c: CategoryVM): Minor =>
  sumMinor(c.items.map((i) => i.actualMinor))

/** The pool to allocate: the sum of the income groups' planned lines. */
export const totalIncome = (m: MonthVM): Minor =>
  sumMinor(m.categories.filter(isIncome).map(categoryPlanned))

/** Income that has been given a job: the sum of the expense groups' planned lines. */
export const monthPlanned = (m: MonthVM): Minor =>
  sumMinor(m.categories.filter((c) => !isIncome(c)).map(categoryPlanned))

export const remainingToBudget = (m: MonthVM): Minor => totalIncome(m) - monthPlanned(m)

export const isBalanced = (m: MonthVM): boolean => remainingToBudget(m) === 0

/** Find a line anywhere in the tree (used to read its current state for edits). */
export function findItem(m: MonthVM, itemId: string): ItemVM | undefined {
  for (const c of m.categories) {
    const found = c.items.find((i) => i.id === itemId)
    if (found) return found
  }
  return undefined
}

// --- Optimistic update primitives -------------------------------------------
// Each returns a new tree (immutably) so the banner recomputes instantly and a
// rollback is a single setState back to the captured snapshot.

/** Set one line's planned amount. */
export function withItemPlanned(m: MonthVM, itemId: string, plannedMinor: Minor): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, plannedMinor } : i)),
    })),
  }
}

/** Rename one line. */
export function withItemName(m: MonthVM, itemId: string, name: string): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, name } : i)),
    })),
  }
}

/** Append a (temporary) line to a category — reconciled from the server response. */
export function withNewItem(m: MonthVM, categoryId: string, item: ItemVM): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) =>
      c.id === categoryId ? { ...c, items: [...c.items, item] } : c,
    ),
  }
}

/** Remove a line. */
export function withoutItem(m: MonthVM, itemId: string): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => ({
      ...c,
      items: c.items.filter((i) => i.id !== itemId),
    })),
  }
}
