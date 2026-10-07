import { request, type RequestOptions } from './http'

/** Registries a release publishes to that can be asked, without credentials, whether a version exists. */
export type Store = 'npm' | 'mcp-registry' | 'vscode-marketplace' | 'open-vsx'

export const NPM_REGISTRY = 'https://registry.npmjs.org'
export const MCP_REGISTRY = 'https://registry.modelcontextprotocol.io'
export const VSCODE_GALLERY = 'https://marketplace.visualstudio.com/_apis/public/gallery'
export const OPEN_VSX = 'https://open-vsx.org'

/**
 * The name a store knows a package by, from the manifest the target publishes:
 * the npm `name`, the MCP Registry `server.json` name, or the VS Code
 * `publisher.name` (the same id on the Marketplace and Open VSX).
 */
export function storeName(store: Store, manifest: Record<string, unknown>): string {
  const field = (key: string) => {
    const value = manifest[key]
    if (typeof value !== 'string' || !value) throw new Error(`the ${store} manifest has no "${key}"`)
    return value
  }
  if (store === 'vscode-marketplace' || store === 'open-vsx') return `${field('publisher')}.${field('name')}`
  return field('name')
}

/**
 * Every version of `name` on `store` (empty when it was never published). Only a
 * definite answer counts: anything but found / not found throws, so a release
 * never guesses its way into a duplicate publish, a skipped one, or a downgrade.
 */
export async function publishedVersions(store: Store, name: string, opts: RequestOptions = {}): Promise<string[]> {
  switch (store) {
    case 'npm': {
      // the abbreviated packument; a scoped name keeps its @ and encodes the slash: @scope%2fname
      const res = await request(`${NPM_REGISTRY}/${name.replace('/', '%2f')}`, {
        headers: { accept: 'application/vnd.npm.install-v1+json' },
      }, opts)
      const doc = await jsonOrNotFound(res, `npm ${name}`) as { versions?: Record<string, unknown> } | null
      return Object.keys(doc?.versions ?? {})
    }
    case 'mcp-registry': {
      const versions: string[] = []
      let cursor: string | undefined
      for (let page = 0; page < 50; page++) {
        const query = `search=${encodeURIComponent(name)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        const res = await request(`${MCP_REGISTRY}/v0/servers?${query}`, { headers: { accept: 'application/json' } }, opts)
        const doc = await jsonOrNotFound(res, `MCP Registry ${name}`) as {
          servers?: { server?: { name?: string; version?: string } }[]
          metadata?: { nextCursor?: string }
        } | null
        // search matches substrings; keep the exact server
        for (const entry of doc?.servers ?? []) {
          if (entry.server?.name === name && entry.server.version) versions.push(entry.server.version)
        }
        cursor = doc?.metadata?.nextCursor
        if (!cursor) return versions
      }
      throw new Error(`MCP Registry ${name}: too many result pages`)
    }
    case 'open-vsx': {
      const [namespace, extension] = splitExtensionId(name)
      const res = await request(`${OPEN_VSX}/api/${encodeURIComponent(namespace)}/${encodeURIComponent(extension)}`, {
        headers: { accept: 'application/json' },
      }, opts)
      const doc = await jsonOrNotFound(res, `Open VSX ${name}`) as { allVersions?: Record<string, unknown> } | null
      // allVersions also carries aliases such as "latest"
      return Object.keys(doc?.allVersions ?? {}).filter(v => /^\d/.test(v))
    }
    case 'vscode-marketplace':
      return marketplaceVersions(name, opts)
  }
}

/**
 * Whether npm serves `name@version` yet. npm accepts a publish before it serves the version (it
 * scans every new version first, usually for a few minutes), and caches the packument
 * `publishedVersions` reads for five minutes; this version document is neither.
 */
export async function npmServes(name: string, version: string, opts: RequestOptions = {}): Promise<boolean> {
  const res = await request(`${NPM_REGISTRY}/${name.replace('/', '%2f')}/${encodeURIComponent(version)}`, {
    headers: { accept: 'application/json' },
  }, opts)
  return (await jsonOrNotFound(res, `npm ${name}@${version}`)) !== null
}

/** Every version of a Marketplace extension (`publisher.name`); empty when it was never published. */
export async function marketplaceVersions(id: string, opts: RequestOptions = {}): Promise<string[]> {
  splitExtensionId(id)
  const res = await request(`${VSCODE_GALLERY}/extensionquery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json;api-version=7.2-preview.1' },
    // filterType 7 = ExtensionName (publisher.name); flags 0x1 = IncludeVersions
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: id }] }], flags: 0x1 }),
  }, opts)
  if (!res.ok) throw new Error(`VS Code Marketplace query for ${id}: HTTP ${res.status}`)
  const body = await res.json() as { results?: { extensions?: { versions?: { version?: string }[] }[] }[] }
  const extension = body.results?.[0]?.extensions?.[0]
  return (extension?.versions ?? []).map(v => v.version).filter((v): v is string => typeof v === 'string')
}

function splitExtensionId(id: string): [string, string] {
  const dot = id.indexOf('.')
  if (dot <= 0 || dot === id.length - 1) throw new Error(`"${id}" is not a publisher.name extension id`)
  return [id.slice(0, dot), id.slice(dot + 1)]
}

async function jsonOrNotFound(res: Response, what: string): Promise<unknown> {
  if (res.status === 404) {
    await res.body?.cancel()
    return null
  }
  if (res.status !== 200) {
    await res.body?.cancel()
    throw new Error(`could not read the published versions of ${what}: HTTP ${res.status}`)
  }
  return res.json()
}
