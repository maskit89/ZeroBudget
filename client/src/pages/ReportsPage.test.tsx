import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { AnnualSummaryDto, BudgetMonthDto, BudgetTrendsDto } from '../types'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, put: vi.fn(), post: vi.fn(), delete: vi.fn() },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { ReportsPage } from './ReportsPage'
import { AuthProvider } from '../auth/AuthContext'

function trends(): BudgetTrendsDto {
  return {
    points: [
      { year: 2026, month: 5, key: '2026-05', income: 3000, planned: 2800, spent: 2500 },
      { year: 2026, month: 6, key: '2026-06', income: 3000, planned: 2900, spent: 2700 },
    ],
    totalIncome: 6000,
    totalSpent: 5200,
  }
}

function latestMonth(): BudgetMonthDto {
  return {
    id: 'm6', key: '2026-06', year: 2026, month: 6, baseCurrency: 'EUR',
    totalIncome: 3000, totalPlanned: 2900, remainingToBudget: 100, isBalanced: false,
    categories: [
      { id: 'inc', name: 'Income', kind: 'Income', displayOrder: 0, totalPlanned: 3000, totalActual: 3000, items: [] },
      { id: 'house', name: 'Housing', kind: 'Expense', displayOrder: 0, totalPlanned: 1500, totalActual: 1500, items: [] },
      { id: 'food', name: 'Food', kind: 'Expense', displayOrder: 1, totalPlanned: 800, totalActual: 1200, items: [] },
    ],
  }
}

function annual(year: number): AnnualSummaryDto {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    key: `${year}-${String(i + 1).padStart(2, '0')}`,
    hasBudget: i + 1 === 6,
    income: i + 1 === 6 ? 3000 : 0,
    planned: i + 1 === 6 ? 2900 : 0,
    spent: i + 1 === 6 ? 2700 : 0,
  }))
  return { year, months, totalIncome: 3000, totalPlanned: 2900, totalSpent: 2700 }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ReportsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ReportsPage', () => {
  beforeEach(() => mockGet.mockReset())

  it('shows the income-vs-spending trend and spending by category', { timeout: 15000 }, async () => {
    mockGet.mockImplementation((url?: string) => {
      if (url?.startsWith('/reports/trends')) return Promise.resolve({ data: trends() })
      if (url === '/budget/2026/6') return Promise.resolve({ data: latestMonth() })
      return Promise.resolve({ data: {} })
    })

    renderPage()

    // Per-month trend (the section heading is unique; the labels confirm both months).
    expect(await screen.findByText('Income vs spending', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('May 2026')).toBeInTheDocument() // unique to the trend
    expect(screen.getAllByText('Jun 2026').length).toBeGreaterThan(0) // trend + breakdown subtitle
    // The window summary card.
    expect(screen.getByText('Net')).toBeInTheDocument()

    // Category breakdown loads from the latest month (Food spent more than Housing here).
    expect(await screen.findByLabelText('Spending for Food', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByLabelText('Spending for Housing')).toBeInTheDocument()
    // Income groups are excluded from the spending breakdown.
    expect(screen.queryByLabelText('Spending for Income')).not.toBeInTheDocument()
  })

  it('shows the annual overview and navigates between years', { timeout: 15000 }, async () => {
    mockGet.mockImplementation((url?: string) => {
      if (url?.startsWith('/reports/trends')) return Promise.resolve({ data: trends() })
      if (url === '/budget/2026/6') return Promise.resolve({ data: latestMonth() })
      if (url === '/reports/annual/2026') return Promise.resolve({ data: annual(2026) })
      if (url === '/reports/annual/2025') return Promise.resolve({ data: annual(2025) })
      return Promise.resolve({ data: {} })
    })
    const user = userEvent.setup()

    renderPage()

    // Defaults to the latest budget's year (2026, from the trend).
    expect(await screen.findByText('Annual overview', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Previous year'))

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/reports/annual/2025'))
    expect(await screen.findByText('2025', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows an empty state when there is no budget data', { timeout: 15000 }, async () => {
    mockGet.mockImplementation((url?: string) => {
      if (url?.startsWith('/reports/trends')) {
        return Promise.resolve({ data: { points: [], totalIncome: 0, totalSpent: 0 } })
      }
      return Promise.resolve({ data: {} })
    })

    renderPage()

    expect(await screen.findByText(/No budget data yet/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
