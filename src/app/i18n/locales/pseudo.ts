import { en } from './en'

const ACCENTS: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
}

/**
 * Accents vowels and brackets a string while leaving `{var}` interpolation
 * tokens untouched. Exported (not just the derived dictionary) so a test can
 * assert the transform itself: interpolation placeholders must survive
 * unscathed or every pseudo-localized string with a variable would break.
 */
export function pseudoizeString(input: string): string {
  const body = input
    .split(/(\{[^}]+\})/g)
    .map(part => (part.startsWith('{') ? part : part.replace(/[aeiouAEIOU]/g, c => ACCENTS[c] ?? c)))
    .join('')
  return `[${body}]`
}

type DeepStringRecord = { [key: string]: string | DeepStringRecord }

function pseudoizeDict<T>(dict: T): T {
  if (typeof dict === 'string') return pseudoizeString(dict) as unknown as T
  if (dict && typeof dict === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(dict as DeepStringRecord)) {
      out[key] = pseudoizeDict((dict as Record<string, unknown>)[key])
    }
    return out as T
  }
  return dict
}

/**
 * `en-XA`-style pseudo-locale, generated from `en` rather than hand-maintained,
 * so it can never drift out of sync with the real dictionary. Use it (set the
 * `locale` pref to `en-XA`) to spot strings that were never routed through
 * `t()` (they'll still read as plain English) and to sanity-check that longer,
 * accented text doesn't overflow fixed-width UI.
 */
export const enXA: typeof en = pseudoizeDict(en)
