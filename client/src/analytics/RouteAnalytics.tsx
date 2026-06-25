import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from './analytics'

/**
 * Fires a redacted `page_view` on every client-side navigation. The very first location
 * is skipped here — the provider records the initial view when tracking starts — so we
 * never double-count it. `trackPageView` is a no-op until tracking is live.
 */
export function RouteAnalytics() {
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    trackPageView(pathname)
  }, [pathname])

  return null
}
