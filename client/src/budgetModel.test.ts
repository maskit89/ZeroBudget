import { describe, it, expect } from 'vitest'
import {
  fromDto,
  itemRemaining,
  categoryPlanned,
  monthPlanned,
  remainingToBudget,
  isBalanced,
  withItemPlanned,
} from './budgetModel'
import { fromAmount } from './lib/money'
import type { BudgetMonthDto } from './types'

function dto(): BudgetMonthDto {
  return {
    id: 'm1',
    key: '2026-06',
    year: 2026,
    month: 6,
    baseCurrency: 'EUR',
    totalIncome: 3000,
    totalPlanned: 1300,
    remainingToBudget: 1700,
    isBalanced: false,
    categories: [
      {
        id: 'c1',
        name: 'Housing',
        displayOrder: 0,
        totalPlanned: 1100,
        totalActual: 0,
        items: [
          { id: 'i1', name: 'Rent', displayOrder: 0, plannedAmount: 1100, actualAmount: 200, remaining: 900 },
        ],
      },
      {
        id: 'c2',
        name: 'Food',
        displayOrder: 1,
        totalPlanned: 200,
        totalActual: 0,
        items: [
          { id: 'i2', name: 'Groceries', displayOrder: 0, plannedAmount: 200, actualAmount: 0, remaining: 200 },
        ],
      },
    ],
  }
}

describe('budgetModel selectors', () => {
  it('maps the DTO into integer minor units carrying the currency', () => {
    const vm = fromDto(dto())
    expect(vm.currency).toBe('EUR')
    expect(vm.totalIncomeMinor).toBe(fromAmount(3000))
    expect(vm.categories[0].items[0].plannedMinor).toBe(fromAmount(1100))
  })

  it('computes item remaining = planned - actual', () => {
    const vm = fromDto(dto())
    expect(itemRemaining(vm.categories[0].items[0])).toBe(fromAmount(900))
  })

  it('sums category and month planned exactly', () => {
    const vm = fromDto(dto())
    expect(categoryPlanned(vm.categories[0])).toBe(fromAmount(1100))
    expect(monthPlanned(vm)).toBe(fromAmount(1300))
    expect(remainingToBudget(vm)).toBe(fromAmount(1700))
    expect(isBalanced(vm)).toBe(false)
  })

  it('withItemPlanned updates one line immutably and recomputes the pool', () => {
    const vm = fromDto(dto())
    const next = withItemPlanned(vm, 'i2', fromAmount(1900)) // 200 -> 1900

    // original untouched (immutability)
    expect(vm.categories[1].items[0].plannedMinor).toBe(fromAmount(200))
    // new tree balances to exactly zero: 1100 + 1900 = 3000 == income
    expect(monthPlanned(next)).toBe(fromAmount(3000))
    expect(remainingToBudget(next)).toBe(0)
    expect(isBalanced(next)).toBe(true)
  })
})
