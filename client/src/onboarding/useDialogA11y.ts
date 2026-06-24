import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal-dialog keyboard behaviour: focus the dialog on open, trap Tab inside it,
 * close on Escape, and restore focus to whatever was focused before. Used by the
 * welcome dialog and the spotlight tour so both meet the keyboard expectations
 * for `role="dialog" aria-modal="true"`.
 */
export function useDialogA11y(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    // Move focus into the dialog on open.
    ;(node.querySelector<HTMLElement>(FOCUSABLE) ?? node).focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [ref, onClose])
}
