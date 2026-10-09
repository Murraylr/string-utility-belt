/**
 * Our own tools, shown in the sponsor slot while no sponsor has booked the page
 * (`HousePromo`). Pure data and choice, so the rules are testable without a browser.
 */
import { INTEGRATION_LINKS, type IntegrationId, type IntegrationLink } from '@/app/integrations/links'
import { topicOf, type SponsorPage } from './sponsors'
import type { SponsorTopicId } from './topics'

export type PromoId = IntegrationId

export interface Promo {
  name: string
  /** The call to action on the larger slots (`ExtraPromo`). */
  cta: string
  /** One line, at most `MAX_SPONSOR_TEXT` characters, like a sponsor's. */
  text: string
  /** Where the header's link for the same tool goes: a store page, or its section of /integrations/. */
  link: IntegrationLink
}

const linkOf = (id: IntegrationId): IntegrationLink => INTEGRATION_LINKS.find(l => l.id === id)!

export const PROMOS: Record<PromoId, Promo> = {
  chrome: {
    name: 'String Utility Belt for Chrome',
    cta: 'Add to Chrome',
    text: 'Right-click text on any page and run these utilities on it. Free, and nothing leaves your device.',
    link: linkOf('chrome'),
  },
  vscode: {
    name: 'String Utility Belt for VS Code',
    cta: 'Install for VS Code',
    text: 'Run these utilities on your selection without leaving the editor. Works in Cursor and VSCodium too.',
    link: linkOf('vscode'),
  },
  cli: {
    name: 'subelt, the command-line tool',
    cta: 'Set it up',
    text: 'Pipe logs, kubectl output and files through these utilities: npx subelt base64_decode json_pretty',
    link: linkOf('cli'),
  },
  mcp: {
    name: 'MCP server for AI agents',
    cta: 'Set it up',
    text: 'Give Claude, Cursor and other agents exact hashing, encoding and decoding instead of a guess.',
    link: linkOf('mcp'),
  },
}

/**
 * The tool each topic's readers reach for, whatever their browser: the command line for
 * Kubernetes and cloud work, an AI agent's tools for hashing (which models get wrong
 * when they do it themselves), the editor for data files.
 */
const TOPIC_PROMOS: Partial<Record<SponsorTopicId, PromoId>> = {
  'kubernetes-cloud': 'cli',
  'security-hashing': 'mcp',
  'data-formats': 'vscode',
}

/**
 * Which tool a page promotes: its topic's (`TOPIC_PROMOS`); on other recipe pages, which
 * offer the browser extension themselves (`RecipeExtension`), the VS Code extension;
 * elsewhere the browser extension where this browser can install it and has not
 * (`chromeInstallable`), else the VS Code extension.
 */
export function choosePromo(page: SponsorPage, chromeInstallable: boolean): PromoId {
  return fixedPromo(page) ?? (chromeInstallable ? 'chrome' : 'vscode')
}

/** The promo a page shows whatever the browser, if its choice does not depend on it (so it can be pre-rendered). */
export function fixedPromo(page: SponsorPage): PromoId | undefined {
  const topic = topicOf(page)
  return (topic && TOPIC_PROMOS[topic]) ?? (page.kind === 'recipe' ? 'vscode' : undefined)
}

/**
 * The extra promo slots a content page carries besides its sponsor slot: a wide banner in
 * the content (`inline`), a card in the side column (`rail`) and a thin strip under the
 * site header (`strip`). They only ever show our own tools, so the one paid slot per page
 * that /advertise/ sells stays the only sponsor on it.
 */
export type ExtraSlot = 'inline' | 'rail' | 'strip'

/** A page that can carry extra promos: a sponsorable page, or an index or reading page with no sponsor slot. */
export type PromoPage = SponsorPage | { kind: 'index' }

/**
 * The tool an index or reading page shows: one that does not depend on the browser, so the
 * pre-render and the app show the same one, and whose link stays on this site (the usage
 * guide's pre-render links only to crawlable paths).
 */
const INDEX_PROMO: PromoId = 'mcp'

/**
 * Which tool each extra slot of `page` shows. A page shows at most one of our own tools:
 * a sponsorable page already has its sponsor slot (a sponsor, or our tool while unbooked),
 * so its extra slots stay empty; an index or reading page, which has no sponsor slot, shows
 * one tool in its content slot: `inline` or `rail`, whichever its layout carries (none
 * carries both). The `strip` under the site header stays empty on every page. A slot left
 * out of the plan renders nothing.
 */
export function promoPlan(page: PromoPage): Partial<Record<ExtraSlot, PromoId>> {
  return page.kind === 'index' ? { inline: INDEX_PROMO, rail: INDEX_PROMO } : {}
}
