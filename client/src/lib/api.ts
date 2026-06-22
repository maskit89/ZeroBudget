import axios from 'axios'
import type { CommitImportItem, ImportPreviewResult, ImportStatementResult } from '../types'

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
    if (error.response?.status === 401) {
      setToken(null)
    }
    return Promise.reject(error)
  },
)

/** Upload a bank statement file to an import endpoint, optionally stamping an account. */
async function postStatement(
  path: string,
  file: File,
  accountId?: string,
): Promise<ImportStatementResult> {
  const form = new FormData()
  form.append('file', file)
  if (accountId) form.append('accountId', accountId)
  const { data } = await api.post<ImportStatementResult>(path, form)
  return data
}

/** Import an HSBC personal-banking transaction-history CSV (one-shot, no review). */
export const importHsbcCsv = (file: File, accountId?: string) =>
  postStatement('/import/hsbc-csv', file, accountId)

/** Import a CAMT.053 SEPA statement (XML) (one-shot, no review). */
export const importCamt053 = (file: File, accountId?: string) =>
  postStatement('/import/camt053', file, accountId)

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
