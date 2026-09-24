/**
 * MV3 service worker: owns the context-menu tree and applies utilities to the
 * page's current selection. Built as one self-contained module (service
 * workers can't use dynamic `import()`; see vite.config.ts).
 */
import { MENU_OPEN_ID } from './lib/constants'
import { buildMenuItems, utilityIdFromMenuItem } from './lib/menu'
import { readSelection, replaceSelectionOrCopy, type PageSelection } from './lib/replace'
import { getEdgeSafeUtilityMeta, getUtilityMeta, resultToText, runUtilityById } from './lib/registry'
import { appUrl, getBaseUrl, getMenuUtilities, setLastError, setLastResult } from './lib/storage'

/** Reads `chrome.runtime.lastError` so Chrome doesn't log it as unchecked. */
const swallowLastError = () => void chrome.runtime?.lastError

async function buildMenu(): Promise<void> {
  const items = buildMenuItems(await getMenuUtilities(), getEdgeSafeUtilityMeta)
  await new Promise<void>(resolve => chrome.contextMenus.removeAll(() => { swallowLastError(); resolve() }))
  for (const item of items) chrome.contextMenus.create(item, swallowLastError)
}

let menuQueue: Promise<void> = Promise.resolve()

/** Rebuilds the whole tree from the current menu-utilities setting. Rebuilds
 * run one at a time: interleaved ones would leave a mix of old and new items. */
export function rebuildMenu(): Promise<void> {
  menuQueue = menuQueue.then(buildMenu, buildMenu)
  return menuQueue
}

chrome.runtime.onInstalled.addListener(() => { void rebuildMenu() })
chrome.runtime.onStartup.addListener(() => { void rebuildMenu() })
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.menuUtilities) void rebuildMenu()
})

/** Runs `func` in one frame of the tab; `undefined` when the page refuses injection (chrome://, the Web Store, a cross-origin frame…). */
async function inject<Args extends unknown[], Result>(
  tabId: number,
  frameId: number,
  func: (...args: Args) => Result,
  args: Args,
): Promise<Awaited<Result> | undefined> {
  try {
    const [injected] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func, args })
    return injected?.result as Awaited<Result> | undefined
  } catch {
    return undefined
  }
}

function setBadge(text: string, title: string): void {
  chrome.action?.setBadgeBackgroundColor?.({ color: '#dc2626' })
  chrome.action?.setBadgeText?.({ text })
  chrome.action?.setTitle?.({ title })
}

/** A failed run never touches the page: the popup gets the input and the error, the toolbar icon a badge. */
async function reportFailure(utilityId: string, source: string, error: unknown): Promise<void> {
  const name = getUtilityMeta(utilityId)?.name ?? utilityId
  const message = `${name} failed: ${(error as Error)?.message || String(error)}`
  setBadge('!', `String Utility Belt — ${message}`)
  await Promise.all([setLastResult(source), setLastError(message)])
}

export async function handleClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void> {
  const tabId = tab?.id !== undefined && tab.id >= 0 ? tab.id : undefined
  const frameId = info.frameId ?? 0
  const picked: PageSelection | null | undefined =
    tabId === undefined ? undefined : await inject(tabId, frameId, readSelection, [])
  const source = picked?.text ?? info.selectionText
  if (source === undefined) return
  const whole = picked?.whole ?? false

  if (info.menuItemId === MENU_OPEN_ID) {
    chrome.tabs.create({ url: appUrl(await getBaseUrl(), source) })
    return
  }

  const utilityId = utilityIdFromMenuItem(info.menuItemId)
  if (!utilityId) return

  let text: string
  try {
    text = resultToText(await runUtilityById(utilityId, source))
  } catch (e) {
    await reportFailure(utilityId, source, e)
    return
  }
  setBadge('', 'String Utility Belt')

  let replaced: boolean | undefined
  if (tabId !== undefined) {
    replaced = await inject(tabId, frameId, replaceSelectionOrCopy, [text, source, whole])
    // A frame we may not script (e.g. a cross-origin iframe editor) still gets
    // the result on the clipboard via the top frame.
    if (replaced === undefined && frameId !== 0) await inject(tabId, 0, replaceSelectionOrCopy, [text, null, false])
  }
  if (replaced !== true) await setLastResult(text)
}

chrome.contextMenus.onClicked.addListener((info, tab) => { void handleClick(info, tab) })
