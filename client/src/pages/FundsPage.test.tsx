import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { SinkingFundDto } from '../types'

const { mockGet, mockPut, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, put: mockPut, post: mockPost },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { FundsPage } from './FundsPage'
import { AuthProvider } from '../auth/AuthContext'

function fund(over: Partial<SinkingFundDto> = {}): SinkingFundDto {
  return {
    id: 'f1',
    name: 'Home insurance',
    kind: 1,
    targetAmount: 300,
    targetDate: '2026-12-01',
    coverStart: null,
    coverEnd: null,
    accrual: 0,
    recurAnnually: true,
    openingBalance: 0,
    openingAsOf: null,
    fundingAccountId: null,
    isArchived: false,
    currentBalance: 120,
    requiredMonthlyContribution: 25,
    projectedFullyFundedDate: '2026-11-01',
    status: 'OnTrack',
    ...over,
  }
}

function funds(): SinkingFundDto[] {
  return [
    fund(),
    fund({ id: 'f2', name: 'Holiday', kind: 0, targetAmount: 1000, currentBalance: -40, requiredMonthlyContribution: 0, status: 'Overspent', targetDate: null, projectedFullyFundedDate: null }),
  ]
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <FundsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('FundsPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockPost.mockReset()
  })

  it('lists funds with status and balances', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: funds() })

    renderPage()

    expect(await screen.findByText('Home insurance', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Holiday')).toBeInTheDocument()
    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByText('Overspent')).toBeInTheDocument()
    // Home insurance balance 120,00 of 300,00.
    expect(screen.getByText(/120,00/)).toBeInTheDocument()
  })

  it('adds a fund', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })
    mockPost.mockResolvedValue({ data: fund({ id: 'f9', name: 'Vacation', kind: 0, targetAmount: 1200, status: 'OnTrack' }) })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Fund name', {}, { timeout: 5000 }), 'Vacation')
    await user.type(screen.getByLabelText('Target amount'), '1200')
    await user.click(screen.getByRole('button', { name: 'Add fund' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/sinkingfunds',
        expect.objectContaining({ name: 'Vacation', targetAmount: 1200, kind: 0, accrual: 1 }),
      ),
    )
    expect(await screen.findByText('Vacation', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('archives a fund', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: funds() })
    mockPut.mockResolvedValue({ data: null })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Archive Home insurance', {}, { timeout: 5000 }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/sinkingfunds/f1/archive', { archived: true }),
    )
    await waitFor(() => expect(screen.queryByText('Home insurance')).not.toBeInTheDocument())
  })

  it('shows an empty state when there are no funds', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })

    renderPage()

    expect(await screen.findByText(/No sinking funds yet/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
