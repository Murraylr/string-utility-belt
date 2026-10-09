/**
 * @string-utility-belt/core — the framework-free pipeline engine plus every
 * utility, statically bundled for use outside the browser (Node scripts,
 * servers, other bundlers, CLIs).
 *
 * Re-exports the shared engine as-is (coercion, params, registry, runner,
 * serialisation, step helpers — see src/core/index.ts) and adds a
 * Node-ready registry plus a `run` convenience wrapper.
 */
// The barrel includes the custom_js sandbox contract (setSandbox/getSandbox) a Node host
// needs to run `custom_js` — see packages/cli/src/sandbox-node.ts for an implementation.
export * from '../../../src/core/index'

import {
  decodeShare, isUtilityStep, runPipeline, unsupportedSteps, walkSteps,
} from '../../../src/core/index'
import type { RunResult } from '../../../src/core/index'
import type { PipelineDoc, PipelineStep, Value } from '../../../src/types/utility'
import { staticRegistry, STATIC_UTILITIES } from '../../../src/utilities/static-registry'

export { staticRegistry, STATIC_UTILITIES }

/** A pipeline as a full document, a bare step array, or a share payload/URL. */
export type RunPipeline = PipelineDoc | PipelineStep[] | string

export interface RunOpts {
  /** Record every step's input/output for per-step previews. */
  previews?: boolean
  signal?: AbortSignal
}

/** The payload of a `…#/p/<payload>` / `…#/embed/<payload>` URL, or the text itself when it is a bare payload. */
function payloadOf(s: string): string {
  const text = s.trim()
  // the payload runs to the end and never spans a line break: look on the last line only, and
  // slice rather than capture `(.*)$`, which retries from every earlier `#/p/` (quadratic)
  const lastLine = text.slice(Math.max(...['\n', '\r', '\u2028', '\u2029'].map(c => text.lastIndexOf(c))) + 1)
  const route = /#\/(?:p|embed)\//.exec(lastLine)
  if (route) return lastLine.slice(route.index + route[0].length)
  return text.includes('/') ? text.slice(text.lastIndexOf('/') + 1) : text
}

/** decodeShare, retried once URL-decoded: chat apps and terminals sometimes percent-encode `$`/`+`. */
function decodePayload(payload: string): PipelineDoc {
  try {
    return decodeShare(payload)
  } catch (e) {
    if (!/%[0-9a-f]{2}/i.test(payload)) throw e
    let unescaped: string
    try { unescaped = decodeURIComponent(payload) } catch { throw e }
    return decodeShare(unescaped)
  }
}

/** A DOM the `dom` utilities can use: real (browser) or polyfilled (jsdom globals). */
function hasDom(): boolean {
  const g = globalThis as { DOMParser?: unknown; document?: unknown }
  return typeof g.DOMParser === 'function' && typeof g.document === 'object' && g.document !== null
}

function resolvePipeline(pipeline: RunPipeline): PipelineDoc {
  if (typeof pipeline === 'string') return decodePayload(payloadOf(pipeline))
  if (Array.isArray(pipeline)) return { v: 2, steps: pipeline }
  return pipeline
}

/**
 * Run `pipeline` (a `PipelineDoc`, a bare array of steps, or a share
 * payload/URL) against `input` using the bundled static registry.
 *
 * Throws before running anything if a step needs a capability this
 * environment (Node) does not have — see `unsupportedSteps` — or needs a DOM
 * and no `DOMParser`/`document` globals exist. In particular this refuses
 * `custom_js` (it needs the browser main thread and no sandbox is registered
 * here); use `runPipeline` directly with your own `Sandbox` (see `setSandbox`)
 * if you need custom-JS steps.
 */
export async function run(input: Value | undefined, pipeline: RunPipeline, opts: RunOpts = {}): Promise<RunResult> {
  const doc = resolvePipeline(pipeline)
  const bad = unsupportedSteps(doc.steps, id => staticRegistry.get(id), 'node')
  // The shared 'node' profile assumes a DOM may be polyfilled (jsdom); without one, a
  // DOM step would only fail mid-run with "DOMParser is not defined" — refuse it now.
  if (!hasDom()) {
    const flagged = new Set(bad.map(b => b.stepId))
    walkSteps(doc.steps, s => {
      if (!isUtilityStep(s) || flagged.has(s.id)) return
      if (staticRegistry.get(s.utilityId)?.env.includes('dom')) {
        bad.push({ stepId: s.id, utilityId: s.utilityId, reason: 'needs dom (no DOMParser/document here)' })
      }
    })
  }
  if (bad.length) {
    const detail = bad.map(b => `${b.utilityId} (step ${b.stepId}): ${b.reason}`).join('; ')
    throw new Error(`pipeline has step(s) unsupported in Node: ${detail}`)
  }
  const source = input ?? doc.input ?? ''
  return runPipeline(source, doc.steps, {
    load: id => staticRegistry.load(id),
    previews: opts.previews,
    signal: opts.signal,
    env: 'node',
  })
}
