/**
 * Our own extensions, shown in the sponsor slot while no sponsor has booked the page
 * (`HousePromo`). Pure data and choice, so the rules are testable without a browser.
 */
import { CHROME_WEB_STORE_URL, VSCODE_MARKETPLACE_URL } from '@/app/integrations/links'
import { topicOf, type SponsorPage } from './sponsors'

export type PromoId = 'chrome' | 'vscode'

export interface Promo {
  name: string
  /** One line, at most `MAX_SPONSOR_TEXT` characters, like a sponsor's. */
  text: string
  href: string
}

export const PROMOS: Record<PromoId, Promo> = {
  chrome: {
    name: 'String Utility Belt for Chrome',
    text: 'Right-click text on any page to run these utilities on it — free, and it never leaves your device.',
    href: CHROME_WEB_STORE_URL,
  },
  vscode: {
    name: 'String Utility Belt for VS Code',
    text: 'Run these utilities on your selection without leaving the editor — also in Cursor and VSCodium.',
    href: VSCODE_MARKETPLACE_URL,
  },
}

/**
 * Which extension a page promotes. The browser extension only where this browser can
 * install it and has not (`chromeInstallable`); never on recipe pages, which offer it
 * themselves (`RecipeExtension`); and not on data-format pages, whose readers work
 * with those files in an editor. Everywhere else the VS Code extension.
 */
export function choosePromo(page: SponsorPage, chromeInstallable: boolean): PromoId {
  return fixedPromo(page) ?? (chromeInstallable ? 'chrome' : 'vscode')
}

/** The promo a page shows whatever the browser, if its choice does not depend on it (so it can be pre-rendered). */
export function fixedPromo(page: SponsorPage): PromoId | undefined {
  return page.kind === 'recipe' || topicOf(page) === 'data-formats' ? 'vscode' : undefined
}
