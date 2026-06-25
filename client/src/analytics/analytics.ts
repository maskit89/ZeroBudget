// The public analytics API the rest of the app uses. Call these freely from anywhere:
// every function is a safe no-op until tracking has actually started (a measurement ID
// is built in, the feature is enabled, and the user has granted consent). All payloads
// are funnelled through the redaction layer, so nothing here can leak PII.

import { gtag, isStarted, start } from './gtag'
import { redactPath, safeParams } from './redact'
import type { AnalyticsEventName } from './events'

/** Begin tracking (idempotent). The provider calls this once, after consent is granted. */
export function startTracking(): void {
  start()
}

/** Fire a custom event. `params` is filtered to the safe whitelist before sending. */
export function track(name: AnalyticsEventName, params?: Record<string, unknown>): void {
  if (!isStarted()) return
  gtag('event', name, safeParams(params))
}

/**
 * Record a SPA page view for an already-redacted path. We send a synthetic
 * `page_location` built from the origin + redacted path so the real URL (which may carry
 * ids or a `?token=`) never reaches GA.
 */
export function pageView(redactedPath: string): void {
  if (!isStarted()) return
  const origin = typeof location !== 'undefined' ? location.origin : ''
  gtag('event', 'page_view', {
    page_path: redactedPath,
    page_location: `${origin}${redactedPath}`,
  })
}

/** Convenience: redact then record. */
export function trackPageView(pathname: string): void {
  pageView(redactPath(pathname))
}

/** Set GA's User-ID to an already-hashed, non-PII value (or clear it with null). */
export function setUser(hashedId: string | null): void {
  if (!isStarted()) return
  gtag('set', { user_id: hashedId ?? null })
}

/** Clear the User-ID on logout. */
export function clearUser(): void {
  setUser(null)
}
