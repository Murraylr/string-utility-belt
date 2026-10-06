import { describe, expect, it } from 'vitest'
import {
  APP_SOURCE, EXTENSION_SOURCE, MAX_PIPELINE_NAME, canRunInExtension, extensionUnsupportedSteps, isAppMessage,
  isExtensionMessage, normalizePipelineName, parseAppRequest,
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
  it('recognise each side\'s messages and nothing else', () => {
    expect(isAppMessage({ source: APP_SOURCE, type: 'ping' })).toBe(true)
    expect(isAppMessage({ source: APP_SOURCE, type: 'request', requestId: 'r' })).toBe(true)
    expect(isAppMessage({ source: APP_SOURCE, type: 'request' })).toBe(false)
    expect(isAppMessage({ source: EXTENSION_SOURCE, type: 'ping' })).toBe(false)
    expect(isAppMessage('ping')).toBe(false)
    expect(isExtensionMessage({ source: EXTENSION_SOURCE, type: 'hello', version: '1' })).toBe(true)
    expect(isExtensionMessage({ source: EXTENSION_SOURCE, type: 'response', requestId: 'r' })).toBe(true)
    expect(isExtensionMessage({ source: APP_SOURCE, type: 'hello' })).toBe(false)
    expect(isExtensionMessage(null)).toBe(false)
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
