import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

/**
 * In-house UI primitives built on the existing Tailwind v4 `@theme` tokens —
 * no component library. Keep these small and composable; pages and feature
 * components style themselves by reaching for these plus utility classes.
 */

/** A soft, modern surface: rounded, hairline border, gentle `shadow-card`. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/70 bg-white shadow-card ${className}`}
      {...rest}
    />
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
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
