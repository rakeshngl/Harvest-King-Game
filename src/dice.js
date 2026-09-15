const FACE_ROT = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(-90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(90deg) rotateY(0deg)',
  6: 'rotateX(0deg) rotateY(180deg)'
}

function pips(n) {
  const map = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  }
  return map[n].map((i) => `<span class="pip p${i}"></span>`).join('')
}

export function diceHtml() {
  const faces = [1, 2, 3, 4, 5, 6]
  const cube = (id) => `
    <div class="die" id="${id}">
      <div class="cube">
        ${faces.map((n) => `<div class="face f${n}">${pips(n)}</div>`).join('')}
      </div>
    </div>`
  return `<div class="dice-pair">${cube('dieA')}${cube('dieB')}</div>`
}

export function animateDice(a, b, onDone) {
  const dieA = document.getElementById('dieA')
  const dieB = document.getElementById('dieB')
  if (!dieA || !dieB) {
    onDone && onDone()
    return
  }
  const spin = (el, value, delay) => {
    const cube = el.querySelector('.cube')
    el.classList.add('rolling')
    const rx = 360 * (3 + Math.floor(Math.random() * 3))
    const ry = 360 * (3 + Math.floor(Math.random() * 3))
    const rz = 180 * (1 + Math.floor(Math.random() * 2))
    cube.style.transition = 'none'
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`
    void cube.offsetWidth
    const extraX = 360 * (4 + Math.floor(Math.random() * 2))
    const extraY = 360 * (4 + Math.floor(Math.random() * 2))
    cube.style.transition = `transform ${0.9 + delay}s cubic-bezier(.17,.67,.22,1.12)`
    const base = FACE_ROT[value]
    cube.style.transform = `${base} rotateX(${extraX}deg) rotateY(${extraY}deg)`
    window.setTimeout(() => {
      cube.style.transition = 'transform 0.35s ease-out'
      cube.style.transform = base
      el.classList.remove('rolling')
    }, (0.9 + delay) * 1000)
  }
  spin(dieA, a, 0)
  spin(dieB, b, 0.12)
  window.setTimeout(() => onDone && onDone(), 1400)
}

export function setDiceFace(a, b) {
  const dieA = document.getElementById('dieA')
  const dieB = document.getElementById('dieB')
  if (!dieA || !dieB) return
  dieA.querySelector('.cube').style.transform = FACE_ROT[a]
  dieB.querySelector('.cube').style.transform = FACE_ROT[b]
}
