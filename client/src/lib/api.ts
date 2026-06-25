import axios from 'axios'
import type { CommitImportItem, ImportPreviewResult, ImportStatementResult } from '../types'
// Import the leaf modules directly (not the analytics barrel) to avoid an import cycle:
// the barrel pulls in the provider, which depends back on this api module.
import { track } from '../analytics/analytics'
import { EVENTS } from '../analytics/events'
import { apiEndpointTemplate } from '../analytics/redact'

/** Wire value of StatementFormat on the server. */
export type StatementFormat = 'HsbcCsv' | 'Camt053'

const TOKEN_KEY = 'zbb.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// All requests go to the same-origin "/api" prefix, which Vite proxies to the
// .NET API in dev. In production the SPA is served behind the same host.
export const api = axios.create({ baseURL: '/api' })

// Attach the bearer token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On a 401 the token is stale/invalid — drop it so the app redirects to login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status: number | undefined = error.response?.status
    if (status === 401) {
      setToken(null)
    }
    // One central hook for every failed request: report the endpoint shape + status only
    // (no bodies, params or ids). No-ops unless analytics is live.
    track(EVENTS.apiError, {
      api_endpoint: apiEndpointTemplate(error.config?.url),
      api_status: typeof status === 'number' ? status : 0,
    })
    return Promise.reject(error)
  },
)

/** Parse a statement and get the not-yet-imported rows to review — nothing is saved yet. */
export async function previewImport(file: File, format: StatementFormat): Promise<ImportPreviewResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('format', format)
  const { data } = await api.post<ImportPreviewResult>('/import/preview', form)
  return data
}

/** Persist the reviewed rows. Idempotent — already-imported rows are skipped server-side. */
export async function commitImport(
  accountId: string | null,
  items: CommitImportItem[],
): Promise<ImportStatementResult> {
  const { data } = await api.post<ImportStatementResult>('/import/commit', { accountId, items })
  return data
}
