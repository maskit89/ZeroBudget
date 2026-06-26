import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { HouseholdMemberDto } from '../types'

const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, put: mockPut },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { AccountPage } from './AccountPage'
import { AuthProvider } from '../auth/AuthContext'
import { HouseholdProvider } from '../features/HouseholdContext'

const meData = { userId: 'u1', email: 'chris@x.com', displayName: 'Chris', role: 0, ownerId: 'u1', memberId: null }

function member(over: Partial<HouseholdMemberDto> = {}): HouseholdMemberDto {
  return { id: 'm1', name: 'Chris', netMonthlyIncome: 6000, personalSavingsAccountId: null, displayOrder: 0, isArchived: false, incomeSharePct: 1, ...over }
}

// The Sharing card reads /members; everything else (/auth/me) returns the login.
let membersData: HouseholdMemberDto[] = []

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HouseholdProvider>
          <AccountPage />
        </HouseholdProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AccountPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    membersData = []
    mockGet.mockImplementation((url: string) => {
      if (url === '/members') return Promise.resolve({ data: membersData })
      return Promise.resolve({ data: meData })
    })
  })

  it('changes the password', async () => {
    mockPost.mockResolvedValue({ data: null })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Current password'), 'oldpassword')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1',
      }),
    )
    expect(await screen.findByText(/password has been changed/)).toBeInTheDocument()
  })

  it('saves name + money-display preferences', async () => {
    mockPut.mockResolvedValue({
      data: {
        firstName: 'Chris',
        lastName: 'M',
        displayName: 'Chris M',
        preferredCurrency: 'GBP',
        numberFormat: 'comma-dot',
      },
    })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('First name'), 'Chris')
    await user.type(screen.getByLabelText('Last name'), 'M')
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.selectOptions(screen.getByLabelText('Number format'), 'comma-dot')
    await user.click(screen.getByRole('button', { name: 'Save preferences' }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/auth/preferences', {
        firstName: 'Chris',
        lastName: 'M',
        preferredCurrency: 'GBP',
        numberFormat: 'comma-dot',
      }),
    )
    expect(await screen.findByText(/preferences have been saved/)).toBeInTheDocument()
  })

  it('rejects mismatched new passwords without calling the API', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Current password'), 'oldpassword')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'different1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText(/do not match/)).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('offers to share the budget when solo (no members)', async () => {
    membersData = []

    renderPage()

    expect(
      await screen.findByRole('button', { name: 'Share this budget' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Manage members →')).not.toBeInTheDocument()
  })

  it('still offers to share when there is a single member (still solo)', async () => {
    membersData = [member()]

    renderPage()

    expect(
      await screen.findByRole('button', { name: 'Share this budget' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Manage members →')).not.toBeInTheDocument()
  })

  it('links to manage members when the budget is shared (2+ members)', async () => {
    membersData = [member(), member({ id: 'm2', name: 'Liza' })]

    renderPage()

    expect(await screen.findByText('Manage members →', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/shared between 2 people/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share this budget' })).not.toBeInTheDocument()
  })
})
