// Low-level Google Analytics (gtag.js) bridge.
//
// This is the ONLY module that touches `window.gtag` / the GA network script. It is
// deliberately framework-free and defensive:
//   * It no-ops entirely unless a build-time measurement ID is present
//     (`VITE_GA_MEASUREMENT_ID`), so dev, tests and CI never load GA or send a hit.
//   * The remote script is injected lazily, and ONLY by `start()` — which the app calls
//     just once, after the user has granted consent. Before that, nothing is loaded and
//     no cookies are set.
//   * Google Consent Mode v2 is initialised denied-by-default; we flip analytics storage
//     to "granted" only on opt-in.

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** The GA4 measurement ID (`G-XXXXXXXXXX`), inlined by Vite at build time. Undefined ⇒ disabled. */
export function measurementId(): string | undefined {
  return import.meta.env.VITE_GA_MEASUREMENT_ID
}

/** True when a measurement ID was built in. Without it the whole module is inert. */
export function isConfigured(): boolean {
  const id = measurementId()
  return typeof id === 'string' && id.length > 0
}

let scriptInjected = false
let started = false

/** Ensure the `dataLayer` + `gtag` shim exist (the canonical Google snippet). */
function ensureGtag(): void {
  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js consumes the raw `arguments` object, so forward it verbatim.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
  }
}

/** Push a command into the dataLayer (no-op until the shim is in place). */
export function gtag(...args: unknown[]): void {
  if (!window.gtag) return
  window.gtag(...args)
}

/** Inject the remote gtag.js script exactly once. */
function injectScript(): void {
  if (scriptInjected || !isConfigured()) return
  scriptInjected = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId()}`
  document.head.appendChild(s)
}

/**
 * Begin tracking. Idempotent. Loads gtag.js, sets Consent Mode defaults (denied), then
 * flips analytics storage to granted and configures the stream with privacy-safe options:
 * no automatic page_view (we send our own redacted ones), IP anonymised, Google Signals
 * and ad-personalisation off. Call ONLY after consent has been granted.
 */
export function start(): void {
  if (started || !isConfigured()) return
  started = true

  ensureGtag()
  // Consent Mode v2: deny everything first, then grant only analytics storage.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })

  injectScript()
  gtag('js', new Date())
  gtag('config', measurementId(), {
    send_page_view: false,
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  gtag('consent', 'update', { analytics_storage: 'granted' })
}

/** Whether tracking has been started (i.e. consent granted and GA configured). */
export function isStarted(): boolean {
  return started
}

/** Test-only: reset module state so each test starts from a clean slate. */
export function __resetForTests(): void {
  started = false
  scriptInjected = false
  delete window.gtag
  delete window.dataLayer
  document.querySelectorAll('script[src*="googletagmanager"]').forEach((s) => s.remove())
}
