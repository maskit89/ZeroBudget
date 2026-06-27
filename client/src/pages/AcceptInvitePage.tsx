import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { LogoMark } from '../components/icons'
import { Button, Card, Input } from '../components/ui'
import { EVENTS, track } from '../analytics'

function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { title?: string; error?: string; errors?: Record<string, string[]> } | undefined
    const fieldError = data?.errors ? Object.values(data.errors).flat().join(' ') : undefined
    return fieldError ?? data?.error ?? data?.title ?? 'This invite link is invalid or has expired.'
  }
  return 'Something went wrong.'
}

/**
 * Public landing for a one-time invite link (/accept-invite?code=…). A new person sets their own
 * password and is signed in; someone who's already signed in joins the household with their existing
 * login (keeping their own budget) and can switch to it.
 */
export function AcceptInvitePage() {
  const { acceptInvite, isAuthenticated, email } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''

  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await acceptInvite(code, password, displayName || undefined)
      track(EVENTS.inviteAccepted)
      navigate('/', { replace: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function joinExisting() {
    setError(null)
    setBusy(true)
    try {
      // No password — the signed-in user joins with their existing login (backend matches by email).
      await api.post('/auth/accept-invite', { token: code })
      track(EVENTS.inviteAccepted)
      // Full reload so /auth/me picks the new household up in the switcher.
      window.location.assign('/people')
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12 text-brand-600" />
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Join the household</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAuthenticated
              ? 'Join this shared budget with your current account.'
              : 'Set a password to start managing the shared budget.'}
          </p>
        </div>

        <Card className="p-8">
          {code === '' ? (
            <p role="alert" className="text-sm text-rose-600">
              This invite link is missing its code. Ask the household owner to send you a fresh link.
            </p>
          ) : isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                You’re signed in as <span className="font-medium text-slate-800">{email}</span>. Joining adds this
                household to your account — your own budget stays exactly as it is, and you can switch between them.
              </p>
              {error && (
                <p role="alert" className="text-sm text-rose-600">
                  {error}
                </p>
              )}
              <Button type="button" onClick={joinExisting} disabled={busy} className="w-full">
                {busy ? 'Please wait…' : 'Join this household'}
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-slate-600">
                  Your name <span className="text-slate-500">(optional)</span>
                </label>
                <Input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Liza"
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-600">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-rose-600">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Please wait…' : 'Join the household'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
