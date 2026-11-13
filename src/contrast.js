const CONTRAST_KEY = 'hk-contrast'

let contrastOn = false

try {
  contrastOn = localStorage.getItem(CONTRAST_KEY) === '1'
} catch {
  /* ignore */
}

function applyClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('contrast', contrastOn)
}

applyClass()

export function isContrastOn() {
  return contrastOn
}

export function setContrastOn(value) {
  contrastOn = !!value
  try { localStorage.setItem(CONTRAST_KEY, contrastOn ? '1' : '0') } catch { /* ignore */ }
  applyClass()
  return contrastOn
}

export function toggleContrast() {
  return setContrastOn(!contrastOn)
}
