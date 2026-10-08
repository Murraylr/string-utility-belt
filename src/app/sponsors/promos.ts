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
  /** One line, at most `MAX_SPONSOR_TEXT` characters, like a sponsor's. */
  text: string
  /** Where the header's link for the same tool goes: a store page, or its section of /integrations/. */
  link: IntegrationLink
}

const linkOf = (id: IntegrationId): IntegrationLink => INTEGRATION_LINKS.find(l => l.id === id)!

export const PROMOS: Record<PromoId, Promo> = {
  chrome: {
    name: 'String Utility Belt for Chrome',
    text: 'Right-click text on any page to run these utilities on it — free, and it never leaves your device.',
    link: linkOf('chrome'),
  },
  vscode: {
    name: 'String Utility Belt for VS Code',
    text: 'Run these utilities on your selection without leaving the editor — also in Cursor and VSCodium.',
    link: linkOf('vscode'),
  },
  cli: {
    name: 'subelt, the command-line tool',
    text: 'Pipe logs, kubectl output and files through these utilities: npx subelt base64_decode json_pretty',
    link: linkOf('cli'),
  },
  mcp: {
    name: 'MCP server for AI agents',
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
