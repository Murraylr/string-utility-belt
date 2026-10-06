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
 * Whether `name@version` is already on `store`. Only a definite answer counts:
 * anything but found / not found throws, so a release never guesses its way
 * into a duplicate publish or a skipped one.
 */
export async function isPublished(store: Store, name: string, version: string, opts: RequestOptions = {}): Promise<boolean> {
  switch (store) {
    case 'npm': {
      // a scoped name keeps its @ and encodes the slash: @scope%2fname
      const res = await request(`${NPM_REGISTRY}/${name.replace('/', '%2f')}/${encodeURIComponent(version)}`, {
        headers: { accept: 'application/json' },
      }, opts)
      return foundOrNot(res, `npm ${name}@${version}`)
    }
    case 'mcp-registry': {
      const res = await request(
        `${MCP_REGISTRY}/v0/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`,
        { headers: { accept: 'application/json' } }, opts,
      )
      return foundOrNot(res, `MCP Registry ${name}@${version}`)
    }
    case 'open-vsx': {
      const [namespace, extension] = splitExtensionId(name)
      const res = await request(
        `${OPEN_VSX}/api/${encodeURIComponent(namespace)}/${encodeURIComponent(extension)}/${encodeURIComponent(version)}`,
        { headers: { accept: 'application/json' } }, opts,
      )
      return foundOrNot(res, `Open VSX ${name}@${version}`)
    }
    case 'vscode-marketplace':
      return (await marketplaceVersions(name, opts)).includes(version)
  }
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

async function foundOrNot(res: Response, what: string): Promise<boolean> {
  await res.body?.cancel()
  if (res.status === 200) return true
  if (res.status === 404) return false
  throw new Error(`could not tell whether ${what} is published: HTTP ${res.status}`)
}
