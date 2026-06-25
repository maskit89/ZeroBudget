// The lightweight tracking API — what pages/components import to emit events. Kept free
// of any React/router/provider dependency so importing it stays cheap (and doesn't pull
// the provider graph into every page). The provider + `useAnalytics` hook live in
// ./AnalyticsProvider and are imported directly by their two consumers (main.tsx, Help).
export { track, trackPageView, setUser, clearUser } from './analytics'
export { EVENTS } from './events'
export { bucketCount } from './redact'
