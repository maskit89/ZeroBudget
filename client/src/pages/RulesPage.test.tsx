import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { CategorizationRuleDto } from '../types'

const { mockGet, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, put: mockPut, post: vi.fn(), delete: mockDelete },
  getToken: () => 'test-token',
  setToken: vi.fn(),
}))

import { RulesPage } from './RulesPage'
import { AuthProvider } from '../auth/AuthContext'

function rule(): CategorizationRuleDto {
  return { id: 'r1', payee: 'tesco', categoryName: 'Food', itemName: 'Groceries' }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RulesPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RulesPage', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  it('lists learned rules and re-points one to a new line', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [rule()] })
    mockPut.mockResolvedValue({ data: { ...rule(), categoryName: 'Household', itemName: 'Cleaning' } })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Edit rule for tesco', {}, { timeout: 5000 }))
    const category = screen.getByLabelText('Category for tesco')
    await user.clear(category)
    await user.type(category, 'Household')
    const line = screen.getByLabelText('Line for tesco')
    await user.clear(line)
    await user.type(line, 'Cleaning')
    await user.click(screen.getByLabelText('Save rule for tesco'))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/rules/r1', { categoryName: 'Household', itemName: 'Cleaning' }),
    )
    expect(await screen.findByText('Cleaning', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('suggests your real category and line names while editing', { timeout: 15000 }, async () => {
    mockGet.mockImplementation((url?: string) => {
      if (url === '/rules') return Promise.resolve({ data: [rule()] })
      if (url === '/budget/line-options') {
        return Promise.resolve({
          data: [
            { categoryName: 'Household', itemNames: ['Cleaning', 'Repairs'] },
            { categoryName: 'Food', itemNames: ['Groceries'] },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })
    const user = userEvent.setup()

    const { container } = renderPage()

    await user.click(await screen.findByLabelText('Edit rule for tesco', {}, { timeout: 5000 }))

    // The category input is backed by a datalist of the user's real categories.
    const category = screen.getByLabelText('Category for tesco')
    const categoryListId = category.getAttribute('list')
    expect(categoryListId).toBeTruthy()
    await waitFor(() =>
      expect(container.querySelector(`#${categoryListId} option[value="Household"]`)).toBeTruthy(),
    )

    // Choosing a known category narrows the line suggestions to that category's lines.
    await user.clear(category)
    await user.type(category, 'Household')
    const line = screen.getByLabelText('Line for tesco')
    const itemListId = line.getAttribute('list')
    await waitFor(() =>
      expect(container.querySelector(`#${itemListId} option[value="Cleaning"]`)).toBeTruthy(),
    )
    expect(container.querySelector(`#${itemListId} option[value="Groceries"]`)).toBeFalsy()
  })

  it('deletes a rule', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [rule()] })
    mockDelete.mockResolvedValue({ data: null })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByLabelText('Delete rule for tesco', {}, { timeout: 5000 }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/rules/r1'))
    await waitFor(() => expect(screen.queryByText('tesco')).not.toBeInTheDocument())
  })

  it('shows an empty state when there are no rules', { timeout: 15000 }, async () => {
    mockGet.mockResolvedValue({ data: [] })

    renderPage()

    expect(await screen.findByText(/No rules yet/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
