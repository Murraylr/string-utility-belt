import { describe, expect, it } from 'vitest'
import { buildMenuItems, utilityIdFromMenuItem } from './menu'

const NAMES: Record<string, string> = {
  base64_decode: 'base64 decode',
  trim: 'trim',
}
const metaOf = (id: string) => (NAMES[id] ? { id, name: NAMES[id] } : undefined)

describe('buildMenuItems', () => {
  it('builds root, one item per known id (skipping unknown ones), a separator, then open-in-app', () => {
    const items = buildMenuItems(['base64_decode', 'not_a_real_id', 'trim'], metaOf)
    expect(items.map(i => i.id)).toEqual([
      'subelt-root',
      'subelt-apply:base64_decode',
      'subelt-apply:trim',
      'subelt-separator',
      'subelt-open-in-app',
    ])
  })

  it('titles apply items "Apply: <name>" and parents everything under the root', () => {
    const items = buildMenuItems(['base64_decode'], metaOf)
    const apply = items.find(i => i.id === 'subelt-apply:base64_decode')!
    expect(apply).toMatchObject({ parentId: 'subelt-root', title: 'Apply: base64 decode' })
    expect(items.find(i => i.id === 'subelt-separator')).toMatchObject({ parentId: 'subelt-root', type: 'separator' })
    expect(items.find(i => i.id === 'subelt-open-in-app')).toMatchObject({
      parentId: 'subelt-root', title: 'Open selection in String Utility Belt',
    })
  })

  it('every item declares the selection and editable contexts', () => {
    const items = buildMenuItems(['trim'], metaOf)
    for (const item of items) expect(item.contexts).toEqual(['selection', 'editable'])
  })

  it('produces just the root, separator and open item for an empty list', () => {
    expect(buildMenuItems([], metaOf).map(i => i.id)).toEqual(['subelt-root', 'subelt-separator', 'subelt-open-in-app'])
  })
})

describe('utilityIdFromMenuItem', () => {
  it('extracts the id from an apply-prefixed menu item', () => {
    expect(utilityIdFromMenuItem('subelt-apply:trim')).toBe('trim')
  })
  it('returns null for the root, separator, and open items', () => {
    expect(utilityIdFromMenuItem('subelt-root')).toBeNull()
    expect(utilityIdFromMenuItem('subelt-open-in-app')).toBeNull()
  })
  it('returns null for a numeric menu item id', () => {
    expect(utilityIdFromMenuItem(42)).toBeNull()
  })
})
