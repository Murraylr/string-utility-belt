import { useContext, useMemo } from 'react'
import { usePref } from '@/app/prefs'
import { detectLocale } from './i18n'
import { buildValue, I18nContext, type I18nValue } from './context'

export type { I18nValue }

/**
 * `{ t, locale, plural, formatNumber, formatDate }` for the active locale.
 * Works even without an `<I18nProvider>` ancestor — falling back to the
 * `locale` pref / detected locale directly — so components (and their tests)
 * aren't forced to wrap every render just to call `t()`.
 */
export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  const [localePref] = usePref<unknown>('locale', null)
  const locale = ctx ? ctx.locale : detectLocale(localePref)
  return useMemo(() => ctx ?? buildValue(locale), [ctx, locale])
}
