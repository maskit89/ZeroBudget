import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { BudgetMonthDto, PaycheckDto } from '../types'

const { mockGet, mockPut, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, put: mockPut, post: mockPost, delete: mockDelete },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { PaychecksPage } from './PaychecksPage'
import { AuthProvider } from '../auth/AuthContext'

function budget(): BudgetMonthDto {
  return {
    id: 'm1', key: '2026-06', year: 2026, month: 6, baseCurrency: 'EUR',
    totalIncome: 2000, totalPlanned: 1400, remainingToBudget: 600, isBalanced: false,
    categories: [
      { id: 'inc', name: 'Income', kind: 'Income', displayOrder: 0, totalPlanned: 2000, totalActual: 0,
        items: [{ id: 'i-salary', name: 'Salary', displayOrder: 0, plannedAmount: 2000, actualAmount: 0, remaining: 2000, isActualTracked: false }] },
      { id: 'house', name: 'Housing', kind: 'Expense', displayOrder: 0, totalPlanned: 1400, totalActual: 0,
        items: [
          { id: 'i-rent', name: 'Rent', displayOrder: 0, plannedAmount: 1000, actualAmount: 0, remaining: 1000, isActualTracked: false },
          { id: 'i-food', name: 'Food', displayOrder: 1, plannedAmount: 400, actualAmount: 0, remaining: 400, isActualTracked: false },
        ] },
    ],
  }
}

function paycheck(): PaycheckDto {
  return {
    id: 'p1', name: '1st paycheck', date: '2026-06-01', plannedAmount: 1500,
    allocatedAmount: 0, remaining: 1500, displayOrder: 0, allocations: [],
  }
}

function mockLoad(paychecks: PaycheckDto[], hasMonth = true) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/budget/current') {
      return hasMonth ? Promise.resolve({ data: budget() }) : Promise.reject(new Error('404'))
    }
    if (url.startsWith('/paychecks')) return Promise.resolve({ data: paychecks })
    return Promise.resolve({ data: {} })
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PaychecksPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('PaychecksPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockPost.mockReset()
    mockDelete.mockReset()
  })

  it('lists paychecks with their remaining-to-assign', { timeout: 15000 }, async () => {
    mockLoad([paycheck()])

    renderPage()

    expect(await screen.findByText('1st paycheck', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/left to assign/)).toBeInTheDocument()
  })

  it('adds a paycheck', { timeout: 15000 }, async () => {
    mockLoad([])
    mockPost.mockResolvedValue({ data: paycheck() })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Paycheck name', {}, { timeout: 5000 }), '1st paycheck')
    await user.type(screen.getByLabelText('Paycheck amount'), '1500')
    await user.click(screen.getByRole('button', { name: 'Add paycheck' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/paychecks',
        expect.objectContaining({ budgetMonthId: 'm1', name: '1st paycheck', plannedAmount: 1500 }),
      ),
    )
  })

  it('allocates a paycheck across budget lines', { timeout: 15000 }, async () => {
    mockLoad([paycheck()])
    mockPut.mockResolvedValue({
      data: {
        ...paycheck(), allocatedAmount: 1000, remaining: 500,
        allocations: [{ id: 'al1', budgetItemId: 'i-rent', budgetItemName: 'Rent', amount: 1000 }],
      },
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Allocate 1st paycheck', {}, { timeout: 5000 }))
    await user.selectOptions(screen.getByLabelText('Allocation 1 line'), 'i-rent')
    await user.type(screen.getByLabelText('Allocation 1 amount'), '1000')
    await user.click(screen.getByLabelText('Save allocations for 1st paycheck'))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/paychecks/p1/allocations', {
        allocations: [{ budgetItemId: 'i-rent', amount: 1000 }],
      }),
    )
    // The saved allocation shows as a chip (the editor, with its line <option>s, has closed).
    expect(await screen.findByText(/Rent/, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('prompts to create a budget when the month has none', { timeout: 15000 }, async () => {
    mockLoad([], false)

    renderPage()

    expect(
      await screen.findByText(/Create this month's budget/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
  })
})
