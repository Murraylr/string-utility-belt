import { describe, expect, it } from 'vitest'
import {
  APP_SOURCE, MAX_PIPELINE_NAME, canRunInExtension, extensionUnsupportedSteps, isAppMessage, isBridgeResult,
  isExtensionHello, normalizePipelineName, parseAppRequest,
} from './extensionBridge'

const env: Record<string, { env: Array<'dom' | 'wasm' | 'eval' | 'main'> }> = {
  trim: { env: [] },
  sha3: { env: ['wasm'] },
  custom_js: { env: ['eval', 'main'] },
  html_to_markdown: { env: ['dom'] },
}
const lookup = (id: string) => env[id]

describe('canRunInExtension', () => {
  it('allows wasm, refuses dom, main and eval', () => {
    expect(canRunInExtension({ env: [] })).toBe(true)
    expect(canRunInExtension({ env: ['wasm'] })).toBe(true)
    for (const e of ['dom', 'main', 'eval'] as const) expect(canRunInExtension({ env: [e] })).toBe(false)
  })
})

describe('extensionUnsupportedSteps', () => {
  it('finds unsupported and unknown utilities anywhere in the tree, disabled ones included', () => {
    expect(extensionUnsupportedSteps([
      { id: 'a', utilityId: 'trim' },
      { id: 'b', utilityId: 'custom_js', enabled: false },
      { id: 'c', type: 'branch', merge: { mode: 'json' }, branches: [[{ id: 'd', utilityId: 'sha3' }], [{ id: 'e', utilityId: 'html_to_markdown' }]] },
      { id: 'f', type: 'macro', name: 'm', steps: [{ id: 'g', utilityId: 'gone' }] },
    ], lookup)).toEqual([
      { stepId: 'b', utilityId: 'custom_js', reason: 'needs eval, main' },
      { stepId: 'e', utilityId: 'html_to_markdown', reason: 'needs dom' },
      { stepId: 'g', utilityId: 'gone', reason: 'unknown utility' },
    ])
  })
})

describe('message guards', () => {
  it('recognise app messages, the extension\'s hello and bridge results, and nothing else', () => {
    expect(isAppMessage({ source: APP_SOURCE, protocol: 1, type: 'ping' })).toBe(true)
    expect(isAppMessage({ source: APP_SOURCE, protocol: 1, type: 'request', request: {} })).toBe(true)
    expect(isAppMessage({ source: APP_SOURCE, type: 'ping' })).toBe(false) // no protocol
    expect(isAppMessage({ source: 'someone-else', protocol: 1, type: 'ping' })).toBe(false)
    expect(isAppMessage({ source: APP_SOURCE, protocol: 1, type: 'delete' })).toBe(false)
    expect(isAppMessage('ping')).toBe(false)
    expect(isExtensionHello({ protocol: 1, version: '1.3.0' })).toBe(true)
    expect(isExtensionHello({ protocol: 1 })).toBe(false)
    expect(isBridgeResult({ ok: true, message: 'm' })).toBe(true)
    expect(isBridgeResult({ ok: false, error: 'e' })).toBe(true)
    expect(isBridgeResult({ ok: true })).toBe(false)
    expect(isBridgeResult(null)).toBe(false)
  })
})

describe('parseAppRequest', () => {
  it('accepts the two request shapes, keeping only string favourite ids', () => {
    expect(parseAppRequest({ type: 'save-pipeline', name: 'n', steps: [{}] })).toEqual({ type: 'save-pipeline', name: 'n', steps: [{}] })
    expect(parseAppRequest({ type: 'add-favorites', utilityIds: ['trim', 1, null] })).toEqual({ type: 'add-favorites', utilityIds: ['trim'] })
  })

  it('refuses anything else', () => {
    for (const raw of [null, [], 'x', { type: 'save-pipeline', name: 1, steps: [] }, { type: 'save-pipeline', name: 'n', steps: {} },
      { type: 'add-favorites', utilityIds: 'trim' }, { type: 'delete-all' }]) {
      expect(parseAppRequest(raw)).toBeNull()
    }
  })
})

describe('normalizePipelineName', () => {
  it('collapses whitespace, trims, and caps the length', () => {
    expect(normalizePipelineName('  a \n\t b  ')).toBe('a b')
    expect(normalizePipelineName('   ')).toBe('')
    expect(normalizePipelineName('x'.repeat(200))).toHaveLength(MAX_PIPELINE_NAME)
  })
})
