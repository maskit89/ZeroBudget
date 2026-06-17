import type { ReactNode } from 'react'

/**
 * A tiny in-house inline-SVG icon set — no dependency. Every icon is a 24×24
 * line glyph that inherits colour from `currentColor` and takes a `className`
 * (default `h-5 w-5`), so it themes and sizes with Tailwind utilities. Icons are
 * decorative (`aria-hidden`); their meaning comes from the adjacent label.
 */
function Base({ className = 'h-5 w-5', children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** The ZeroBudget brand mark: a filled rounded badge with a euro glyph. */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fill="#ffffff"
      >
        €
      </text>
    </svg>
  )
}

/** Dashboard / budget — a four-pane grid. */
export function DashboardIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </Base>
  )
}

/** Transactions — up/down transfer arrows. */
export function TransactionsIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M7 20V4" />
      <path d="M4 7l3-3 3 3" />
      <path d="M17 4v16" />
      <path d="M20 17l-3 3-3-3" />
    </Base>
  )
}

/** Accounts — a payment card. */
export function AccountsIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 14.5h3" />
    </Base>
  )
}

/** Funds — a target / bullseye (saving toward a goal). */
export function FundsIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </Base>
  )
}

/** Members — two people. */
export function MembersIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.3a3 3 0 0 1 0 5.4" />
      <path d="M17.5 13.6A5.5 5.5 0 0 1 20.5 19" />
    </Base>
  )
}

/** Reports — a bar chart. */
export function ReportsIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M4 20h16" />
      <path d="M7 20v-6" />
      <path d="M12 20V7" />
      <path d="M17 20v-9" />
    </Base>
  )
}

/** Hamburger menu. */
export function MenuIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Base>
  )
}

/** Close (×). */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Base>
  )
}

/** Help — a question mark in a circle. */
export function HelpIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.5 2.2c-.9.55-1.4 1-1.4 2" />
      <circle cx="12" cy="16.6" r="0.6" fill="currentColor" stroke="none" />
    </Base>
  )
}

/** Sign out — an arrow leaving a container. */
export function LogoutIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
      <path d="M16 8l4 4-4 4" />
      <path d="M20 12H10" />
    </Base>
  )
}

/** Light mode — a sun. */
export function SunIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M19.1 4.9l-1.4 1.4" />
      <path d="M6.3 17.7l-1.4 1.4" />
    </Base>
  )
}

/** Dark mode — a crescent moon. */
export function MoonIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Base>
  )
}
