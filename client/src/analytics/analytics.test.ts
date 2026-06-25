import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetForTests, isConfigured, isStarted, start } from './gtag'
import { track } from './analytics'
import { EVENTS } from './events'
import { apiEndpointTemplate, bucketCount, redactPath, safeParams } from './redact'
import { hashUserId } from './hash'
import { getConsent, setConsent } from './consent'

afterEach(() => {
  __resetForTests()
  vi.unstubAllEnvs()
})

const GA_SCRIPT = 'script[src*="googletagmanager"]'

describe('gtag bridge — consent gating', () => {
  it('is completely inert without a measurement id', () => {
    expect(isConfigured()).toBe(false)
    start()
    expect(isStarted()).toBe(false)
    expect(window.gtag).toBeUndefined()
    expect(document.querySelector(GA_SCRIPT)).toBeNull()
  })

  it('never loads GA or fires events before start(), even when configured', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')
    expect(isConfigured()).toBe(true)
    track(EVENTS.login) // no consent/start yet
    expect(window.gtag).toBeUndefined()
    expect(document.querySelector(GA_SCRIPT)).toBeNull()
  })

  it('loads GA and forwards (whitelisted) events only after start()', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')
    start()

    expect(isStarted()).toBe(true)
    expect(document.querySelector(GA_SCRIPT)).not.toBeNull()

    // Consent Mode default must be denied before config.
    const consentDefault = Array.from(window.dataLayer!).find(
      (e) => (e as IArguments)[0] === 'consent' && (e as IArguments)[1] === 'default',
    ) as IArguments | undefined
    expect(consentDefault?.[2]).toMatchObject({ analytics_storage: 'denied' })

    const before = window.dataLayer!.length
    track(EVENTS.login, { method: 'password', email: 'leak@me.com', amount: 999 })
    expect(window.dataLayer!.length).toBe(before + 1)

    const last = window.dataLayer!.at(-1) as IArguments
    expect(last[0]).toBe('event')
    expect(last[1]).toBe('login')
    // PII / non-whitelisted keys are stripped — only `method` survives.
    expect(last[2]).toEqual({ method: 'password' })
  })

  it('start() is idempotent (one script tag)', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')
    start()
    start()
    expect(document.querySelectorAll(GA_SCRIPT).length).toBe(1)
  })
})

describe('redactPath', () => {
  it('keeps structural routes', () => {
    expect(redactPath('/')).toBe('/')
    expect(redactPath('/transactions')).toBe('/transactions')
    expect(redactPath('/accept-invite')).toBe('/accept-invite')
  })

  it('replaces id-like segments with :id', () => {
    expect(redactPath('/account/123')).toBe('/account/:id')
    expect(redactPath('/account/3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('/account/:id')
  })

  it('strips query strings and hashes (no token leakage)', () => {
    expect(redactPath('/accept-invite?token=SUPERSECRETVALUE')).toBe('/accept-invite')
    expect(redactPath('/help#downloads')).toBe('/help')
  })
})

describe('apiEndpointTemplate', () => {
  it('collapses resource ids to a shape', () => {
    expect(apiEndpointTemplate('/budget/2026/6')).toBe('/budget/:id/:id')
    expect(apiEndpointTemplate('/transactions/3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('/transactions/:id')
  })
  it('handles a missing url', () => {
    expect(apiEndpointTemplate(undefined)).toBe('unknown')
  })
})

describe('safeParams', () => {
  it('keeps only whitelisted, primitive-valued keys', () => {
    expect(
      safeParams({
        method: 'password',
        api_status: 404,
        count_bucket: '2-10',
        email: 'a@b.com', // not whitelisted
        amount: 1234, // not whitelisted
        step: {}, // whitelisted key but non-primitive value
      }),
    ).toEqual({ method: 'password', api_status: 404, count_bucket: '2-10' })
  })
  it('returns an empty object for no params', () => {
    expect(safeParams()).toEqual({})
  })
})

describe('bucketCount', () => {
  it('buckets into coarse ranges', () => {
    expect(bucketCount(0)).toBe('0')
    expect(bucketCount(1)).toBe('1')
    expect(bucketCount(5)).toBe('2-10')
    expect(bucketCount(40)).toBe('11-50')
    expect(bucketCount(150)).toBe('51-200')
    expect(bucketCount(999)).toBe('200+')
  })
})

describe('hashUserId', () => {
  it('is deterministic, case/space-insensitive and reveals no raw email', async () => {
    const a = await hashUserId('User@Example.com ')
    const b = await hashUserId('user@example.com')
    expect(a).toBe(b)
    expect(a).not.toContain('example')
    expect(a).toMatch(/^[0-9a-f]+$/)
  })
  it('differs for different users', async () => {
    expect(await hashUserId('a@x.com')).not.toBe(await hashUserId('b@x.com'))
  })
  it('returns null for an empty identity', async () => {
    expect(await hashUserId('')).toBeNull()
    expect(await hashUserId(null)).toBeNull()
  })
})

describe('consent storage', () => {
  it('persists and reads the choice', () => {
    expect(getConsent()).toBeNull()
    setConsent('granted')
    expect(getConsent()).toBe('granted')
    setConsent('denied')
    expect(getConsent()).toBe('denied')
    setConsent(null)
    expect(getConsent()).toBeNull()
  })
})
