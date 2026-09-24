import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { writePref } from '@/app/prefs'
import { I18nProvider } from './I18nProvider'
import { useT } from './useT'

function Probe() {
  const { t, locale } = useT()
  return <div data-testid="probe">{locale}:{t('blog.empty')}</div>
}

describe('I18nProvider / useT', () => {
  beforeEach(() => localStorage.clear())

  it('provides the detected locale and translated strings', () => {
    render(<I18nProvider><Probe /></I18nProvider>)
    expect(screen.getByTestId('probe').textContent).toMatch(/^en(-[A-Z]{2})?:No posts yet.$/)
  })

  it('an explicit locale prop overrides detection (e.g. pseudo-locale QA)', () => {
    render(<I18nProvider locale="en-XA"><Probe /></I18nProvider>)
    expect(screen.getByTestId('probe').textContent).toMatch(/^en-XA:\[/)
  })

  it('useT works with no provider ancestor', () => {
    const { result } = renderHook(() => useT())
    expect(result.current.locale).toMatch(/^en(-[A-Z]{2})?$/)
    expect(result.current.t('blog.empty')).toBe('No posts yet.')
  })

  it('exposes plural/formatNumber/formatDate bound to the locale', () => {
    const { result } = renderHook(() => useT())
    expect(result.current.plural(1, { one: '{count} item', other: '{count} items' })).toBe('1 item')
    expect(typeof result.current.formatNumber(1000)).toBe('string')
    expect(typeof result.current.formatDate(new Date())).toBe('string')
  })
})

describe('I18nProvider / useT (review regressions)', () => {
  beforeEach(() => localStorage.clear())

  it('does not crash on a corrupt locale pref', () => {
    localStorage.setItem('sub:pref:locale', '{"a":1}')
    render(<I18nProvider><Probe /></I18nProvider>)
    expect(screen.getByTestId('probe').textContent).toMatch(/:No posts yet\.$/)
  })

  it('re-renders the tree when the locale pref changes', () => {
    render(<I18nProvider><Probe /></I18nProvider>)
    act(() => writePref('locale', 'en-XA'))
    expect(screen.getByTestId('probe').textContent).toMatch(/^en-XA:\[/)
  })

  it('mirrors the active locale onto <html lang>', () => {
    render(<I18nProvider locale="en-XA"><Probe /></I18nProvider>)
    expect(document.documentElement.lang).toBe('en-XA')
  })

  it('formats numbers for the active locale', () => {
    const { result } = renderHook(() => useT(), { wrapper: ({ children }) => <I18nProvider locale="de">{children}</I18nProvider> })
    expect(result.current.formatNumber(1234.5)).toBe('1.234,5')
  })
})
