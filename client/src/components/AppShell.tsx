import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppNav, type NavKey } from './AppNav'
import { HouseholdSwitcher } from './HouseholdSwitcher'
import { CloseIcon, HelpIcon, LogoMark, LogoutIcon, MenuIcon, SettingsIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'
import { EVENTS, track } from '../analytics'

/**
 * The shared dashboard chrome: a fixed left sidebar for primary navigation and a
 * top header for the user/profile/settings. The sidebar is always visible on
 * large screens and collapses behind a hamburger (an off-canvas drawer) on
 * smaller ones. Every authenticated page renders its content inside one, so the
 * layout, width and chrome stay consistent.
 */
export function AppShell({
  active,
  maxWidth = '5xl',
  children,
}: {
  active?: NavKey
  maxWidth?: '4xl' | '5xl'
  children: ReactNode
}) {
  const { email, logout, canWrite, canEnterData, isReadOnly } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  // Only Limited/Read-only roles are restricted; Owner/Admin have full write access.
  const accessBanner = isReadOnly
    ? 'You have read-only access — you can view everything but cannot make changes.'
    : !canWrite && canEnterData
      ? 'You have limited access — you can record transactions, mark bills paid and run allocation, but not change the budget structure or settings.'
      : null
  const width = maxWidth === '4xl' ? 'max-w-4xl' : 'max-w-5xl'
  const initial = email?.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="min-h-full bg-slate-50">
      {/* Bypass Blocks (2.4.1): a keyboard skip link to the main content. */}
      <a
        href="#main-content"
        className="sr-only rounded-lg font-semibold text-brand-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:border focus:border-brand-500 focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-card"
      >
        Skip to main content
      </a>

      {/* Mobile backdrop — tap to dismiss the drawer. */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Sidebar: a fixed drawer that slides in on mobile, pinned on desktop. */}
      <aside
        data-tour="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-surface transition-transform duration-200 ease-out lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <LogoMark className="h-8 w-8 text-brand-600" />
          <span className="text-lg font-extrabold tracking-tight text-slate-800">ZeroBudget</span>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="ml-auto rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <AppNav active={active} onNavigate={() => setNavOpen(false)} />
      </aside>

      {/* Content column, offset past the sidebar on desktop. */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-surface/80 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <HouseholdSwitcher />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/help"
              data-tour="help"
              aria-label="Help & guide"
              title="Help & guide"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <HelpIcon className="h-5 w-5" />
            </Link>
            <Link
              to="/account"
              aria-label="Account settings"
              title="Account settings"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>

            <div className="hidden h-6 w-px bg-slate-200 sm:block" />

            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                aria-hidden
              >
                {initial}
              </span>
              {email && (
                <span className="hidden max-w-[12rem] truncate text-sm text-slate-500 sm:block">
                  {email}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                track(EVENTS.logout)
                logout()
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:px-3"
            >
              <LogoutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className={`mx-auto ${width} space-y-6 px-4 py-8 focus:outline-none sm:px-6 lg:px-8`}
        >
          {accessBanner && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {accessBanner}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
