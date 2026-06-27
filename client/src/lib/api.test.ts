import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { api, getToken, setToken } from './api'

// Drive the real axios instance (and its interceptors) through a scripted adapter so we can prove
// the 401 -> refresh -> retry behaviour without a network. A custom adapter bypasses axios's own
// status check, so a 401 is modelled as a rejection (as axios's `settle` would produce).
function ok(data: unknown, config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
}
function fail401(config: InternalAxiosRequestConfig): Promise<never> {
  return Promise.reject({ response: { status: 401, data: {} }, config })
}

const originalAdapter = api.defaults.adapter

describe('api 401 → refresh → retry interceptor', () => {
  beforeEach(() => setToken(null))
  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  it('refreshes the access token and retries the original request once', async () => {
    let dataCalls = 0
    api.defaults.adapter = (config) => {
      const url = config.url ?? ''
      if (url.includes('/auth/refresh')) return ok({ token: 'fresh' }, config)
      dataCalls += 1
      // First hit 401s (expired access token); the retry after refresh succeeds.
      return dataCalls === 1 ? fail401(config) : ok({ value: 42 }, config)
    }

    const res = await api.get('/budget/current')

    expect(res.data).toEqual({ value: 42 })
    expect(getToken()).toBe('fresh') // the refreshed token was stored
    expect(dataCalls).toBe(2) // original + one retry
  })

  it('gives up (no retry) when the refresh itself fails', async () => {
    api.defaults.adapter = (config) => fail401(config)

    await expect(api.get('/budget/current')).rejects.toMatchObject({ response: { status: 401 } })
    expect(getToken()).toBeNull()
  })

  it('does not try to refresh auth endpoints (no recursion)', async () => {
    let refreshCalls = 0
    api.defaults.adapter = (config) => {
      if ((config.url ?? '').includes('/auth/refresh')) refreshCalls += 1
      return fail401(config)
    }

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshCalls).toBe(0)
  })
})
