/**
 * i18n scaffold — pure lookup/formatting logic. Components call `useT()` (from
 * `./useT`) under an `<I18nProvider>` (from `./I18nProvider`) rather than
 * these functions directly.
 *
 * Adding a key: add it to `en` in `locales/en.ts`, nesting related strings
 * under a shared prefix (e.g. `blog.notFound`). `I18nKey` widens automatically
 * from the dictionary's shape — no other file needs to change. A plural is an
 * object of `Intl.PluralRules` categories (`{ one: '{count} item', other:
 * '{count} items' }`, `other` required) and is used via `plural(count, key)`,
 * so each locale can supply the categories its language needs.
 *
 * Adding a locale: create `locales/<code>.ts` exporting a dictionary with the
 * same shape as `en` (a partial subset is fine — any key it omits falls back
 * to `en`, and a key missing from every locale falls back to itself), then add
 * it to the `LOCALES` map below. The active locale comes from the `locale`
 * pref (`sub:pref:locale`), then `navigator.languages`, then `'en'`; a tag
 * counts when its language (e.g. `en` of `en-GB`) is registered, and keeps its
 * region so `formatNumber`/`formatDate` follow it.
 *
 * `en-XA` (see `locales/pseudo.ts`) is a pseudo-locale derived from `en` for
 * finding strings that bypass `t()` and for catching text-expansion overflow,
 * without needing a real translation.
 */
import { readPref } from '@/app/prefs'
import { en } from './locales/en'
import { enXA } from './locales/pseudo'

export type Vars = Record<string, string | number>

type Keys<T> = Extract<keyof T, string>

// leaves of `en` are string-literal types (it's declared `as const`), so this
// recursion bottoms out on `string` and only widens through nested objects
type DeepKeyOf<T> = T extends string
  ? never
  : { [K in Keys<T>]: T[K] extends string ? K : `${K}.${DeepKeyOf<T[K]>}` }[Keys<T>]

type PluralKeyOf<T> = T extends string
  ? never
  : { [K in Keys<T>]: T[K] extends string ? never : T[K] extends { other: string } ? K : `${K}.${PluralKeyOf<T[K]>}` }[Keys<T>]

/** Every valid dot-path to a string in the `en` dictionary, e.g. `'blog.notFound'`. */
export type I18nKey = DeepKeyOf<typeof en>

/** Every dot-path to a plural-forms object in the `en` dictionary, e.g. `'common.items'`. */
export type PluralKey = PluralKeyOf<typeof en>

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

const LOCALES: Record<string, unknown> = { en, 'en-XA': enXA }

const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

function localeDict(locale: string): unknown {
  if (own(LOCALES, locale)) return LOCALES[locale]
  const base = locale.split('-')[0]
  return own(LOCALES, base) ? LOCALES[base] : undefined
}

function getPath(dict: unknown, key: string): unknown {
  let node = dict
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || !own(node, part)) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

function getString(dict: unknown, key: string): string | undefined {
  const value = getPath(dict, key)
  return typeof value === 'string' ? value : undefined
}

function getForms(dict: unknown, key: string): PluralForms | undefined {
  const value = getPath(dict, key)
  return value && typeof value === 'object' && typeof (value as PluralForms).other === 'string'
    ? (value as PluralForms)
    : undefined
}

function interpolate(str: string, vars?: Vars): string {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (whole, name: string) => (own(vars, name) ? String(vars[name]) : whole))
}

/** Canonical BCP 47 form of `tag` (`'EN-gb'` → `'en-GB'`), or null if it isn't a valid tag. */
export function normalizeLocale(tag: unknown): string | null {
  if (typeof tag !== 'string' || !tag) return null
  try { return Intl.getCanonicalLocales(tag)[0] ?? null } catch { return null }
}

function supportedLocale(tag: unknown): string | null {
  const canonical = normalizeLocale(tag)
  return canonical && localeDict(canonical) ? canonical : null
}

/** Looks up `key` in `locale`, falling back to `en`, then to the key itself. */
export function translate(key: I18nKey, vars: Vars | undefined, locale: string): string {
  const raw = getString(localeDict(locale), key) ?? getString(en, key) ?? key
  return interpolate(raw, vars)
}

/**
 * Picks the plural form for `count` via `Intl.PluralRules` and interpolates it
 * with `{count}` (locale-formatted) plus any extra `vars`. `forms` is either a
 * `PluralKey` into the dictionary (translatable — prefer this) or an inline
 * forms object; a key missing from every locale renders as itself.
 */
export function plural(locale: string, count: number, forms: PluralKey | PluralForms, vars?: Vars): string {
  const set = typeof forms === 'string' ? getForms(localeDict(locale), forms) ?? getForms(en, forms) : forms
  if (!set) return String(forms)
  let category: Intl.LDMLPluralRule = 'other'
  try { category = new Intl.PluralRules(locale).select(count) } catch { /* invalid locale tag: use 'other' */ }
  return interpolate(set[category] ?? set.other, { ...vars, count: formatNumber(locale, count) })
}

export function formatNumber(locale: string, n: number, opts?: Intl.NumberFormatOptions): string {
  try { return new Intl.NumberFormat(locale, opts).format(n) }
  catch { return new Intl.NumberFormat('en', opts).format(n) }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Formats a date. A string is parsed first; a date-only ISO string
 * (`2025-01-15`, as blog frontmatter uses) names a calendar day rather than an
 * instant, so it is formatted in UTC — otherwise every time zone west of UTC
 * would show the previous day. An unparseable or impossible string (`2025-02-30`)
 * is returned unchanged; an invalid `Date`/`NaN` formats as `''`.
 */
export function formatDate(locale: string, d: Date | number | string, opts?: Intl.DateTimeFormatOptions): string {
  let value: Date | number
  let options = opts
  if (typeof d === 'string') {
    const m = DATE_ONLY.exec(d.trim())
    if (m) {
      const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
      value = Date.UTC(y, mo - 1, day)
      // Date.UTC rolls overflow into the next month; a typo must not show a different day
      const check = new Date(value)
      if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== day) return d
      options = { timeZone: 'UTC', ...opts }
    } else {
      value = Date.parse(d)
      if (Number.isNaN(value)) return d
    }
  } else {
    value = d
    if (Number.isNaN(Number(value))) return ''
  }
  try { return new Intl.DateTimeFormat(locale, options).format(value) }
  catch { return new Intl.DateTimeFormat('en', options).format(value) }
}

/**
 * The first registered locale among: `pref` (defaults to the stored `locale`
 * pref), `navigator.languages`, then `'en'`. Invalid or non-string values —
 * e.g. a corrupt pref — are skipped rather than trusted.
 */
export function detectLocale(pref: unknown = readPref<unknown>('locale', null)): string {
  const fromPref = supportedLocale(pref)
  if (fromPref) return fromPref
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const lang of langs) {
      const hit = supportedLocale(lang)
      if (hit) return hit
    }
  }
  return 'en'
}

export { en }
