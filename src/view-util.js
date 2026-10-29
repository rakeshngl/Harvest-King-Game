import { t } from './i18n.js'
import { inrShort } from './format.js'

export function rs(n) {
  return t('rs') + inrShort(n)
}
