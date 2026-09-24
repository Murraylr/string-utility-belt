import { describe, it, expect, beforeEach, vi } from 'vitest'
import { translate, plural, formatNumber, formatDate, detectLocale } from './i18n'

describe('translate', () => {
  it('interpolates {vars}', () => {
    expect(translate('theme.toggleAria', { current: 'System', next: 'Light' }, 'en'))
      .toBe('Theme: System. Click for Light.')
  })

  it('falls back to en for a locale that lacks the key', () => {
    expect(translate('blog.title', undefined, 'fr')).toBe('Blog')
  })

  it('falls back to the key itself as a last resort', () => {
    // @ts-expect-error - deliberately not a real key, to exercise the last-resort fallback
    expect(translate('nope.not.a.key', undefined, 'en')).toBe('nope.not.a.key')
  })

  it('renders the en-XA pseudo-locale distinctly while keeping {vars} intact', () => {
    const out = translate('blog.empty', undefined, 'en-XA')
    expect(out).not.toBe('No posts yet.')
    expect(out.startsWith('[')).toBe(true)

    const withVars = translate('theme.toggleAria', { current: 'X', next: 'Y' }, 'en-XA')
    expect(withVars).toContain('X')
    expect(withVars).toContain('Y')
  })
})

describe('plural', () => {
  it('selects the matching Intl.PluralRules category and interpolates {count}', () => {
    const forms = { one: '{count} item', other: '{count} items' }
    expect(plural('en', 1, forms)).toBe('1 item')
    expect(plural('en', 5, forms)).toBe('5 items')
    expect(plural('en', 0, forms)).toBe('0 items')
  })

  it('merges extra vars alongside {count}', () => {
    expect(plural('en', 2, { one: '{count} {name}', other: '{count} {name}s' }, { name: 'file' }))
      .toBe('2 files')
  })
})

describe('formatNumber / formatDate', () => {
  it('delegates to Intl for the given locale', () => {
    expect(formatNumber('en', 1234.5)).toBe(new Intl.NumberFormat('en').format(1234.5))
    const d = new Date(2025, 0, 15)
    expect(formatDate('en', d, { dateStyle: 'medium' }))
      .toBe(new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(d))
  })
})

describe('detectLocale', () => {
  beforeEach(() => localStorage.clear())

  it('prefers the locale pref when it names a registered locale', () => {
    localStorage.setItem('sub:pref:locale', JSON.stringify('en-XA'))
    expect(detectLocale()).toBe('en-XA')
  })

  it('falls back to navigator.languages, then en, when the pref is unregistered', () => {
    localStorage.setItem('sub:pref:locale', JSON.stringify('xx-YY'))
    const langs = vi.spyOn(navigator, 'languages', 'get')
    langs.mockReturnValue(['fr-FR', 'en-GB'])
    expect(detectLocale()).toBe('en-GB')
    langs.mockReturnValue(['fr-FR', 'de'])
    expect(detectLocale()).toBe('en')
    langs.mockRestore()
  })
})

describe('i18n (review regressions)', () => {
  beforeEach(() => localStorage.clear())

  it('does not throw when the stored locale pref is not a string', () => {
    localStorage.setItem('sub:pref:locale', '42')
    expect(() => detectLocale()).not.toThrow()
    expect(detectLocale()).toBe(detectLocale(null))
  })

  it('ignores prototype keys posing as locales', () => {
    expect(detectLocale('__proto__')).not.toBe('__proto__')
    expect(detectLocale('constructor')).not.toBe('constructor')
    expect(translate('blog.title', undefined, 'constructor')).toBe('Blog')
  })

  it('keeps a supported language with its region so Intl formats for that region', () => {
    expect(detectLocale('en-GB')).toBe('en-GB')
    expect(detectLocale('EN-xa')).toBe('en-XA')
    expect(detectLocale('fr-FR')).toBe(detectLocale(null))
  })

  it('does not interpolate inherited Object.prototype names', () => {
    expect(plural('en', 1, { other: '{constructor} {toString}' })).toBe('{constructor} {toString}')
  })

  it('looks plural forms up by dictionary key, so plurals are translatable', () => {
    expect(plural('en', 1, 'common.items')).toBe('1 item')
    expect(plural('en', 1234, 'common.items')).toBe('1,234 items')
    const pseudo = plural('en-XA', 2, 'common.items')
    expect(pseudo.startsWith('[')).toBe(true)
    expect(pseudo).toContain('2')
  })

  it('formats a date-only string as that calendar day in every time zone', () => {
    const tz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(formatDate('en', '2025-01-15', { dateStyle: 'long' })).toBe('January 15, 2025')
    } finally {
      process.env.TZ = tz
    }
  })

  it('returns an unparseable date string unchanged', () => {
    expect(formatDate('en', 'someday')).toBe('someday')
  })

  it('returns an impossible date-only string unchanged instead of rolling it over', () => {
    // Date.UTC silently turns Feb 30 into Mar 2 — a frontmatter typo must not show a wrong day
    expect(formatDate('en', '2025-02-30', { dateStyle: 'long' })).toBe('2025-02-30')
    expect(formatDate('en', '2025-13-01', { dateStyle: 'long' })).toBe('2025-13-01')
    expect(formatDate('en', '2024-02-29', { dateStyle: 'long' })).toBe('February 29, 2024')
  })

  it('does not throw on an invalid Date or NaN', () => {
    expect(() => formatDate('en', new Date('nope'))).not.toThrow()
    expect(() => formatDate('en', Number.NaN)).not.toThrow()
    expect(formatDate('en', Number.NaN)).toBe('')
  })
})
