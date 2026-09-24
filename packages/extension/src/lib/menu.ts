/**
 * Pure computation of the context-menu tree from a list of utility ids — kept
 * free of the `chrome` API so it is trivial to unit-test; `background.ts`
 * plays the resulting descriptors through `chrome.contextMenus.create`.
 */
import type { UtilityMeta } from '../../../../src/core/registry'
import { APPLY_PREFIX, MENU_OPEN_ID, MENU_ROOT_ID, MENU_SEPARATOR_ID } from './constants'

// `chrome.contextMenus.ContextType`/`ItemType` are real (nominal) TS enums, but
// `CreateProperties` itself accepts their template-literal string form — match
// that here so a plain string literal like 'separator' is assignable.
type MenuContext = `${chrome.contextMenus.ContextType}`
type MenuItemType = `${chrome.contextMenus.ItemType}`

const CONTEXTS: [MenuContext, ...MenuContext[]] = ['selection', 'editable']

export interface MenuItemDescriptor {
  id: string
  parentId?: string
  title?: string
  type?: MenuItemType
  contexts: [MenuContext, ...MenuContext[]]
}

/**
 * The full menu tree for `ids`: a root, one "Apply: <name>" item per known,
 * edge-safe id (unknown ids from stale/corrupted storage are skipped), a
 * separator, then the "open in app" action.
 */
export function buildMenuItems(
  ids: string[],
  metaOf: (id: string) => Pick<UtilityMeta, 'id' | 'name'> | undefined,
): MenuItemDescriptor[] {
  const items: MenuItemDescriptor[] = [
    { id: MENU_ROOT_ID, title: 'String Utility Belt', contexts: CONTEXTS },
  ]
  for (const id of ids) {
    const meta = metaOf(id)
    if (!meta) continue
    items.push({ id: `${APPLY_PREFIX}${id}`, parentId: MENU_ROOT_ID, title: `Apply: ${meta.name}`, contexts: CONTEXTS })
  }
  items.push({ id: MENU_SEPARATOR_ID, parentId: MENU_ROOT_ID, type: 'separator', contexts: CONTEXTS })
  items.push({ id: MENU_OPEN_ID, parentId: MENU_ROOT_ID, title: 'Open selection in String Utility Belt', contexts: CONTEXTS })
  return items
}

/** The utility id encoded in an "Apply: …" menu item id, or null for any other item. */
export function utilityIdFromMenuItem(menuItemId: string | number): string | null {
  const id = String(menuItemId)
  return id.startsWith(APPLY_PREFIX) ? id.slice(APPLY_PREFIX.length) : null
}
