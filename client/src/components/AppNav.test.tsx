import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { FeatureFlags } from '../types'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, put: vi.fn(), post: vi.fn(), delete: vi.fn() },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { AppNav } from './AppNav'
import { FeatureProvider } from '../features/FeatureContext'

function renderNav() {
  return render(
    <MemoryRouter>
      <FeatureProvider>
        <AppNav active="budget" />
      </FeatureProvider>
    </MemoryRouter>,
  )
}

const flags = (over: Partial<FeatureFlags>): FeatureFlags => ({
  accounts: true, multiCurrency: true, camtImport: true, reports: true, ...over,
})

describe('AppNav (feature flags)', () => {
  beforeEach(() => mockGet.mockReset())

  it('shows every nav item when all features are on', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: flags({}) })

    renderNav()

    expect(await screen.findByText('Budget', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Paychecks')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
  })

  it('hides Accounts and Reports when their flags are off', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: flags({ accounts: false, reports: false }) })

    renderNav()

    // The core EveryDollar items always show…
    expect(await screen.findByText('Budget', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
    // …while the disabled differentiators are removed once the flags load.
    await waitFor(() => expect(screen.queryByText('Accounts')).not.toBeInTheDocument())
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
  })
})
