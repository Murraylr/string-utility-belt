/**
 * MV3 service worker: owns the context-menu tree and applies utilities to the
 * page's current selection. Built as one self-contained module (service
 * workers can't use dynamic `import()`; see vite.config.ts).
 */
import {
  BRIDGE_ORIGINS, BRIDGE_PROTOCOL, isAppMessage, parseAppRequest, type BridgeResult, type ExtensionHello,
} from '../../../src/core/extensionBridge'
import type { Value } from '../../../src/types/utility'
import { MENU_OPEN_ID } from './lib/constants'
import { handleAppRequest } from './lib/library'
import { buildMenuItems, pipelineIdFromMenuItem, utilityIdFromMenuItem } from './lib/menu'
import { readSelection, replaceSelectionOrCopy, type PageSelection } from './lib/replace'
import { getEdgeSafeUtilityMeta, getUtilityMeta, resultToText, runPipelineSteps, runUtilityById } from './lib/registry'
import { appUrl, getBaseUrl, getMenuUtilities, getPipelines, setLastError, setLastResult } from './lib/storage'

/** Reads `chrome.runtime.lastError` so Chrome doesn't log it as unchecked. */
const swallowLastError = () => void chrome.runtime?.lastError

async function buildMenu(): Promise<void> {
  const [favorites, pipelines] = await Promise.all([getMenuUtilities(), getPipelines()])
  const items = buildMenuItems(favorites, getEdgeSafeUtilityMeta, pipelines)
  await new Promise<void>(resolve => chrome.contextMenus.removeAll(() => { swallowLastError(); resolve() }))
  for (const item of items) chrome.contextMenus.create(item, swallowLastError)
}

let menuQueue: Promise<void> = Promise.resolve()

/** Rebuilds the whole tree from the current favourites and saved pipelines. Rebuilds
 * run one at a time: interleaved ones would leave a mix of old and new items. */
export function rebuildMenu(): Promise<void> {
  menuQueue = menuQueue.then(buildMenu, buildMenu)
  return menuQueue
}

chrome.runtime.onInstalled.addListener(() => { void rebuildMenu() })
chrome.runtime.onStartup.addListener(() => { void rebuildMenu() })
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' && changes.menuUtilities) || (area === 'local' && changes.pipelines)) void rebuildMenu()
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
async function reportFailure(name: string, source: string, error: unknown): Promise<void> {
  const message = `${name} failed: ${(error as Error)?.message || String(error)}`
  setBadge('!', `String Utility Belt — ${message}`)
  await Promise.all([setLastResult(source), setLastError(message)])
}

/** What an "Apply: …" or "Pipeline: …" item runs, or null for an item that no longer exists (a pipeline deleted since the menu was built). */
async function menuJob(menuItemId: string | number): Promise<{ name: string; run: (source: string) => Promise<Value> } | null> {
  const utilityId = utilityIdFromMenuItem(menuItemId)
  if (utilityId) return { name: getUtilityMeta(utilityId)?.name ?? utilityId, run: source => runUtilityById(utilityId, source) }
  const pipelineId = pipelineIdFromMenuItem(menuItemId)
  const pipeline = pipelineId ? (await getPipelines()).find(p => p.id === pipelineId) : undefined
  return pipeline ? { name: pipeline.name, run: source => runPipelineSteps(pipeline.steps, source) } : null
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

  const job = await menuJob(info.menuItemId)
  if (!job) return

  let text: string
  try {
    text = resultToText(await job.run(source))
  } catch (e) {
    await reportFailure(job.name, source, e)
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

/**
 * Where web-app messages may come from. The manifest's `externally_connectable`
 * already limits which pages can message the extension; checking the sender
 * again keeps the rule here even if the manifest is widened, and refuses
 * frames (an embed of the site inside someone else's page). Development builds
 * also accept a local dev server.
 */
export function isAppSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.tab || sender.frameId !== 0 || !sender.url) return false
  let url: URL
  try {
    url = new URL(sender.url)
  } catch {
    return false
  }
  if (BRIDGE_ORIGINS.includes(url.origin)) return true
  return import.meta.env.MODE !== 'production' && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

const REFUSED: BridgeResult = { ok: false, error: 'The extension refused this request.' }

/**
 * Messages from the web app (`chrome.runtime.sendMessage(extensionId, …)`): a
 * ping, answered with the extension's version so the app can offer "save to
 * extension", or a request to save a pipeline or add favourites.
 */
export function handleAppMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (answer: BridgeResult | ExtensionHello) => void,
): boolean {
  if (!isAppSender(sender) || !isAppMessage(message)) {
    sendResponse(REFUSED)
    return false
  }
  if (message.type === 'ping') {
    sendResponse({ protocol: BRIDGE_PROTOCOL, version: chrome.runtime.getManifest().version })
    return false
  }
  if (message.protocol !== BRIDGE_PROTOCOL) {
    sendResponse({ ok: false, error: 'This page and the extension are different versions. Update the extension and reload the page.' })
    return false
  }
  const request = parseAppRequest(message.request)
  if (!request) {
    sendResponse(REFUSED)
    return false
  }
  void handleAppRequest(request).then(sendResponse)
  return true // answered asynchronously
}

chrome.runtime.onMessageExternal.addListener(handleAppMessage)
