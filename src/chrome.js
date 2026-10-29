import { t, currentLang, LANGS } from './i18n.js'
import { isMuted, isMusicOn } from './sound.js'
import { iconHtml } from './icons.js'
import { TUTORIAL_STEPS, clampTutorialStep } from './tutorial.js'

export function offlineBannerHtml(lineOn) {
  if (lineOn) return ''
  return `<p class="notice offline-banner" role="status">${t('offline')}</p>`
}

export function chromeToggleHtml() {
  const off = isMuted()
  const musicOff = !isMusicOn()
  return `
    <div class="chrome-toggles">
      <div class="lang-toggle" id="langtoggle">${LANGS.map((l) =>
        `<button class="count-btn${currentLang() === l.id ? ' on' : ''}" data-lang="${l.id}">${l.label}</button>`
      ).join('')}</div>
      <button class="count-btn sound-btn${off ? ' off' : ''}" id="soundtoggle" type="button" aria-pressed="${off ? 'false' : 'true'}">${off ? t('soundOff') : t('soundOn')}</button>
      <button class="count-btn sound-btn${musicOff ? ' off' : ''}" id="musictoggle" type="button" aria-pressed="${musicOff ? 'false' : 'true'}">${musicOff ? t('musicOff') : t('musicOn')}</button>
      <button class="count-btn sound-btn" id="helptoggle" type="button">${t('howToFarm')}</button>
    </div>`
}

export function tutorialHtml(tutorialOn, tutorialStep) {
  if (!tutorialOn) return ''
  const step = TUTORIAL_STEPS[clampTutorialStep(tutorialStep)]
  const i = clampTutorialStep(tutorialStep)
  const last = i === TUTORIAL_STEPS.length - 1
  const dots = TUTORIAL_STEPS.map((_, n) =>
    `<button type="button" class="tut-dot${n === i ? ' on' : ''}" data-tutstep="${n}" aria-label="${t('tutStep', n + 1, TUTORIAL_STEPS.length)}"></button>`
  ).join('')
  return `
    <div class="modal-back tutorial-back" id="tutorial" role="dialog" aria-modal="true" aria-labelledby="tuttitle">
      <div class="modal tutorial">
        <div class="tut-kicker">${t('tutKicker')} · ${t('tutStep', i + 1, TUTORIAL_STEPS.length)}</div>
        <div class="tut-head">
          <div class="tut-icon">${iconHtml(step.icon)}</div>
          <h2 id="tuttitle">${t(step.title)}</h2>
        </div>
        <p>${t(step.body)}</p>
        <div class="tut-dots" role="tablist">${dots}</div>
        <div class="actions">
          <button class="ghost" id="tutskip" type="button">${t('tutSkip')}</button>
          ${i > 0 ? `<button class="ghost" id="tutback" type="button">${t('tutBack')}</button>` : ''}
          <button class="primary" id="tutnext" type="button">${last ? t('tutStart') : t('tutNext')}</button>
        </div>
      </div>
    </div>`
}
