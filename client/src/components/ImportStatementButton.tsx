import { useRef, useState } from 'react'
import axios from 'axios'
import { api } from '../lib/api'
import type { ImportStatementResult } from '../types'

interface Props {
  onImported: (result: ImportStatementResult) => void
  onError: (message: string) => void
}

/** Uploads a CAMT.053 XML statement to the API and reports the import summary. */
export function ImportStatementButton({ onImported, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file) // field name must match the controller's IFormFile param
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
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
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
    </>
  )
}
