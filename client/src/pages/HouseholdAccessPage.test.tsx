import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { MembershipDto, MeResponse } from '../types'

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { HouseholdAccessPage } from './HouseholdAccessPage'
import { AuthProvider } from '../auth/AuthContext'

function me(role = 0): MeResponse {
  return { userId: 'u1', email: 'chris@x.com', displayName: 'Chris', role, ownerId: 'u1', memberId: null }
}

function membership(over: Partial<MembershipDto> = {}): MembershipDto {
  return {
    id: 'mem1',
    email: 'chris@x.com',
    displayName: 'Chris',
    role: 0,
    status: 0,
    memberId: null,
    isOwner: true,
    isSelf: true,
    createdUtc: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const liza = membership({
  id: 'mem2',
  email: 'liza@x.com',
  displayName: 'Liza',
  role: 1,
  status: 0,
  isOwner: false,
  isSelf: false,
})

let meRole = 0
let membersData: MembershipDto[] = []

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HouseholdAccessPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('HouseholdAccessPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
    meRole = 0
    membersData = []
    mockGet.mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: me(meRole) })
      if (url === '/access/members') return Promise.resolve({ data: membersData })
      if (url === '/members') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
  })

  it('lists the household logins with their status and role', async () => {
    membersData = [membership(), liza]

    renderPage()

    const table = within(await screen.findByRole('table', {}, { timeout: 5000 }))
    expect(table.getByText('Chris')).toBeInTheDocument()
    expect(table.getByText('Liza')).toBeInTheDocument()
    expect(table.getByText('liza@x.com')).toBeInTheDocument()
    // The owner row is locked to the "Owner" label; Liza's row is an editable role select.
    expect(table.getAllByText('Owner').length).toBeGreaterThan(0)
    expect(table.getByLabelText('Access level for Liza')).toBeInTheDocument()
  })

  it('invites a person with a temporary password (direct)', async () => {
    membersData = [membership()]
    mockPost.mockResolvedValue({ data: { membership: liza, inviteToken: null } })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Invitee email', {}, { timeout: 5000 }), 'liza@x.com')
    await user.type(screen.getByLabelText('Temporary password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create login' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/access/invite',
        expect.objectContaining({ email: 'liza@x.com', method: 0, tempPassword: 'password123' }),
      ),
    )
  })

  it('creates an invite link and shows it for copying', async () => {
    membersData = [membership()]
    mockPost.mockResolvedValue({ data: { membership: liza, inviteToken: 'TOKEN123' } })
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Invitee email', {}, { timeout: 5000 }), 'liza@x.com')
    await user.click(screen.getByRole('button', { name: 'Generate an invite link' }))
    await user.click(screen.getByRole('button', { name: 'Create invite link' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/access/invite', expect.objectContaining({ method: 1 })),
    )
    const link = (await screen.findByLabelText('Invite link')) as HTMLInputElement
    expect(link.value).toContain('code=TOKEN123')
  })

  it("changes a member's role", async () => {
    membersData = [membership(), liza]
    mockPut.mockResolvedValue({ data: liza })
    const user = userEvent.setup()

    renderPage()

    await user.selectOptions(await screen.findByLabelText('Access level for Liza', {}, { timeout: 5000 }), '3')

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/access/members/mem2/role', { role: 3 }))
  })

  it('removes a member', async () => {
    membersData = [membership(), liza]
    mockDelete.mockResolvedValue({ data: null })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Liza' }, { timeout: 5000 }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/access/members/mem2'))
  })

  it('shows an owner-only notice for non-owners', async () => {
    meRole = 1 // Admin
    membersData = [membership()]

    renderPage()

    expect(await screen.findByText('Owner only', {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
