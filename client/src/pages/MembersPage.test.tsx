import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { AccountDto, HouseholdMemberDto, MemberSpendingDto } from '../types'

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

const accountsData: AccountDto[] = [
  { id: 'acc1', name: 'Chris Savings', type: 1, currency: 'EUR', openingBalance: 0, currentBalance: 0, displayOrder: 0 },
]

// The page fetches /members and /accounts on mount, and re-fetches /members after
// each mutation, so the GET mock is URL-aware and returns the current member list.
let membersData: HouseholdMemberDto[] = []
let spendingData: MemberSpendingDto[] = []

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
    membersData = []
    spendingData = []
    mockGet.mockImplementation((url: string) => {
      if (url === '/accounts') return Promise.resolve({ data: accountsData })
      if (url === '/members/spending') return Promise.resolve({ data: spendingData })
      return Promise.resolve({ data: membersData })
    })
  })

  it('lists members with income and share', { timeout: 15000 }, async () => {
    membersData = [member(), member({ id: 'm2', name: 'Liza', netMonthlyIncome: 4000, displayOrder: 1, incomeSharePct: 0.4 })]

    renderPage()

    const table = within(await screen.findByRole('table', {}, { timeout: 5000 }))
    expect(table.getByText('Chris')).toBeInTheDocument()
    expect(table.getByText('Liza')).toBeInTheDocument()
    expect(table.getByText(/6\.000,00/)).toBeInTheDocument()
    expect(table.getByText('60.0%')).toBeInTheDocument()
  })

  it('shows attributed spend per member', { timeout: 15000 }, async () => {
    membersData = [member(), member({ id: 'm2', name: 'Liza', displayOrder: 1, incomeSharePct: 0.4 })]
    spendingData = [
      { memberId: 'm1', name: 'Chris', spent: 320 },
      { memberId: 'm2', name: 'Liza', spent: 180 },
    ]

    renderPage()

    const table = within(await screen.findByRole('table', {}, { timeout: 5000 }))
    expect(table.getByText(/320,00/)).toBeInTheDocument()
    expect(table.getByText(/180,00/)).toBeInTheDocument()
  })

  it('adds a member with a savings account', { timeout: 15000 }, async () => {
    membersData = []
    mockPost.mockImplementation(() => {
      membersData = [member({ id: 'm9', personalSavingsAccountId: 'acc1', incomeSharePct: 1 })]
      return Promise.resolve({ data: membersData[0] })
    })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Member name', {}, { timeout: 5000 }), 'Chris')
    await user.type(screen.getByLabelText('Net monthly income'), '6000')
    await user.selectOptions(screen.getByLabelText('Savings account'), 'acc1')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/members',
        expect.objectContaining({ name: 'Chris', netMonthlyIncome: 6000, personalSavingsAccountId: 'acc1' }),
      ),
    )
    expect(await screen.findByRole('table', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('archives a member', { timeout: 15000 }, async () => {
    membersData = [member(), member({ id: 'm2', name: 'Liza', displayOrder: 1 })]
    mockPut.mockImplementation(() => {
      membersData = [member({ id: 'm2', name: 'Liza', displayOrder: 1 })]
      return Promise.resolve({ data: null })
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Archive Chris', {}, { timeout: 5000 }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/members/m1/archive', { archived: true }))
    await waitFor(() => expect(screen.queryByText('Chris')).not.toBeInTheDocument())
  })

  it('shows a solo-friendly empty state when there are no members', { timeout: 15000 }, async () => {
    membersData = []

    renderPage()

    expect(await screen.findByText(/Budgeting on your own\?/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
