import { Link } from 'react-router-dom'
import { useFeatures } from '../features/FeatureContext'

export type NavKey = 'budget' | 'paychecks' | 'transactions' | 'accounts' | 'reports' | 'rules'

/**
 * The primary navigation, shared by every page. The active item renders as a
 * highlighted label; the rest are links. Accounts and Reports are hidden when their
 * feature flag is off.
 */
export function AppNav({ active }: { active?: NavKey }) {
  const features = useFeatures()

  const items: { key: NavKey; to: string; label: string; show: boolean }[] = [
    { key: 'budget', to: '/', label: 'Budget', show: true },
    { key: 'paychecks', to: '/paychecks', label: 'Paychecks', show: true },
    { key: 'transactions', to: '/transactions', label: 'Transactions', show: true },
    { key: 'accounts', to: '/accounts', label: 'Accounts', show: features.accounts },
    { key: 'reports', to: '/reports', label: 'Reports', show: features.reports },
    { key: 'rules', to: '/rules', label: 'Rules', show: true },
  ]

  return (
    <nav className="flex gap-1 text-sm">
      {items
        .filter((i) => i.show)
        .map((i) =>
          i.key === active ? (
            <span
              key={i.key}
              className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800"
            >
              {i.label}
            </span>
          ) : (
            <Link
              key={i.key}
              to={i.to}
              className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
            >
              {i.label}
            </Link>
          ),
        )}
    </nav>
  )
}
