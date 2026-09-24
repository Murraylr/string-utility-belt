import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_RESULT_DEPTH, MAX_RESULT_NODES, SANDBOX_TIMEOUT, clampSandboxTimeout, getSandbox, setSandbox,
  validateSandboxResult, type Sandbox,
} from './sandbox'

describe('sandbox registration', () => {
  afterEach(() => setSandbox(null))

  it('is empty until a host installs one', () => {
    expect(getSandbox()).toBeUndefined()
  })

  it('stores the implementation on globalThis so every module copy sees it', () => {
    const impl: Sandbox = { run: async () => 'x' }
    setSandbox(impl)
    expect(getSandbox()).toBe(impl)
    expect((globalThis as any).__subeltSandbox).toBe(impl)
  })

  it('removes it with null', () => {
    setSandbox({ run: async () => 'x' })
    setSandbox(null)
    expect(getSandbox()).toBeUndefined()
    expect('__subeltSandbox' in globalThis).toBe(false)
  })
})

describe('clampSandboxTimeout', () => {
  it('keeps budgets inside the limits', () => {
    expect(clampSandboxTimeout(1500)).toBe(1500)
    expect(clampSandboxTimeout(1)).toBe(SANDBOX_TIMEOUT.min)
    expect(clampSandboxTimeout(1e9)).toBe(SANDBOX_TIMEOUT.max)
    expect(clampSandboxTimeout(Infinity)).toBe(SANDBOX_TIMEOUT.default)
    expect(clampSandboxTimeout(250.6)).toBe(251)
    expect(clampSandboxTimeout('750')).toBe(750)
  })

  it('falls back to the default for non-numbers', () => {
    for (const v of [undefined, null, '', 'abc', NaN, {}, true]) {
      expect(clampSandboxTimeout(v)).toBe(SANDBOX_TIMEOUT.default)
    }
  })
})

describe('validateSandboxResult', () => {
  it('accepts strings, bytes and plain JSON unchanged', () => {
    expect(validateSandboxResult('')).toBe('')
    expect(validateSandboxResult('héllo 日本')).toBe('héllo 日本')
    const bytes = new Uint8Array([1, 2, 3])
    expect(validateSandboxResult(bytes)).toBe(bytes)
    const json = { a: [1, 'two', true, null, { b: -0.5 }], 'odd key': {}, empty: [] }
    expect(validateSandboxResult(json)).toBe(json)
    expect(validateSandboxResult([])).toEqual([])
    const bare = Object.assign(Object.create(null), { a: 1 })
    expect(validateSandboxResult(bare)).toBe(bare)
  })

  it('accepts a Uint8Array view over part of a buffer', () => {
    const view = new Uint8Array(new ArrayBuffer(8), 2, 3)
    expect(validateSandboxResult(view)).toBe(view)
  })

  it('accepts shared (non-circular) references', () => {
    const shared = { x: 1 }
    expect(() => validateSandboxResult([shared, shared, { shared }])).not.toThrow()
  })

  it('explains a missing return', () => {
    expect(() => validateSandboxResult(undefined)).toThrow(/must `return` a value/)
  })

  it('rejects bare primitives other than strings, suggesting String()', () => {
    expect(() => validateSandboxResult(42)).toThrow(/returned a number.*String\(value\)/)
    expect(() => validateSandboxResult(true)).toThrow(/returned a boolean/)
    expect(() => validateSandboxResult(10n)).toThrow(/returned a bigint/)
    expect(() => validateSandboxResult(null)).toThrow(/returned null/)
  })

  it('rejects functions and symbols, top-level and nested, naming the path', () => {
    expect(() => validateSandboxResult(() => 1)).toThrow(/returned a function/)
    expect(() => validateSandboxResult(Symbol('s'))).toThrow(/returned a symbol/)
    expect(() => validateSandboxResult({ a: { b: () => 1 } })).toThrow(/a function at \$\.a\.b/)
    expect(() => validateSandboxResult([1, Symbol('s')])).toThrow(/a symbol at \$\[1\]/)
    expect(() => validateSandboxResult({ [Symbol('k')]: 1 })).toThrow(/symbol-keyed property at \$/)
    expect(() => validateSandboxResult({ 'a-b': { c: 1n } })).toThrow(/a bigint at \$\["a-b"\]\.c/)
  })

  it('rejects undefined, holes and non-finite numbers inside JSON', () => {
    expect(() => validateSandboxResult({ a: undefined })).toThrow(/undefined at \$\.a/)
    // eslint-disable-next-line no-sparse-arrays
    expect(() => validateSandboxResult([1, , 3])).toThrow(/undefined at \$\[1\]/)
    expect(() => validateSandboxResult({ n: NaN })).toThrow(/non-finite number \(NaN\)/)
    expect(() => validateSandboxResult([Infinity])).toThrow(/non-finite number \(Infinity\)/)
  })

  it('rejects non-plain objects: Dates, Maps, class instances, other typed arrays', () => {
    class Point { x = 1 }
    expect(() => validateSandboxResult(new Date(0))).toThrow(/a Date at \$/)
    expect(() => validateSandboxResult({ m: new Map() })).toThrow(/a Map at \$\.m/)
    expect(() => validateSandboxResult([new Point()])).toThrow(/a Point at \$\[0\]/)
    expect(() => validateSandboxResult({ b: new Uint8Array(1) })).toThrow(/a Uint8Array at \$\.b/)
    expect(() => validateSandboxResult(new Uint16Array(2))).toThrow(/returned a Uint16Array/)
    expect(() => validateSandboxResult(new Uint8ClampedArray(2))).toThrow(/returned a Uint8ClampedArray/)
    expect(() => validateSandboxResult(new ArrayBuffer(2))).toThrow(/an ArrayBuffer at \$/)
    expect(() => validateSandboxResult(new String('boxed'))).toThrow(/a String at \$/)
  })

  it('treats an object that merely claims to be a Uint8Array as the JSON it is', () => {
    const fake = { constructor: { name: 'Uint8Array' }, byteLength: 3, buffer: {}, length: 3 }
    expect(validateSandboxResult(fake)).toBe(fake)
    expect(ArrayBuffer.isView(fake)).toBe(false)
    const tagged = { [Symbol.toStringTag]: 'Uint8Array' }
    expect(() => validateSandboxResult(tagged)).toThrow(/plain JSON/)
  })

  it('rejects accessor properties', () => {
    const obj = Object.defineProperty({}, 'lazy', { get: () => 1, enumerable: true })
    expect(() => validateSandboxResult(obj)).toThrow(/accessor property "lazy"/)
  })

  it('rejects cycles', () => {
    const a: any = { b: {} }
    a.b.back = a
    expect(() => validateSandboxResult(a)).toThrow(/circular reference at \$\.b\.back/)
    const arr: any[] = []
    arr.push(arr)
    expect(() => validateSandboxResult(arr)).toThrow(/circular reference at \$\[0\]/)
  })

  it('bounds nesting depth', () => {
    let ok: unknown = 'leaf'
    for (let i = 0; i < MAX_RESULT_DEPTH; i++) ok = [ok]
    expect(() => validateSandboxResult(ok)).not.toThrow()
    expect(() => validateSandboxResult([ok])).toThrow(new RegExp(`deeper than ${MAX_RESULT_DEPTH}`))
    let deep: unknown = {}
    for (let i = 0; i < 10000; i++) deep = { d: deep }
    expect(() => validateSandboxResult(deep)).toThrow(/deeper than/)
  })

  it('applies the depth limit to a shared object wherever it is reused', () => {
    let chain: unknown = 'leaf'
    for (let i = 0; i < 90; i++) chain = [chain]
    let wrapper: unknown = chain
    for (let i = 0; i < 20; i++) wrapper = [wrapper]
    // `chain` fits on its own, but not 20 levels further down
    expect(() => validateSandboxResult({ shallow: chain, deep: wrapper })).toThrow(/deeper than 100/)
  })

  it('rejects a tiny DAG that expands to an astronomically large tree, quickly', () => {
    let dag: unknown[] = []
    for (let i = 0; i < 60; i++) dag = [dag, dag]
    const t0 = Date.now()
    expect(() => validateSandboxResult(dag)).toThrow(/more than 10,000,000 parts once shared references are expanded/)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(MAX_RESULT_NODES).toBe(10_000_000)
  })

  it('accepts large legitimate results', () => {
    const numbers = Array.from({ length: 2_000_000 }, (_, i) => i & 255)
    const t0 = Date.now()
    expect(validateSandboxResult(numbers)).toBe(numbers)
    expect(Date.now() - t0).toBeLessThan(5000)
    let smallDag: unknown[] = ['x']
    for (let i = 0; i < 10; i++) smallDag = [smallDag, smallDag]
    expect(() => validateSandboxResult(smallDag)).not.toThrow()
  })
})
