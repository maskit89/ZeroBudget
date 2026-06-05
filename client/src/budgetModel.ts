// Client-side view-model. The wire DTOs (types.ts) carry amounts as JSON
// numbers; we map them once into integer minor units so every calculation the
// UI performs is exact and provably identical to the server's domain logic.

import type { BudgetMonthDto } from './types'
import { fromAmount, sumMinor, type Minor } from './lib/money'

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
  displayOrder: number
  items: ItemVM[]
}

export interface MonthVM {
  id: string
  key: string
  year: number
  month: number
  currency: string
  totalIncomeMinor: Minor
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
    totalIncomeMinor: fromAmount(dto.totalIncome),
    categories: dto.categories.map((c) => ({
      id: c.id,
      name: c.name,
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

export const itemRemaining = (i: ItemVM): Minor => i.plannedMinor - i.actualMinor

export const categoryPlanned = (c: CategoryVM): Minor =>
  sumMinor(c.items.map((i) => i.plannedMinor))

export const categoryActual = (c: CategoryVM): Minor =>
  sumMinor(c.items.map((i) => i.actualMinor))

export const monthPlanned = (m: MonthVM): Minor =>
  sumMinor(m.categories.map(categoryPlanned))

export const remainingToBudget = (m: MonthVM): Minor =>
  m.totalIncomeMinor - monthPlanned(m)

export const isBalanced = (m: MonthVM): boolean => remainingToBudget(m) === 0

/** Immutably set one line's planned amount — the optimistic update primitive. */
export function withItemPlanned(m: MonthVM, itemId: string, plannedMinor: Minor): MonthVM {
  return {
    ...m,
    categories: m.categories.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, plannedMinor } : i)),
    })),
  }
}
