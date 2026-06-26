import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { AppShell } from '../components/AppShell'
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Select, SegmentedControl } from '../components/ui'
import { AccessIcon, CopyIcon } from '../components/icons'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { EVENTS, track } from '../analytics'
import {
  HouseholdRole,
  HOUSEHOLD_ROLE_HINTS,
  HOUSEHOLD_ROLE_LABELS,
  InviteMethod,
  MembershipStatus,
  type HouseholdMemberDto,
  type InviteResultDto,
  type MembershipDto,
} from '../types'

/** Roles the owner can grant (everything except Owner itself). */
const GRANTABLE_ROLES = [HouseholdRole.Admin, HouseholdRole.Limited, HouseholdRole.ReadOnly]

function inviteLinkFor(token: string): string {
  return `${window.location.origin}/accept-invite?code=${token}`
}

export function HouseholdAccessPage() {
  const { canManageHousehold } = useAuth()

  const [members, setMembers] = useState<MembershipDto[]>([])
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMemberDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add form.
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roleValue, setRoleValue] = useState<number>(HouseholdRole.Admin)
  const [method, setMethod] = useState<'direct' | 'link'>('direct')
  const [tempPassword, setTempPassword] = useState('')
  const [memberId, setMemberId] = useState('')
  const [adding, setAdding] = useState(false)

  // The link from the most recent link-invite, shown once for the owner to copy.
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reload = useCallback(async () => {
    const { data } = await api.get<MembershipDto[]>('/access/members')
    setMembers(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<MembershipDto[]>('/access/members'),
      api.get<HouseholdMemberDto[]>('/members').catch(() => ({ data: [] })),
    ])
      .then(([acc, hm]) => {
        if (cancelled) return
        setMembers(acc.data)
        setHouseholdMembers(Array.isArray(hm?.data) ? hm.data : [])
      })
      .catch(() => !cancelled && setError('Could not load household access.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const invite = useCallback(async () => {
    if (email.trim() === '') {
      setError('Enter an email address.')
      return
    }
    if (method === 'direct' && tempPassword.length < 8) {
      setError('Set a temporary password of at least 8 characters.')
      return
    }
    setAdding(true)
    setError(null)
    setInviteLink(null)
    setCopied(false)
    try {
      const { data } = await api.post<InviteResultDto>('/access/invite', {
        email: email.trim(),
        role: roleValue,
        method: method === 'direct' ? InviteMethod.Direct : InviteMethod.Link,
        tempPassword: method === 'direct' ? tempPassword : null,
        displayName: name.trim() || null,
        memberId: memberId || null,
      })
      if (data.inviteToken) setInviteLink(inviteLinkFor(data.inviteToken))
      track(EVENTS.memberInvited, { method })
      await reload()
      setEmail('')
      setName('')
      setTempPassword('')
      setMemberId('')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { title?: string; errors?: Record<string, string[]> } | undefined
        const fieldError = data?.errors ? Object.values(data.errors).flat().join(' ') : undefined
        setError(fieldError ?? data?.title ?? 'Could not send that invite.')
      } else {
        setError('Could not send that invite.')
      }
    } finally {
      setAdding(false)
    }
  }, [email, name, roleValue, method, tempPassword, memberId, reload])

  const changeRole = useCallback(
    async (id: string, role: number) => {
      setSavingId(id)
      setError(null)
      try {
        await api.put(`/access/members/${id}/role`, { role })
        track(EVENTS.memberRoleChanged, { kind: HOUSEHOLD_ROLE_LABELS[role] ?? 'unknown' })
        await reload()
      } catch {
        setError('Could not change that role.')
      } finally {
        setSavingId(null)
      }
    },
    [reload],
  )

  const revoke = useCallback(
    async (id: string) => {
      setSavingId(id)
      setError(null)
      try {
        await api.delete(`/access/members/${id}`)
        track(EVENTS.memberRevoked)
        await reload()
      } catch {
        setError('Could not remove that member.')
      } finally {
        setSavingId(null)
      }
    },
    [reload],
  )

  async function copyLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!canManageHousehold) {
    return (
      <AppShell active="access">
        <PageHeader title="Members & access" />
        <EmptyState
          icon={<AccessIcon className="h-6 w-6" />}
          title="Owner only"
          description="Only the household owner can manage who has access and at what level."
        />
      </AppShell>
    )
  }

  return (
    <AppShell active="access">
      <PageHeader
        title="Members & access"
        subtitle="Give the people in your household their own sign-in, each with the access level you choose. You stay the owner."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card as="section" className="p-5" aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="mb-4 text-sm font-semibold text-slate-700">
          Add a person
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="liza@example.eu"
              aria-label="Invitee email"
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Name <span className="font-normal text-slate-500">(optional)</span>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Liza"
              aria-label="Invitee name"
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Access level
            <Select
              value={String(roleValue)}
              onChange={(e) => setRoleValue(Number(e.target.value))}
              aria-label="Access level"
              className="w-full"
            >
              {GRANTABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {HOUSEHOLD_ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <span className="text-xs font-normal text-slate-500">{HOUSEHOLD_ROLE_HINTS[roleValue]}</span>
          </label>

          {householdMembers.length > 0 && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Link to budget member <span className="font-normal text-slate-500">(optional)</span>
              <Select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                aria-label="Link to budget member"
                className="w-full"
              >
                <option value="">Not linked</option>
                {householdMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-slate-500">How should they get access?</div>
          <SegmentedControl
            ariaLabel="Invite method"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'direct', label: 'Set a temporary password' },
              { value: 'link', label: 'Generate an invite link' },
            ]}
          />
        </div>

        {method === 'direct' ? (
          <label className="mt-4 flex max-w-xs flex-col gap-1 text-xs font-medium text-slate-500">
            Temporary password
            <Input
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="At least 8 characters"
              aria-label="Temporary password"
              className="w-full"
            />
            <span className="font-normal text-slate-500">Share it with them; they can change it after signing in.</span>
          </label>
        ) : (
          <p className="mt-4 max-w-md text-xs text-slate-500">
            A one-time link will be created for you to copy and send. They set their own password when they open it.
          </p>
        )}

        <div className="mt-5">
          <Button onClick={invite} disabled={adding}>
            {adding ? 'Adding…' : method === 'direct' ? 'Create login' : 'Create invite link'}
          </Button>
        </div>

        {inviteLink && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
            <p className="text-sm font-medium text-brand-800 dark:text-brand-200">Invite link created</p>
            <p className="mt-1 text-xs text-brand-700/80 dark:text-brand-200/80">
              Copy this and send it to them — it works once and expires in 7 days.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input readOnly value={inviteLink} aria-label="Invite link" className="w-full font-mono text-xs" />
              <Button variant="secondary" size="sm" onClick={copyLink} aria-label="Copy invite link">
                <CopyIcon className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && members.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Access level</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const locked = m.isOwner || m.isSelf
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-700">{m.displayName ?? m.email}</div>
                      {m.displayName && <div className="text-xs text-slate-500">{m.email}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      {m.status === MembershipStatus.Invited ? (
                        <Badge tone="amber">Invited</Badge>
                      ) : (
                        <Badge tone="brand">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {locked ? (
                        <span className="text-slate-600">{HOUSEHOLD_ROLE_LABELS[m.role]}</span>
                      ) : (
                        <Select
                          value={String(m.role)}
                          aria-label={`Access level for ${m.displayName ?? m.email}`}
                          disabled={savingId === m.id}
                          onChange={(e) => changeRole(m.id, Number(e.target.value))}
                          className="w-36"
                        >
                          {GRANTABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {HOUSEHOLD_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {m.isOwner ? (
                        <span className="text-xs text-slate-500">Owner</span>
                      ) : m.isSelf ? (
                        <span className="text-xs text-slate-500">You</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => revoke(m.id)}
                          disabled={savingId === m.id}
                          aria-label={`Remove ${m.displayName ?? m.email}`}
                          title="Remove access"
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </AppShell>
  )
}
