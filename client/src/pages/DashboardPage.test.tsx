import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { BudgetMonthDto } from '../types'

// Control the API from the tests. vi.hoisted lets the mock factory below
// reference these before the module under test is imported.
const { mockGet, mockPut } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPut: vi.fn() }))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, put: mockPut, post: vi.fn() },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { DashboardPage } from './DashboardPage'
import { AuthProvider } from '../auth/AuthContext'

function budget(): BudgetMonthDto {
  return {
    id: 'm1',
    key: '2026-06',
    year: 2026,
    month: 6,
    baseCurrency: 'EUR',
    totalIncome: 3000,
    totalPlanned: 1100,
    remainingToBudget: 1900,
    isBalanced: false,
    categories: [
      {
        id: 'c1',
        name: 'Housing',
        displayOrder: 0,
        totalPlanned: 1100,
        totalActual: 0,
        items: [
          { id: 'i-rent', name: 'Rent', displayOrder: 0, plannedAmount: 1100, actualAmount: 0, remaining: 1100 },
        ],
      },
    ],
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage optimistic editing', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
  })

  it('optimistically drives Remaining to €0,00 on a successful edit', async () => {
    mockGet.mockResolvedValue({ data: budget() })
    mockPut.mockResolvedValue({ data: {} })
    const user = userEvent.setup()

    renderPage()

    const input = (await screen.findByRole('textbox')) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '3000') // assign the remaining €1.900 to Rent
    await user.tab() // blur -> commit

    // Banner flips to the balanced state and the API was called with the amount.
    expect(await screen.findByText(/Every Euro has a job/)).toBeInTheDocument()
    expect(mockPut).toHaveBeenCalledWith('/budget/items/i-rent', { plannedAmount: 3000 })
  })

  it('rolls back to the previous value and shows an error when the save fails', async () => {
    mockGet.mockResolvedValue({ data: budget() })
    mockPut.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()

    renderPage()

    const input = (await screen.findByRole('textbox')) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '3000')
    await user.tab()

    // The failure surfaces and the field reverts to its pre-edit value.
    expect(await screen.findByText(/reverted to the previous value/)).toBeInTheDocument()
    await waitFor(() => expect(input.value).toBe('1100'))
  })
})
