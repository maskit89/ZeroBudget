import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountDto, ImportStatementResult } from '../types'

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, put: vi.fn(), delete: vi.fn() },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { ImportStatementButton } from './ImportStatementButton'

function accounts(): AccountDto[] {
  return [
    { id: 'a1', name: 'Everyday', type: 0, currency: 'EUR', openingBalance: 0, currentBalance: 0, displayOrder: 0 },
    { id: 'a2', name: 'Savings', type: 1, currency: 'EUR', openingBalance: 0, currentBalance: 0, displayOrder: 1 },
  ]
}

function importResult(): ImportStatementResult {
  return {
    totalEntries: 1, imported: 1, skippedDuplicates: 0, credits: 0, debits: 1, iban: null, autoCategorized: 0,
  }
}

const xmlFile = () => new File(['<Document/>'], 'statement.xml', { type: 'text/xml' })

describe('ImportStatementButton', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
  })

  it('imports into the chosen account', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: accounts() })
    mockPost.mockResolvedValue({ data: importResult() })
    const onImported = vi.fn()
    const user = userEvent.setup()

    render(<ImportStatementButton onImported={onImported} onError={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Import into account', {}, { timeout: 5000 }), 'a1')
    await user.upload(screen.getByLabelText('Statement file'), xmlFile())

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/import/camt053', expect.any(FormData)))
    const form = mockPost.mock.calls[0][1] as FormData
    expect(form.get('accountId')).toBe('a1')
    expect(form.get('file')).toBeInstanceOf(File)
    await waitFor(() => expect(onImported).toHaveBeenCalled())
  })

  it('imports without an account when none is chosen', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })
    mockPost.mockResolvedValue({ data: importResult() })
    const user = userEvent.setup()

    render(<ImportStatementButton onImported={vi.fn()} onError={vi.fn()} />)

    // No accounts → no picker.
    await waitFor(() =>
      expect(screen.queryByLabelText('Import into account')).not.toBeInTheDocument(),
    )
    await user.upload(screen.getByLabelText('Statement file'), xmlFile())

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    const form = mockPost.mock.calls[0][1] as FormData
    expect(form.get('accountId')).toBeNull()
  })
})
