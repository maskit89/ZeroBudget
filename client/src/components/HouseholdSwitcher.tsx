import { useAuth } from '../auth/AuthContext'

/**
 * Lets a login that belongs to more than one household choose which one it is
 * viewing. Hidden entirely for the common case of a single household. Switching
 * re-bootstraps the app (every screen's data is scoped to the active household).
 */
export function HouseholdSwitcher() {
  const { households, activeOwnerId, switchHousehold } = useAuth()

  if (households.length < 2) {
    return null
  }

  return (
    <select
      aria-label="Active household"
      value={activeOwnerId ?? ''}
      onChange={(e) => {
        const next = e.target.value
        if (next && next !== activeOwnerId) {
          void switchHousehold(next)
        }
      }}
      className="max-w-[10rem] truncate rounded-lg border border-slate-300 bg-surface px-2.5 py-1.5 text-sm font-medium text-slate-700 transition focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 sm:max-w-[14rem]"
    >
      {households.map((h) => (
        <option key={h.ownerId} value={h.ownerId}>
          {h.label}
        </option>
      ))}
    </select>
  )
}
