import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppNav, type NavKey } from './AppNav'

/**
 * The shared page chrome: a sticky header (wordmark + primary nav + an optional
 * right-hand slot + sign-out) and a centred main column. Every authenticated page
 * renders its content inside one, so the layout, width and header are consistent.
 */
export function AppShell({
  active,
  right,
  maxWidth = '5xl',
  children,
}: {
  active?: NavKey
  right?: ReactNode
  maxWidth?: '4xl' | '5xl'
  children: ReactNode
}) {
  const { logout } = useAuth()
  const width = maxWidth === '4xl' ? 'max-w-4xl' : 'max-w-5xl'

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex ${width} items-center justify-between gap-4 px-6 py-3`}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>💶</span>
              <span className="text-lg font-extrabold tracking-tight text-slate-800">ZeroBudget</span>
            </div>
            <AppNav active={active} />
          </div>
          <div className="flex items-center gap-3">
            {right}
            <Link
              to="/help"
              aria-label="Help & guide"
              title="Help & guide"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              ?
            </Link>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto ${width} space-y-6 px-6 py-8`}>{children}</main>
    </div>
  )
}
