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
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { AccountPage } from './AccountPage'
import { AuthProvider } from '../auth/AuthContext'

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AccountPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AccountPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockGet.mockResolvedValue({
      data: { userId: 'u1', email: 'chris@x.com', displayName: 'Chris', role: 0, ownerId: 'u1', memberId: null },
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
})
