import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { HouseholdMemberDto } from '../types'

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

import { MembersPage } from './MembersPage'
import { AuthProvider } from '../auth/AuthContext'

function member(over: Partial<HouseholdMemberDto> = {}): HouseholdMemberDto {
  return {
    id: 'm1',
    name: 'Chris',
    netMonthlyIncome: 6000,
    personalSavingsAccountId: null,
    displayOrder: 0,
    isArchived: false,
    incomeSharePct: 0.6,
    ...over,
  }
}

function members(): HouseholdMemberDto[] {
  return [member(), member({ id: 'm2', name: 'Liza', netMonthlyIncome: 4000, displayOrder: 1, incomeSharePct: 0.4 })]
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <MembersPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('MembersPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockPost.mockReset()
  })

  it('lists members with income and share', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: members() })

    renderPage()

    const table = within(await screen.findByRole('table', {}, { timeout: 5000 }))
    expect(table.getByText('Chris')).toBeInTheDocument()
    expect(table.getByText('Liza')).toBeInTheDocument()
    expect(table.getByText(/6\.000,00/)).toBeInTheDocument() // 6000 in de-DE
    expect(table.getByText('60.0%')).toBeInTheDocument()
  })

  it('adds a member', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValueOnce({ data: [] }) // mount
    mockPost.mockResolvedValue({ data: member({ id: 'm9', incomeSharePct: 1 }) })
    mockGet.mockResolvedValueOnce({ data: [member({ id: 'm9', incomeSharePct: 1 })] }) // refetch
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Member name', {}, { timeout: 5000 }), 'Chris')
    await user.type(screen.getByLabelText('Net monthly income'), '6000')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/members',
        expect.objectContaining({ name: 'Chris', netMonthlyIncome: 6000, personalSavingsAccountId: null }),
      ),
    )
    expect(await screen.findByRole('table', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('archives a member', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValueOnce({ data: members() }) // mount
    mockPut.mockResolvedValue({ data: null })
    mockGet.mockResolvedValueOnce({ data: [members()[1]] }) // refetch — only Liza
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Archive Chris', {}, { timeout: 5000 }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/members/m1/archive', { archived: true }))
    await waitFor(() => expect(screen.queryByText('Chris')).not.toBeInTheDocument())
  })

  it('shows an empty state when there are no members', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })

    renderPage()

    expect(await screen.findByText(/No members yet/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
