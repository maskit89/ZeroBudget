import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { BudgetMonthDto, TransactionDto } from '../types'

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

import { TransactionsPage } from './TransactionsPage'
import { AuthProvider } from '../auth/AuthContext'

function budget(): BudgetMonthDto {
  return {
    id: 'm1', key: '2026-06', year: 2026, month: 6, baseCurrency: 'EUR',
    totalIncome: 3000, totalPlanned: 1000, remainingToBudget: 2000, isBalanced: false,
    categories: [
      {
        id: 'c1', name: 'Housing', kind: 'Expense', displayOrder: 0, totalPlanned: 1000, totalActual: 0,
        items: [
          { id: 'i-rent', name: 'Rent', displayOrder: 0, plannedAmount: 1000, actualAmount: 0, remaining: 1000, isActualTracked: false },
        ],
      },
    ],
  }
}

function tx(): TransactionDto {
  return {
    id: 't1', date: '2026-06-10', payee: 'Tesco', amount: 12.5, currency: 'EUR',
    exchangeRate: 1, baseAmount: 12.5, type: 0, bankReference: null,
    budgetItemId: null, budgetItemName: null,
  }
}

function mockLoad(transactions: TransactionDto[]) {
  mockGet.mockImplementation((url: string) =>
    url === '/transactions'
      ? Promise.resolve({ data: transactions })
      : Promise.resolve({ data: budget() }),
  )
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TransactionsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('TransactionsPage manual sheet', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockPost.mockReset()
    mockDelete.mockReset()
  })

  it('adds a manual transaction assigned to a line', { timeout: 15000 }, async () => {
    mockLoad([])
    mockPost.mockResolvedValue({
      data: { ...tx(), payee: 'Tesco', amount: 12.5, budgetItemId: 'i-rent', budgetItemName: 'Rent' },
    })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Transaction payee', {}, { timeout: 5000 }), 'Tesco')
    await user.type(screen.getByLabelText('Transaction amount'), '12,50')
    await user.selectOptions(screen.getByLabelText('Assign transaction to'), 'i-rent')
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({ payee: 'Tesco', amount: 12.5, type: 0, budgetItemId: 'i-rent' }),
      ),
    )
    expect(await screen.findByText('Tesco', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('rejects a non-positive amount without calling the API', { timeout: 15000 }, async () => {
    mockLoad([])
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Transaction amount', {}, { timeout: 5000 }), '0')
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))

    expect(await screen.findByText(/valid amount/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('deletes a transaction', { timeout: 15000 }, async () => {
    mockLoad([tx()])
    mockDelete.mockResolvedValue({ data: null })
    const user = userEvent.setup()

    renderPage()

    const del = await screen.findByLabelText('Delete transaction: Tesco', {}, { timeout: 5000 })
    await user.click(del)

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/transactions/t1'))
    await waitFor(() => expect(screen.queryByText('Tesco')).not.toBeInTheDocument())
  })
})
