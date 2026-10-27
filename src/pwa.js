export const CACHE_VERSION = 'hk-shell-3'

function isProd() {
  try {
    return !!(import.meta.env && import.meta.env.PROD)
  } catch {
    return false
  }
}

export function registerPwa() {
  if (!isProd()) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const start = () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
