/**
 * Registry for non-browser hosts (CLI, MCP server, Cloudflare Worker API, editor
 * extensions): every utility statically imported, so any bundler can include them
 * without Vite's `import.meta.glob`. Do not import this from the web app.
 */
import { createRegistry } from '../core/registry'
import type { Utility } from '../types/utility'
import { MANIFEST } from './_generated/manifest'
import { STATIC_UTILITIES } from './_generated/static'

const BY_ID: Record<string, Utility> = Object.fromEntries(STATIC_UTILITIES.map(u => [u.id, u]))

export const staticRegistry = createRegistry(MANIFEST, id => {
  const u = BY_ID[id]
  if (!u) throw new Error(`unknown utility: ${id}`)
  return u
})

export { STATIC_UTILITIES }
