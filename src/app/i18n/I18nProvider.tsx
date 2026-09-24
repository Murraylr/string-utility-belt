import React, { useEffect, useMemo } from 'react'
import { usePref } from '@/app/prefs'
import { detectLocale, normalizeLocale } from './i18n'
import { buildValue, I18nContext } from './context'

/**
 * Provides the active locale to `useT()` (from `./useT`) and mirrors it onto
 * `<html lang>` so assistive tech pronounces the UI correctly. `locale`
 * overrides detection (handy for the pseudo-locale in tests/QA); otherwise it
 * follows the `locale` pref reactively, falling back through `detectLocale()`.
 */
export function I18nProvider({ children, locale: localeProp }: { children: React.ReactNode; locale?: string }) {
  const [localePref] = usePref<unknown>('locale', null)
  const locale = normalizeLocale(localeProp) ?? detectLocale(localePref)
  const value = useMemo(() => buildValue(locale), [locale])

  useEffect(() => { document.documentElement.lang = locale }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
