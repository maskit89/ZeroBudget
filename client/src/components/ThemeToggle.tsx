import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from './icons'

const KEY = 'zbb.theme'
type Mode = 'light' | 'dark'

/** jsdom has no matchMedia, so every access is guarded. */
function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function currentMode(): Mode {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return systemPrefersDark() ? 'dark' : 'light'
}

function apply(mode: Mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

/**
 * A header button that toggles light/dark and persists the explicit choice.
 * Until the user picks, the app follows the OS `prefers-color-scheme` (and keeps
 * following live system changes). The initial class is set by a script in
 * index.html so there's no flash before React mounts.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => currentMode())

  useEffect(() => apply(mode), [mode])

  // Track system changes only while the user hasn't chosen explicitly.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => {
      if (!localStorage.getItem(KEY)) setMode(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      onClick={() => {
        const next: Mode = isDark ? 'light' : 'dark'
        localStorage.setItem(KEY, next)
        setMode(next)
      }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  )
}
