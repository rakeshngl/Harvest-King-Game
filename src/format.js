const LAKH = 1e5
const CRORE = 1e7

function trim(n) {
  return String(Number(n.toFixed(2)))
}

export function inr(n) {
  const v = Math.round(Number(n) || 0)
  return v.toLocaleString('en-IN')
}

export function inrShort(n) {
  const v = Math.round(Number(n) || 0)
  const abs = Math.abs(v)
  if (abs >= CRORE) return `${trim(v / CRORE)} crore`
  if (abs >= LAKH) return `${trim(v / LAKH)} lakh`
  return v.toLocaleString('en-IN')
}

export function fmtCount(n) {
  return Number(n || 0).toLocaleString('en-IN')
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
