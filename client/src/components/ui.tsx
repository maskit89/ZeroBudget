import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ElementType,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react'

/**
 * In-house UI primitives built on the existing Tailwind v4 `@theme` tokens —
 * no component library. Keep these small and composable; pages and feature
 * components style themselves by reaching for these plus utility classes.
 */

/**
 * A soft, modern surface: rounded, hairline border, gentle `shadow-card`.
 * Polymorphic via `as` so it can render a semantic element (e.g. `section`)
 * while keeping the same look.
 */
export function Card<T extends ElementType = 'div'>({
  as,
  className = '',
  ...rest
}: { as?: T; className?: string } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component
      className={`rounded-2xl border border-slate-200/70 bg-surface shadow-card ${className}`}
      {...rest}
    />
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-slate-300 bg-surface text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}

/**
 * A button with a handful of variants/sizes. Forwards every native button prop
 * (incl. `aria-label`, `type`, `onClick`, `disabled`), so it's a drop-in for the
 * app's existing hand-rolled buttons without changing their accessible names.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  )
}

/**
 * A bordered form input — the counterpart to the borderless inline editors used
 * in the budget grid. No width baked in, so callers add `w-full` (forms) or a
 * fixed width (inline form fields). Forwards every native input prop.
 */
export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 ${className}`}
      {...rest}
    />
  )
}

/** A bordered select that matches `Input`. Forwards every native select prop. */
export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-700 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}

type BadgeTone = 'neutral' | 'brand' | 'violet' | 'rose' | 'amber'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-100 text-brand-700',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
}

/** A small rounded pill for counts, tags and statuses. */
export function Badge({
  tone = 'neutral',
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}
      {...rest}
    />
  )
}
