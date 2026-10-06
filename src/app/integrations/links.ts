/**
 * The integrations the site header promotes, shared by the app (`IntegrationsNav`)
 * and the pre-rendered header (`scripts/seo/content.ts`). The VS Code extension
 * installs in one click from its store page; the MCP server and the CLI need setup
 * a store page doesn't give (client config, `npx`), so they open their section of
 * `/integrations/` — anchors `parseSitePage` derives from the `##` headings there.
 */
export type IntegrationId = 'vscode' | 'mcp' | 'cli'

export interface IntegrationLink {
  id: IntegrationId
  href: string
  /** Opens outside the site (a store page), in a new tab. */
  external: boolean
}

export const VSCODE_MARKETPLACE_URL =
  'https://marketplace.visualstudio.com/items?itemName=stringutilitybelt.string-utility-belt'

export const INTEGRATION_LINKS: readonly IntegrationLink[] = [
  { id: 'vscode', href: VSCODE_MARKETPLACE_URL, external: true },
  { id: 'mcp', href: '/integrations/#mcp-server-for-ai-agents', external: false },
  { id: 'cli', href: '/integrations/#command-line-tool', external: false },
]

/** Preference set once the visitor has followed an integration link or opened `/integrations/`. */
export const INTEGRATIONS_SEEN_PREF = 'integrationsSeen'
