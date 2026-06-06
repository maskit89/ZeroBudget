import { describe, it, expect } from 'vitest'
import { buildItemOptions, transactionTypeLabel, signedAmountMinorFromAmount } from './transactions'
import type { BudgetMonthDto } from '../types'

const month = {
  categories: [
    { name: 'Housing', items: [{ id: 'i1', name: 'Rent' }, { id: 'i2', name: 'Utilities' }] },
    { name: 'Food', items: [{ id: 'i3', name: 'Groceries' }] },
  ],
} as unknown as BudgetMonthDto

describe('transactions helpers', () => {
  it('groups budget items by category for the dropdown', () => {
    const groups = buildItemOptions(month)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({
      category: 'Housing',
      items: [{ id: 'i1', name: 'Rent' }, { id: 'i2', name: 'Utilities' }],
    })
    expect(groups[1].items[0].name).toBe('Groceries')
  })

  it('returns no options when there is no budget', () => {
    expect(buildItemOptions(null)).toEqual([])
  })

  it('labels transaction direction', () => {
    expect(transactionTypeLabel(0)).toBe('Expense')
    expect(transactionTypeLabel(1)).toBe('Income')
  })

  it('signs the amount by direction (integer minor units)', () => {
    expect(signedAmountMinorFromAmount({ amount: 25, type: 0 })).toBe(-250_000) // expense
    expect(signedAmountMinorFromAmount({ amount: 25, type: 1 })).toBe(250_000) // income
  })
})
