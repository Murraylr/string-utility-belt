/**
 * English source strings — the canonical dictionary every other locale (and
 * the `I18nKey` type) is derived from. Nest related strings under a shared
 * prefix (`blog.*`, `theme.*`) rather than inventing flat, ambiguous names.
 * A plural is an object of Intl.PluralRules categories used via `plural()`.
 *
 * See `../i18n.ts` for how a key is looked up and how to register a locale.
 */
export const en = {
  common: {
    loading: 'Loading…',
    items: { one: '{count} item', other: '{count} items' },
  },
  nav: {
    tool: 'Tool',
    docs: 'Docs',
    utilities: 'Utilities',
    blog: 'Blog',
    changelog: 'Changelog',
  },
  blog: {
    title: 'Blog',
    empty: 'No posts yet.',
    notFound: 'Post not found.',
  },
  select: {
    placeholder: '— select —',
  },
  theme: {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    toggleAria: 'Theme: {current}. Click for {next}.',
  },
} as const
