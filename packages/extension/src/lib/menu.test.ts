import { describe, expect, it } from 'vitest'
import { buildMenuItems, menuTitle, pipelineIdFromMenuItem, utilityIdFromMenuItem } from './menu'

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

describe('saved pipelines on the menu', () => {
  const pipelines = [{ id: 'p1', name: 'Decode token' }, { id: 'p2', name: '100%safe' }]

  it('lists them after the favourites, behind a separator', () => {
    expect(buildMenuItems(['trim'], metaOf, pipelines).map(i => i.id)).toEqual([
      'subelt-root', 'subelt-apply:trim', 'subelt-pipelines-separator', 'subelt-run:p1', 'subelt-run:p2', 'subelt-separator', 'subelt-open-in-app',
    ])
  })

  it('needs no separator of their own without favourites', () => {
    expect(buildMenuItems([], metaOf, pipelines).map(i => i.id)).toEqual([
      'subelt-root', 'subelt-run:p1', 'subelt-run:p2', 'subelt-separator', 'subelt-open-in-app',
    ])
  })

  it('titles them "Pipeline: <name>" under the root', () => {
    expect(buildMenuItems([], metaOf, pipelines)[1]).toMatchObject({ parentId: 'subelt-root', title: 'Pipeline: Decode token' })
  })

  it('maps a pipeline item back to its id', () => {
    expect(pipelineIdFromMenuItem('subelt-run:p1')).toBe('p1')
    expect(pipelineIdFromMenuItem('subelt-apply:trim')).toBeNull()
    expect(utilityIdFromMenuItem('subelt-run:p1')).toBeNull()
  })
})

describe('menuTitle', () => {
  it('breaks every %s so Chrome shows it instead of the selection', () => {
    expect(menuTitle('a %s b %s')).toBe('a %\u200Bs b %\u200Bs')
    expect(menuTitle('100% sure')).toBe('100% sure')
  })
})
