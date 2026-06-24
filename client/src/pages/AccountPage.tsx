import { useState, type FormEvent } from 'react'
import axios from 'axios'
import { AppShell } from '../components/AppShell'
import { Button, Card, ErrorBanner, Input, PageHeader } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { HOUSEHOLD_ROLE_LABELS } from '../types'

export function AccountPage() {
  const { email, displayName, role, changePassword } = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next !== confirm) {
      setError('The new passwords do not match.')
      return
    }
    if (next.length < 8) {
      setError('Use a new password of at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await changePassword(current, next)
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { errors?: string[]; error?: string } | undefined
        setError(data?.error ?? data?.errors?.join(' ') ?? 'Could not change your password.')
      } else {
        setError('Could not change your password.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell maxWidth="4xl">
      <PageHeader title="Account" subtitle="Your sign-in details and password." />

      <Card className="p-5">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Name</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Access level</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{HOUSEHOLD_ROLE_LABELS[role] ?? 'Member'}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Change password</h2>
        <form onSubmit={onSubmit} className="max-w-sm space-y-4">
          <div>
            <label htmlFor="current" className="mb-1 block text-sm font-medium text-slate-600">
              Current password
            </label>
            <Input
              id="current"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="next" className="mb-1 block text-sm font-medium text-slate-600">
              New password
            </label>
            <Input
              id="next"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-600">
              Confirm new password
            </label>
            <Input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full"
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}
          {done && (
            <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Your password has been changed.
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </Card>
    </AppShell>
  )
}
