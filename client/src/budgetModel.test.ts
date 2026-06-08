import { describe, it, expect } from 'vitest'
import {
  fromDto,
  findItem,
  isFund,
  itemRemaining,
  categoryPlanned,
  monthPlanned,
  totalIncome,
  remainingToBudget,
  isBalanced,
  billsSummary,
  withItemPlanned,
  withItemActual,
  withItemBill,
  withItemName,
  withItemPaid,
  withNewItem,
  withoutItem,
  withNewCategory,
  withCategoryName,
  withoutCategory,
} from './budgetModel'
import { fromAmount } from './lib/money'
import type { BudgetMonthDto } from './types'

// Income(Take-home Pay 3000) + Housing(Rent 1100) + Food(Groceries 200).
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
        id: 'inc',
        name: 'Income',
        kind: 'Income',
        displayOrder: 0,
        totalPlanned: 3000,
        totalActual: 0,
        items: [
          { id: 'pay', name: 'Take-home Pay', displayOrder: 0, plannedAmount: 3000, actualAmount: 0, remaining: 3000, isActualTracked: false },
        ],
      },
      {
        id: 'c1',
        name: 'Housing',
        kind: 'Expense',
        displayOrder: 0,
        totalPlanned: 1100,
        totalActual: 0,
        items: [
          { id: 'i1', name: 'Rent', displayOrder: 0, plannedAmount: 1100, actualAmount: 200, remaining: 900, isActualTracked: false },
        ],
      },
      {
        id: 'c2',
        name: 'Food',
        kind: 'Expense',
        displayOrder: 1,
        totalPlanned: 200,
        totalActual: 0,
        items: [
          { id: 'i2', name: 'Groceries', displayOrder: 0, plannedAmount: 200, actualAmount: 0, remaining: 200, isActualTracked: false },
        ],
      },
    ],
  }
}

describe('budgetModel selectors', () => {
  it('maps the DTO into integer minor units, carrying the currency and kind', () => {
    const vm = fromDto(dto())
    expect(vm.currency).toBe('EUR')
    expect(vm.categories[0].kind).toBe('income')
    expect(vm.categories[1].kind).toBe('expense')
    expect(totalIncome(vm)).toBe(fromAmount(3000))
  })

  it('computes item remaining = planned - actual', () => {
    const vm = fromDto(dto())
    expect(itemRemaining(vm.categories[1].items[0])).toBe(fromAmount(900))
  })

  it('excludes income from planned; remaining = income - expense planned', () => {
    const vm = fromDto(dto())
    expect(categoryPlanned(vm.categories[1])).toBe(fromAmount(1100))
    expect(monthPlanned(vm)).toBe(fromAmount(1300)) // expenses only — income not counted
    expect(totalIncome(vm)).toBe(fromAmount(3000))
    expect(remainingToBudget(vm)).toBe(fromAmount(1700))
    expect(isBalanced(vm)).toBe(false)
  })

  it('withItemPlanned updates one line immutably and recomputes the pool', () => {
    const vm = fromDto(dto())
    const next = withItemPlanned(vm, 'i2', fromAmount(1900)) // Groceries 200 -> 1900

    // original untouched (immutability)
    expect(findItem(vm, 'i2')!.plannedMinor).toBe(fromAmount(200))
    // 1100 + 1900 = 3000 == income -> balanced
    expect(monthPlanned(next)).toBe(fromAmount(3000))
    expect(remainingToBudget(next)).toBe(0)
    expect(isBalanced(next)).toBe(true)
  })

  it('adding an income line raises the pool but never the planned total', () => {
    const vm = fromDto(dto())
    const next = withNewItem(vm, 'inc', {
      id: 'temp',
      name: 'Freelance',
      displayOrder: 1,
      plannedMinor: fromAmount(500),
      actualMinor: 0,
      actualIsTracked: false,
    })

    expect(totalIncome(next)).toBe(fromAmount(3500))
    expect(monthPlanned(next)).toBe(fromAmount(1300)) // unchanged
    expect(remainingToBudget(next)).toBe(fromAmount(2200))
  })

  it('removing an income line lowers the pool', () => {
    const vm = fromDto(dto())
    const next = withoutItem(vm, 'pay')

    expect(totalIncome(next)).toBe(0)
    expect(remainingToBudget(next)).toBe(fromAmount(-1300)) // 0 income, 1300 planned
  })

  it('withItemActual sets a line spent immutably; the pool is unaffected', () => {
    const vm = fromDto(dto())
    const next = withItemActual(vm, 'i2', fromAmount(50)) // Groceries spent 50

    expect(findItem(vm, 'i2')!.actualMinor).toBe(0) // original untouched
    expect(findItem(next, 'i2')!.actualMinor).toBe(fromAmount(50))
    expect(itemRemaining(findItem(next, 'i2')!)).toBe(fromAmount(150)) // 200 planned - 50 spent
    expect(remainingToBudget(next)).toBe(fromAmount(1700)) // unchanged: spending isn't planning
  })

  it('withItemName renames one line immutably', () => {
    const vm = fromDto(dto())
    const next = withItemName(vm, 'pay', 'Salary')

    expect(findItem(vm, 'pay')!.name).toBe('Take-home Pay')
    expect(findItem(next, 'pay')!.name).toBe('Salary')
  })

  it('withNewCategory appends a group immutably without touching the pool', () => {
    const vm = fromDto(dto())
    const next = withNewCategory(vm, {
      id: 'c-new',
      name: 'Subscriptions',
      kind: 'expense',
      displayOrder: 9,
      items: [],
    })

    expect(vm.categories).toHaveLength(3) // original untouched
    expect(next.categories).toHaveLength(4)
    expect(totalIncome(next)).toBe(fromAmount(3000)) // empty group adds nothing
    expect(monthPlanned(next)).toBe(fromAmount(1300))
  })

  it('withCategoryName renames a group immutably', () => {
    const vm = fromDto(dto())
    const next = withCategoryName(vm, 'c1', 'Home')

    expect(vm.categories.find((c) => c.id === 'c1')!.name).toBe('Housing')
    expect(next.categories.find((c) => c.id === 'c1')!.name).toBe('Home')
  })

  it('withoutCategory removes a group and its lines from the totals', () => {
    const vm = fromDto(dto())
    const next = withoutCategory(vm, 'c1') // drop Housing (Rent 1100)

    expect(next.categories.find((c) => c.id === 'c1')).toBeUndefined()
    expect(monthPlanned(next)).toBe(fromAmount(200)) // only Food's 200 remains
    expect(remainingToBudget(next)).toBe(fromAmount(2800))
  })

  it('maps a fund group and counts its contribution as budgeted money', () => {
    const d = dto()
    d.categories.push({
      id: 'f1',
      name: 'Funds',
      kind: 'Fund',
      displayOrder: 0,
      totalPlanned: 100,
      totalActual: 0,
      items: [
        {
          id: 'car', name: 'Car', displayOrder: 0, plannedAmount: 100, actualAmount: 30,
          remaining: 70, isActualTracked: true, fundId: 'fund-car', fundAvailable: 170,
        },
      ],
    })
    const vm = fromDto(d)

    const fund = vm.categories.find(isFund)!
    expect(fund.kind).toBe('fund')
    expect(fund.items[0].fundAvailableMinor).toBe(fromAmount(170)) // rolled-over balance
    // The 100 contribution joins the 1300 of expenses in the planned pool.
    expect(monthPlanned(vm)).toBe(fromAmount(1400))
    expect(remainingToBudget(vm)).toBe(fromAmount(1600))
  })

  it('withItemBill sets/clears a due day; clearing also marks it unpaid', () => {
    const vm = fromDto(dto())
    const billed = withItemBill(vm, 'i1', 15) // Rent due on the 15th
    expect(findItem(billed, 'i1')!.dueDay).toBe(15)

    const paid = withItemPaid(billed, 'i1', true)
    expect(findItem(paid, 'i1')!.isPaid).toBe(true)

    // Clearing the due day drops the bill and resets paid.
    const cleared = withItemBill(paid, 'i1', null)
    expect(findItem(cleared, 'i1')!.dueDay).toBeNull()
    expect(findItem(cleared, 'i1')!.isPaid).toBe(false)
    // immutability: original untouched
    expect(findItem(vm, 'i1')!.dueDay).toBeNull()
  })

  it('billsSummary counts bills and totals what is unpaid', () => {
    let vm = fromDto(dto())
    vm = withItemBill(vm, 'i1', 1) // Rent 1100, due 1st
    vm = withItemBill(vm, 'i2', 20) // Groceries 200, due 20th
    vm = withItemPaid(vm, 'i1', true) // Rent paid

    const s = billsSummary(vm)
    expect(s.total).toBe(2)
    expect(s.paid).toBe(1)
    expect(s.unpaidMinor).toBe(fromAmount(200)) // only Groceries (unpaid) counts
  })
})
