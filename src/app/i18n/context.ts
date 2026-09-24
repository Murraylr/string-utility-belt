import { createContext } from 'react'
import {
  formatDate, formatNumber, plural, translate,
  type I18nKey, type PluralForms, type PluralKey, type Vars,
} from './i18n'

export type I18nValue = {
  locale: string
  t: (key: I18nKey, vars?: Vars) => string
  plural: (count: number, forms: PluralKey | PluralForms, vars?: Vars) => string
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string
  formatDate: (d: Date | number | string, opts?: Intl.DateTimeFormatOptions) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

/** Binds the pure i18n helpers to one locale. */
export function buildValue(locale: string): I18nValue {
  return {
    locale,
    t: (key, vars) => translate(key, vars, locale),
    plural: (count, forms, vars) => plural(locale, count, forms, vars),
    formatNumber: (n, opts) => formatNumber(locale, n, opts),
    formatDate: (d, opts) => formatDate(locale, d, opts),
  }
}
