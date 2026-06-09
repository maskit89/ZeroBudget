import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { BudgetLineOptionDto, CategorizationRuleDto } from '../types'

export function RulesPage() {
  const { logout } = useAuth()
  const [rules, setRules] = useState<CategorizationRuleDto[]>([])
  const [options, setOptions] = useState<BudgetLineOptionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [eCategory, setECategory] = useState('')
  const [eItem, setEItem] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<CategorizationRuleDto[]>('/rules')
      .then(({ data }) => !cancelled && setRules(data))
      .catch(() => !cancelled && setError('Could not load your rules.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  // The user's real category/line names, to suggest valid rule targets.
  useEffect(() => {
    let cancelled = false
    api
      .get<BudgetLineOptionDto[]>('/budget/line-options')
      .then(({ data }) => !cancelled && setOptions(data))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Every distinct line name across all categories — the fallback item suggestions
  // before a known category is chosen.
  const allItemNames = useMemo(
    () => Array.from(new Set(options.flatMap((o) => o.itemNames ?? []))).sort((a, b) => a.localeCompare(b)),
    [options],
  )

  // When the typed category matches a known one, suggest just its lines; otherwise
  // offer every line name.
  const itemSuggestions = useMemo(() => {
    const match = options.find((o) => o.categoryName.toLowerCase() === eCategory.trim().toLowerCase())
    return match ? (match.itemNames ?? []) : allItemNames
  }, [options, eCategory, allItemNames])

  function startEdit(r: CategorizationRuleDto) {
    setEditingId(r.id)
    setECategory(r.categoryName)
    setEItem(r.itemName)
  }

  const saveEdit = useCallback(
    async (id: string) => {
      const categoryName = eCategory.trim()
      const itemName = eItem.trim()
      if (categoryName === '' || itemName === '') {
        setError('A rule needs both a category and a line.')
        return
      }
      setSavingId(id)
      setError(null)
      try {
        const { data } = await api.put<CategorizationRuleDto>(`/rules/${id}`, { categoryName, itemName })
        setRules((prev) => prev.map((r) => (r.id === id ? data : r)))
        setEditingId(null)
      } catch {
        setError('Could not save that rule.')
      } finally {
        setSavingId(null)
      }
    },
    [eCategory, eItem],
  )

  const remove = useCallback(async (id: string) => {
    setSavingId(id)
    setError(null)
    try {
      await api.delete(`/rules/${id}`)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('Could not delete that rule.')
    } finally {
      setSavingId(null)
    }
  }, [])

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💶</span>
              <h1 className="text-lg font-bold text-slate-800">ZeroBudget</h1>
            </div>
            <nav className="flex gap-1 text-sm">
              <Link to="/" className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100">
                Budget
              </Link>
              <Link
                to="/transactions"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Transactions
              </Link>
              <Link
                to="/accounts"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Accounts
              </Link>
              <Link
                to="/reports"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
              >
                Reports
              </Link>
              <span className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800">Rules</span>
            </nav>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Auto-categorization rules</h2>
          <p className="text-sm text-slate-500">
            ZeroBudget remembers a rule each time you assign a transaction to a budget line. On import,
            a matching payee is auto-assigned to the line of the same name. Re-point or remove rules here.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading && <p className="text-slate-500">Loading…</p>}

        {!loading && rules.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            No rules yet. Assign a transaction to a budget line on the Transactions page and ZeroBudget will
            remember it here.
          </div>
        )}

        {rules.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">When payee matches</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Line</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => {
                  const editing = editingId === r.id
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{r.payee}</td>
                      {editing ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={eCategory}
                              aria-label={`Category for ${r.payee}`}
                              list="rule-category-options"
                              onChange={(e) => setECategory(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={eItem}
                              aria-label={`Line for ${r.payee}`}
                              list="rule-item-options"
                              onChange={(e) => setEItem(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => saveEdit(r.id)}
                                disabled={savingId === r.id}
                                aria-label={`Save rule for ${r.payee}`}
                                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                aria-label="Cancel edit"
                                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 text-slate-600">{r.categoryName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{r.itemName}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(r)}
                                aria-label={`Edit rule for ${r.payee}`}
                                title="Edit rule"
                                className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(r.id)}
                                disabled={savingId === r.id}
                                aria-label={`Delete rule for ${r.payee}`}
                                title="Delete rule"
                                className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Suggestions for the inline rule editor, drawn from the user's real budgets. */}
        <datalist id="rule-category-options">
          {options.map((o) => (
            <option key={o.categoryName} value={o.categoryName} />
          ))}
        </datalist>
        <datalist id="rule-item-options">
          {itemSuggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </main>
    </div>
  )
}
