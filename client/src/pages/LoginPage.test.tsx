import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost },
  getToken: () => null,
  setToken: vi.fn(),
}))

import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth/AuthContext'

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    mockGet.mockReset()
    mockPost.mockReset()
    mockGet.mockResolvedValue({
      data: { userId: 'u1', email: 'new@x.com', displayName: 'New User', role: 0, ownerId: 'u1', memberId: null },
    })
  })

  it('hides the registration-only fields in sign-in mode', () => {
    renderPage()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('submits the full profile + preferences when creating an account', async () => {
    mockPost.mockResolvedValue({
      data: {
        token: 'tok',
        expiresAtUtc: '2030-01-01T00:00:00Z',
        userId: 'u1',
        email: 'new@x.com',
        role: 0,
        displayName: 'New User',
      },
    })
    const user = userEvent.setup()
    renderPage()

    // The segmented toggle is the only "Create account" control until we switch mode.
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await user.type(screen.getByLabelText('First name'), 'New')
    await user.type(screen.getByLabelText('Last name'), 'User')
    await user.type(screen.getByLabelText('Email'), 'new@x.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.selectOptions(screen.getByLabelText('Number format'), 'comma-dot')
    await user.click(screen.getByRole('checkbox'))

    const submit = screen
      .getAllByRole('button', { name: 'Create account' })
      .find((b) => (b as HTMLButtonElement).type === 'submit')!
    await user.click(submit)

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        email: 'new@x.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        preferredCurrency: 'GBP',
        numberFormat: 'comma-dot',
        acceptedTerms: true,
      }),
    )
  })
})
