import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { AccountDto } from '../types'

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

import { AccountsPage } from './AccountsPage'
import { AuthProvider } from '../auth/AuthContext'

function accounts(): AccountDto[] {
  return [
    { id: 'a1', name: 'Everyday', type: 0, currency: 'EUR', openingBalance: 100, currentBalance: 250, displayOrder: 0 },
    { id: 'a2', name: 'Visa', type: 3, currency: 'EUR', openingBalance: 0, currentBalance: -75, displayOrder: 1 },
  ]
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AccountsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AccountsPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockPost.mockReset()
    mockDelete.mockReset()
  })

  it('lists accounts with balances and a per-currency net', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: accounts() })

    renderPage()

    const table = within(await screen.findByRole('table', {}, { timeout: 5000 }))
    expect(table.getByText('Everyday')).toBeInTheDocument()
    expect(table.getByText('Visa')).toBeInTheDocument()
    // The credit card's type label shows in its row (the add-form select also lists it).
    expect(table.getByText('Credit card')).toBeInTheDocument()
    // Net across the two EUR accounts: 250 + (−75) = 175.
    expect(screen.getByText('Net (EUR)')).toBeInTheDocument()
    expect(table.getByText(/175,00/)).toBeInTheDocument()
  })

  it('adds an account', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })
    mockPost.mockResolvedValue({
      data: { id: 'a9', name: 'Wallet', type: 2, currency: 'EUR', openingBalance: 40, currentBalance: 40, displayOrder: 0 },
    })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Account name', {}, { timeout: 5000 }), 'Wallet')
    await user.selectOptions(screen.getByLabelText('Account type'), '2')
    await user.type(screen.getByLabelText('Opening balance'), '40')
    await user.click(screen.getByRole('button', { name: 'Add account' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/accounts',
        expect.objectContaining({ name: 'Wallet', type: 2, currency: 'EUR', openingBalance: 40 }),
      ),
    )
    // The new row appears in the table.
    const table = within(await screen.findByRole('table', {}, { timeout: 5000 }))
    expect(table.getByText('Wallet')).toBeInTheDocument()
  })

  it('deletes an account', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: accounts() })
    mockDelete.mockResolvedValue({ data: null })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Delete Everyday', {}, { timeout: 5000 }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/accounts/a1'))
    await waitFor(() => expect(screen.queryByText('Everyday')).not.toBeInTheDocument())
  })

  it('shows an empty state when there are no accounts', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })

    renderPage()

    expect(await screen.findByText(/No accounts yet/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
