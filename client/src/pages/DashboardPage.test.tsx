import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { BudgetMonthDto } from '../types'

// Control the API from the tests. vi.hoisted lets the mock factory below
// reference these before the module under test is imported.
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

import { DashboardPage } from './DashboardPage'
import { AuthProvider } from '../auth/AuthContext'

// Income(Take-home Pay 3000) at the top + Housing(Rent 1100). Remaining = 1900.
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
        id: 'inc',
        name: 'Income',
        kind: 'Income',
        displayOrder: 0,
        totalPlanned: 3000,
        totalActual: 0,
        items: [
          { id: 'i-pay', name: 'Take-home Pay', displayOrder: 0, plannedAmount: 3000, actualAmount: 0, remaining: 3000, isActualTracked: false },
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
          { id: 'i-rent', name: 'Rent', displayOrder: 0, plannedAmount: 1100, actualAmount: 0, remaining: 1100, isActualTracked: false },
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
    mockPost.mockReset()
    mockDelete.mockReset()
  })

  it('optimistically drives Remaining to €0,00 on a successful edit', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    mockPut.mockResolvedValue({ data: {} })
    const user = userEvent.setup()

    renderPage()

    const input = (await screen.findByLabelText('Planned amount for Rent', {}, { timeout: 5000 })) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '3000') // assign the remaining €1.900 to Rent
    await user.tab() // blur -> commit

    // Banner flips to the balanced state and the API was called with the amount.
    expect(await screen.findByText(/Every Euro has a job/, {}, { timeout: 5000 })).toBeInTheDocument()
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/budget/items/i-rent', { plannedAmount: 3000 }),
    )
  })

  it('rolls back to the previous value and shows an error when the save fails', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    mockPut.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()

    renderPage()

    const input = (await screen.findByLabelText('Planned amount for Rent', {}, { timeout: 5000 })) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '3000')
    await user.tab()

    // The failure surfaces and the field reverts to its pre-edit value.
    expect(await screen.findByText(/reverted to the previous value/, {}, { timeout: 5000 })).toBeInTheDocument()
    await waitFor(() => expect(input.value).toBe('1100'), { timeout: 5000 })
  })

  it('adds an income source and reconciles from the server response', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    const withFreelance = budget()
    withFreelance.categories[0].items.push({
      id: 'i-free', name: 'Freelance', displayOrder: 1, plannedAmount: 0, actualAmount: 0, remaining: 0, isActualTracked: false,
    })
    mockPost.mockResolvedValue({ data: withFreelance })
    const user = userEvent.setup()

    renderPage()

    const addInput = await screen.findByLabelText('New income source name', {}, { timeout: 5000 })
    await user.type(addInput, 'Freelance')
    await user.click(screen.getByRole('button', { name: 'Add income source' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/budget/categories/inc/items', {
        name: 'Freelance',
        plannedAmount: 0,
      }),
    )
    expect(await screen.findByDisplayValue('Freelance', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('deletes an income source', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    const withoutPay = budget()
    withoutPay.categories[0].items = []
    mockDelete.mockResolvedValue({ data: withoutPay })
    const user = userEvent.setup()

    renderPage()

    const del = await screen.findByLabelText('Delete Take-home Pay', {}, { timeout: 5000 })
    await user.click(del)

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/budget/items/i-pay'))
  })

  it('saves a manually-entered spent amount for a line', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    mockPut.mockResolvedValue({ data: {} })
    const user = userEvent.setup()

    renderPage()

    const spent = (await screen.findByLabelText('Spent for Rent', {}, { timeout: 5000 })) as HTMLInputElement
    await user.clear(spent)
    await user.type(spent, '250')
    await user.tab() // blur -> commit

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/budget/items/i-rent/actual', { actualAmount: 250 }),
    )
  })

  it('saves a manually-entered received amount for an income line', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    mockPut.mockResolvedValue({ data: {} })
    const user = userEvent.setup()

    renderPage()

    const received = (await screen.findByLabelText('Received for Take-home Pay', {}, { timeout: 5000 })) as HTMLInputElement
    await user.clear(received)
    await user.type(received, '1800')
    await user.tab()

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/budget/items/i-pay/actual', { actualAmount: 1800 }),
    )
  })

  it('switches a line to transaction tracking via the mode toggle', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    const tracked = budget()
    tracked.categories[1].items[0].isActualTracked = true
    mockPut.mockResolvedValue({ data: tracked })
    const user = userEvent.setup()

    renderPage()

    const toggle = await screen.findByLabelText('Track Rent by transactions', {}, { timeout: 5000 })
    await user.click(toggle)

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/budget/items/i-rent/actual-mode', { trackByTransactions: true }),
    )
  })

  it('adds a category group and reconciles from the server response', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    const withSubs = budget()
    withSubs.categories.push({
      id: 'c-subs', name: 'Subscriptions', kind: 'Expense', displayOrder: 1, totalPlanned: 0, totalActual: 0, items: [],
    })
    mockPost.mockResolvedValue({ data: withSubs })
    const user = userEvent.setup()

    renderPage()

    const input = await screen.findByLabelText('New category group name', {}, { timeout: 5000 })
    await user.type(input, 'Subscriptions')
    await user.click(screen.getByRole('button', { name: 'Add category group' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/budget/categories', { budgetMonthId: 'm1', name: 'Subscriptions' }),
    )
    expect(await screen.findByDisplayValue('Subscriptions', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('adds an expense line to a group', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    const withFuel = budget()
    withFuel.categories[1].items.push({
      id: 'i-fuel', name: 'Fuel', displayOrder: 1, plannedAmount: 0, actualAmount: 0, remaining: 0, isActualTracked: false,
    })
    mockPost.mockResolvedValue({ data: withFuel })
    const user = userEvent.setup()

    renderPage()

    const input = await screen.findByLabelText('Add a line to Housing', {}, { timeout: 5000 })
    await user.type(input, 'Fuel{Enter}') // Enter submits — avoids "+ Add" button ambiguity

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/budget/categories/c1/items', { name: 'Fuel', plannedAmount: 0 }),
    )
  })

  it('deletes a category group only after confirming', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: budget() })
    const withoutHousing = budget()
    withoutHousing.categories = withoutHousing.categories.filter((c) => c.id !== 'c1')
    mockDelete.mockResolvedValue({ data: withoutHousing })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Delete group Housing', {}, { timeout: 5000 }))
    // Nothing deleted until the second (confirm) click.
    expect(mockDelete).not.toHaveBeenCalled()
    await user.click(await screen.findByLabelText('Confirm delete Housing', {}, { timeout: 5000 }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/budget/categories/c1'))
  })
})
