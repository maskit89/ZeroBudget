import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useFeatures } from '../features/FeatureContext'
import { AccountsIcon, DashboardIcon, FundsIcon, MembersIcon, ReportsIcon, TransactionsIcon } from './icons'

export type NavKey = 'budget' | 'transactions' | 'accounts' | 'funds' | 'members' | 'reports'

/**
 * The primary navigation, rendered as a vertical list inside the sidebar. The
 * active item is highlighted (brand-tinted, `aria-current="page"`); the rest are
 * plain links. Accounts and Reports are hidden when their feature flag is off.
 * `onNavigate` lets the shell close the mobile drawer when a link is tapped.
 */
export function AppNav({
  active,
  onNavigate,
}: {
  active?: NavKey
  onNavigate?: () => void
}) {
  const features = useFeatures()

  const items: {
    key: NavKey
    to: string
    label: string
    icon: ComponentType<{ className?: string }>
    show: boolean
  }[] = [
    { key: 'budget', to: '/', label: 'Dashboard', icon: DashboardIcon, show: true },
    { key: 'transactions', to: '/transactions', label: 'Transactions', icon: TransactionsIcon, show: true },
    { key: 'accounts', to: '/accounts', label: 'Accounts', icon: AccountsIcon, show: features.accounts },
    { key: 'funds', to: '/funds', label: 'Funds', icon: FundsIcon, show: features.sinkingFunds },
    { key: 'members', to: '/members', label: 'Members', icon: MembersIcon, show: features.householdAllocation },
    { key: 'reports', to: '/reports', label: 'Reports', icon: ReportsIcon, show: features.reports },
  ]

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      {items
        .filter((i) => i.show)
        .map((i) => {
          const isActive = i.key === active
          const Icon = i.icon
          return (
            <Link
              key={i.key}
              to={i.to}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              {i.label}
            </Link>
          )
        })}
    </nav>
  )
}
