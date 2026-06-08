// Client-side view-model. The wire DTOs (types.ts) carry amounts as JSON
// numbers; we map them once into integer minor units so every calculation the
// UI performs is exact and provably identical to the server's domain logic.

import type { BudgetMonthDto } from './types'
import { fromAmount, sumMinor, type Minor } from './lib/money'

export type CategoryKind = 'income' | 'expense' | 'fund'

export interface ItemVM {
  id: string
  name: string
  displayOrder: number
  plannedMinor: Minor
  actualMinor: Minor
  /** True when the spent amount is driven by transactions (read-only in the UI). */
  actualIsTracked: boolean
  /** For a fund line, the rolled-over available balance (minor units); null otherwise. */
  fundAvailableMinor: Minor | null
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
      kind: c.kind === 'Income' ? 'income' : c.kind === 'Fund' ? 'fund' : 'expense',
      displayOrder: c.displayOrder,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        displayOrder: i.displayOrder,
        plannedMinor: fromAmount(i.plannedAmount),
        actualMinor: fromAmount(i.actualAmount),
        actualIsTracked: i.isActualTracked,
        fundAvailableMinor: i.fundAvailable == null ? null : fromAmount(i.fundAvailable),
      })),
    })),
  }
}

// --- Derived selectors (mirror ZeroBudget.Domain) ---------------------------
// These are the single source of truth for the UI's totals. Because they sum
// integers, an optimistic edit recomputes the exact same numbers the server
// would return — the banner can never drift.

export const isIncome = (c: CategoryVM): boolean => c.kind === 'income'

export const isFund = (c: CategoryVM): boolean => c.kind === 'fund'

export const itemRemaining = (i: ItemVM): Minor => i.plannedMinor - i.actualMinor

export const categoryPlanned = (c: CategoryVM): Minor =>
  sumMinor(c.items.map((i) => i.plannedMinor))

export const categoryActual = (c: CategoryVM): Minor =>
  sumMinor(c.items.map((i) => i.actualMinor))

/** The pool to allocate: the sum of the income groups' planned lines. */
export const totalIncome = (m: MonthVM): Minor =>
  sumMinor(m.categories.filter(isIncome).map(categoryPlanned))

/**
 * Income that has been given a job: the sum of every non-income group's planned
 * lines — expense spending AND fund contributions (funding a sinking fund is
 * giving money a job too), so the budget only balances once funds are funded.
 */
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

/** Set one line's manual spent amount (only meaningful for non-tracked lines). */
export function withItemActual(m: MonthVM, itemId: string, actualMinor: Minor): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, actualMinor } : i)),
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

/** Append a (temporary) expense group — reconciled from the server response. */
export function withNewCategory(m: MonthVM, category: CategoryVM): MonthVM {
  return { ...m, categories: [...m.categories, category] }
}

/** Rename one category group. */
export function withCategoryName(m: MonthVM, categoryId: string, name: string): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => (c.id === categoryId ? { ...c, name } : c)),
  }
}

/** Reorder the lines within one category to match the given id order. */
export function withReorderedItems(m: MonthVM, categoryId: string, orderedItemIds: string[]): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => {
      if (c.id !== categoryId) return c
      const byId = new Map(c.items.map((i) => [i.id, i]))
      const items = orderedItemIds
        .map((id) => byId.get(id))
        .filter((i): i is ItemVM => i !== undefined)
      return { ...c, items }
    }),
  }
}

/** Reorder the expense groups to match the given id order (income first, funds last). */
export function withReorderedExpenseCategories(m: MonthVM, orderedExpenseIds: string[]): MonthVM {
  const byId = new Map(m.categories.map((c) => [c.id, c]))
  const income = m.categories.filter(isIncome)
  const funds = m.categories.filter(isFund)
  const expense = orderedExpenseIds
    .map((id) => byId.get(id))
    .filter((c): c is CategoryVM => c !== undefined)
  return { ...m, categories: [...income, ...expense, ...funds] }
}

/** Remove a category group (and its lines). */
export function withoutCategory(m: MonthVM, categoryId: string): MonthVM {
  return { ...m, categories: m.categories.filter((c) => c.id !== categoryId) }
}
