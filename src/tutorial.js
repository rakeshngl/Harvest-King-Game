export const TUTORIAL_KEY = 'hk-tutorial'

export const TUTORIAL_STEPS = [
  { id: 'goal', icon: 'chakra', title: 'tut1t', body: 'tut1' },
  { id: 'land', icon: 'wheat', title: 'tut2t', body: 'tut2' },
  { id: 'sow', icon: 'seed', title: 'tut3t', body: 'tut3' },
  { id: 'harvest', icon: 'rice', title: 'tut4t', body: 'tut4' },
  { id: 'labour', icon: 'canal', title: 'tut5t', body: 'tut5' },
  { id: 'win', icon: 'bank', title: 'tut6t', body: 'tut6' }
]

export function loadTutorialSeen() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1'
  } catch {
    return false
  }
}

export function saveTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1')
  } catch {
    /* quota */
  }
}

export function clampTutorialStep(n) {
  const last = TUTORIAL_STEPS.length - 1
  if (!Number.isFinite(n) || n < 0) return 0
  return n > last ? last : n
}
