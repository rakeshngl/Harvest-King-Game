export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function focusables(root) {
  if (!root || !root.querySelectorAll) return []
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute && el.hasAttribute('disabled')) return false
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false
    if (typeof el.tabIndex === 'number' && el.tabIndex < 0) return false
    return true
  })
}

export function trapFocus(root) {
  if (!root || typeof root.addEventListener !== 'function') return () => {}
  const list = () => focusables(root)
  const preferred = root.querySelector && root.querySelector('.primary, #landok, #tutnext, #again')
  const start = preferred || list()[0]
  if (start && typeof start.focus === 'function') start.focus()
  function onKey(e) {
    if (e.key !== 'Tab') return
    const nodes = list()
    if (!nodes.length) return
    const head = nodes[0]
    const tail = nodes[nodes.length - 1]
    const inside = typeof root.contains === 'function' ? root.contains(e.target) : true
    if (e.shiftKey && (e.target === head || !inside)) {
      e.preventDefault()
      tail.focus()
    } else if (!e.shiftKey && (e.target === tail || !inside)) {
      e.preventDefault()
      head.focus()
    }
  }
  root.addEventListener('keydown', onKey)
  return () => root.removeEventListener('keydown', onKey)
}
