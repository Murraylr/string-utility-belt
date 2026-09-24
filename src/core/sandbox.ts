/**
 * The contract between the `custom_js` utility and whatever can run untrusted
 * code in the current environment. The engine never evaluates user code itself:
 * a host (the web app's sandboxed iframe + Worker, see src/app/sandbox) registers
 * an implementation, and environments without one refuse custom code outright.
 */
import type { Value } from '../types/utility'

export interface SandboxRequest {
  /** A function body; `input` is in scope and the body must `return` the result. */
  code: string
  input: Value
  /** Wall-clock budget for the whole run. */
  timeoutMs: number
  signal?: AbortSignal
}

export interface Sandbox {
  run(req: SandboxRequest): Promise<Value>
}

/** Bounds every sandbox run is held to, whatever the caller asks for. */
export const SANDBOX_TIMEOUT = { min: 100, max: 30000, default: 2000 } as const

/** A requested budget, clamped to SANDBOX_TIMEOUT (non-numbers get the default). */
export function clampSandboxTimeout(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(n)) return SANDBOX_TIMEOUT.default
  return Math.min(SANDBOX_TIMEOUT.max, Math.max(SANDBOX_TIMEOUT.min, Math.round(n)))
}

/**
 * Kept on `globalThis` rather than in module state: the utility is a lazily loaded
 * chunk in the app and statically bundled elsewhere, and every copy must see the
 * one sandbox the host installed.
 */
type SandboxGlobal = typeof globalThis & { __subeltSandbox?: Sandbox }
const g = globalThis as SandboxGlobal

/** Register (or with `null`, remove) the sandbox for this environment. */
export function setSandbox(impl: Sandbox | null): void {
  if (impl) g.__subeltSandbox = impl
  else delete g.__subeltSandbox
}

export function getSandbox(): Sandbox | undefined {
  return g.__subeltSandbox
}

/** Deepest nesting a returned JSON value may have. */
export const MAX_RESULT_DEPTH = 100
/**
 * Most values a result may hold once shared references are expanded. Structured
 * clone preserves sharing, so fifty levels of `a = [a, a]` is a tiny message that
 * JSON.stringify (every preview, every copy) would expand to 2^50 nodes and hang.
 */
export const MAX_RESULT_NODES = 10_000_000

const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag,
)!.get!

/** The internal typed-array name; cannot be spoofed by a plain object. */
const typedArrayName = (v: unknown): string | undefined =>
  ArrayBuffer.isView(v) ? TYPED_ARRAY_TAG.call(v) : undefined

/** A plain object from any realm: `{}` or `Object.create(null)`, never a class instance. */
function isPlainObject(v: object): boolean {
  if (Object.prototype.toString.call(v) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(v)
  return proto === null || Object.getPrototypeOf(proto) === null
}

/** "a Map", "an ArrayBuffer" ("a Uint8Array": U is sounded "you"). */
const article = (name: string) => `${/^[AEIO]/i.test(name) ? 'an' : 'a'} ${name}`

function describe(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v !== 'object') return article(typeof v)
  const name = typedArrayName(v) ?? (v as object).constructor?.name
  return article(typeof name === 'string' && name ? name : 'object')
}

const LEAF = { height: 0, size: 1 } as const

const pathKey = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`)

/**
 * Accept only what a pipeline step may produce: a string, a Uint8Array, or plain
 * JSON (objects/arrays of strings, finite numbers, booleans and null). Anything
 * else — functions, symbols, undefined, Dates, Maps, cycles, absurd nesting —
 * throws an error that names the offending path. Returns the value unchanged.
 */
export function validateSandboxResult(v: unknown): Value {
  if (typeof v === 'string') return v
  const typed = typedArrayName(v)
  if (typed === 'Uint8Array') return v as Uint8Array
  if (typed) throw new Error(`Custom code returned ${article(typed)}; return a Uint8Array for bytes.`)

  if (v === undefined) {
    throw new Error('Custom code returned nothing — the function body must `return` a value.')
  }
  if (v === null || typeof v !== 'object') {
    throw new Error(
      `Custom code returned ${describe(v)}; return a string, a Uint8Array, or a JSON object or array` +
      (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint' ? ' (e.g. String(value)).' : '.'),
    )
  }

  // per object: nesting height and expanded size, so each shared object is checked once
  const seen = new Map<object, { height: number; size: number }>()
  const open = new Set<object>()
  const tooDeep = () => new Error(`Custom code returned JSON nested deeper than ${MAX_RESULT_DEPTH} levels.`)
  const tooBig = () => new Error(
    `Custom code returned a value with more than ${MAX_RESULT_NODES.toLocaleString('en-US')} parts once shared references are expanded.`)

  // keys from the root to the value being checked; turned into a path only for an error
  const trail: Array<string | number> = []
  const bad = (what: string): never => {
    const path = '$' + trail.map(k => (typeof k === 'number' ? `[${k}]` : pathKey(k))).join('')
    throw new Error(`Custom code returned ${what} at ${path}; results must be plain JSON.`)
  }

  /** Validates `x`, found `depth` levels down; returns its height and expanded size. */
  const check = (x: unknown, depth: number): { height: number; size: number } => {
    if (x === null || typeof x === 'string' || typeof x === 'boolean') return LEAF
    if (typeof x === 'number') { if (!Number.isFinite(x)) bad(`a non-finite number (${x})`); return LEAF }
    if (x === undefined) bad('undefined')
    if (typeof x !== 'object') bad(describe(x))
    const obj = x as object
    const known = seen.get(obj)
    if (known) {
      if (depth + known.height - 1 > MAX_RESULT_DEPTH) throw tooDeep()
      return known
    }
    if (depth > MAX_RESULT_DEPTH) throw tooDeep()
    if (open.has(obj)) bad('a circular reference')
    const isArray = Array.isArray(obj)
    if (!isArray && !isPlainObject(obj)) bad(describe(obj))
    if (Object.getOwnPropertySymbols(obj).length) bad('a symbol-keyed property')
    open.add(obj)
    let height = 0
    let size = 1
    const child = (value: unknown, key: string | number) => {
      trail.push(key)
      const r = check(value, depth + 1)
      trail.pop()
      height = Math.max(height, r.height)
      size += r.size
      if (size > MAX_RESULT_NODES) throw tooBig()
    }
    if (isArray) {
      const arr = obj as unknown[]
      for (let i = 0; i < arr.length; i++) child(arr[i], i)
    } else {
      for (const key of Object.keys(obj)) {
        const d = Object.getOwnPropertyDescriptor(obj, key)!
        if (!('value' in d)) bad(`an accessor property "${key}"`)
        child(d.value, key)
      }
    }
    open.delete(obj)
    const result = { height: height + 1, size }
    seen.set(obj, result)
    return result
  }
  check(v, 1)
  return v as Value
}
