/**
 * The contract between the web app and the browser extension
 * (`packages/extension`). The extension declares the app's own origins in its
 * manifest's `externally_connectable`, which lets pages there message it
 * directly with `chrome.runtime.sendMessage(extensionId, …)` — no content
 * script, no extra install permission. The service worker validates every
 * request again: whatever arrives from a page is untrusted input.
 *
 * Also the one place that says which utilities the extension can run, so the
 * app can warn before it offers a pipeline the extension would refuse.
 */
import type { PipelineStep, UtilityEnv } from '../types/utility'
import type { UtilityMeta } from './registry'
import { isUtilityStep, walkSteps } from './steps'

/** Bumped only for a breaking change to the messages below. */
export const BRIDGE_PROTOCOL = 1

/** `source` of every message the app sends. */
export const APP_SOURCE = 'subelt-app'

/** The extension's id in the Chrome Web Store (the app also accepts `VITE_EXTENSION_IDS`, for unpacked builds). */
export const STORE_EXTENSION_ID = 'onmlbgadajghegkcpkkhlmmognihjfbh'

/** Origins that may message the extension (its manifest's `externally_connectable.matches` are derived from these). */
export const BRIDGE_ORIGINS: readonly string[] = ['https://stringutilitybelt.com', 'https://www.stringutilitybelt.com']

/** Capabilities the extension lacks: no DOM in its service worker, no main thread, no eval under its CSP. */
export const EXTENSION_UNSUPPORTED_ENV: ReadonlySet<UtilityEnv> = new Set<UtilityEnv>(['dom', 'main', 'eval'])

export const MAX_PIPELINE_NAME = 80
export const MAX_SAVED_PIPELINES = 50
/** Largest saved pipeline, as JSON characters: room for long regexes and lookup tables, not for files. */
export const MAX_PIPELINE_CHARS = 100_000
export const MAX_FAVORITES = 100

export type AppRequest =
  | { type: 'save-pipeline'; name: string; steps: PipelineStep[] }
  | { type: 'add-favorites'; utilityIds: string[] }

export type BridgeResult = { ok: true; message: string } | { ok: false; error: string }

export type AppMessage =
  | { source: typeof APP_SOURCE; protocol: number; type: 'ping' }
  | { source: typeof APP_SOURCE; protocol: number; type: 'request'; request: AppRequest }

/** The extension's answer to a ping. */
export interface ExtensionHello { protocol: number; version: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function isAppMessage(v: unknown): v is AppMessage {
  return isObj(v) && v.source === APP_SOURCE && typeof v.protocol === 'number' && (v.type === 'ping' || v.type === 'request')
}

export function isExtensionHello(v: unknown): v is ExtensionHello {
  return isObj(v) && typeof v.protocol === 'number' && typeof v.version === 'string'
}

export function isBridgeResult(v: unknown): v is BridgeResult {
  return isObj(v) && ((v.ok === true && typeof v.message === 'string') || (v.ok === false && typeof v.error === 'string'))
}

/**
 * The request's shape, or null. Only the envelope is checked here: steps are
 * still raw data that the receiver must pass through `sanitizeSteps`.
 */
export function parseAppRequest(raw: unknown): AppRequest | null {
  if (!isObj(raw)) return null
  if (raw.type === 'save-pipeline' && typeof raw.name === 'string' && Array.isArray(raw.steps)) {
    return { type: 'save-pipeline', name: raw.name, steps: raw.steps as PipelineStep[] }
  }
  if (raw.type === 'add-favorites' && Array.isArray(raw.utilityIds)) {
    return { type: 'add-favorites', utilityIds: raw.utilityIds.filter((id): id is string => typeof id === 'string') }
  }
  return null
}

/** A pipeline name as stored: single-spaced, trimmed, capped. '' when nothing usable is left. */
export function normalizePipelineName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_PIPELINE_NAME).trim()
}

export const canRunInExtension = (meta: Pick<UtilityMeta, 'env'>): boolean =>
  !meta.env.some(e => EXTENSION_UNSUPPORTED_ENV.has(e))

export interface ExtensionUnsupported { stepId: string; utilityId: string; reason: string }

/** Every step the extension cannot run, disabled ones included (unknown utilities too). */
export function extensionUnsupportedSteps(
  steps: PipelineStep[],
  lookup: (id: string) => Pick<UtilityMeta, 'env'> | undefined,
): ExtensionUnsupported[] {
  const out: ExtensionUnsupported[] = []
  walkSteps(steps, s => {
    if (!isUtilityStep(s)) return
    const meta = lookup(s.utilityId)
    if (!meta) out.push({ stepId: s.id, utilityId: s.utilityId, reason: 'unknown utility' })
    else if (!canRunInExtension(meta)) {
      out.push({ stepId: s.id, utilityId: s.utilityId, reason: `needs ${meta.env.filter(e => EXTENSION_UNSUPPORTED_ENV.has(e)).join(', ')}` })
    }
  })
  return out
}
