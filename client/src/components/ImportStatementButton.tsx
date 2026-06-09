import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { api } from '../lib/api'
import type { AccountDto, ImportStatementResult } from '../types'

interface Props {
  onImported: (result: ImportStatementResult) => void
  onError: (message: string) => void
}

/** Uploads a CAMT.053 XML statement to the API and reports the import summary. */
export function ImportStatementButton({ onImported, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [accountId, setAccountId] = useState('')

  // Offer the user's accounts as import targets (optional).
  useEffect(() => {
    let cancelled = false
    api
      .get<AccountDto[]>('/accounts')
      .then(({ data }) => !cancelled && setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file) // field name must match the controller's IFormFile param
      if (accountId) form.append('accountId', accountId)
      const { data } = await api.post<ImportStatementResult>('/import/camt053', form)
      onImported(data)
    } catch (err) {
      let message = 'Import failed.'
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { title?: string; error?: string } | undefined
        message = body?.title ?? body?.error ?? message
      }
      onError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {accounts.length > 0 && (
        <select
          value={accountId}
          aria-label="Import into account"
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <option value="">No account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        aria-label="Statement file"
        className="hidden"
        onChange={onFileChosen}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? 'Importing…' : 'Import statement'}
      </button>
    </div>
  )
}
