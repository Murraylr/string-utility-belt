import type { Utility } from '@/types/utility'
import { hexToBytes } from '../helpers'

// Lazily imported + cached: see house rule on dynamic dependency loading.
let _hashWasm: typeof import('hash-wasm') | null = null
const getHashWasm = async () => (_hashWasm ??= await import('hash-wasm'))

const VARIANTS = ['argon2id', 'argon2i', 'argon2d'] as const
type Variant = (typeof VARIANTS)[number]

const MAX_MEMORY_KIB = 1048576 // 1 GiB — beyond this the browser tab just dies
const MAX_HASH_LENGTH = 1024
// Argon2 itself allows t and p up to 2^32-1 / 2^24-1, but the pipeline re-runs
// on every keystroke: an unbounded t means one stray digit wedges the tab in a
// hash that never returns. These ceilings are far above any real tuning.
const MAX_ITERATIONS = 1000
const MAX_PARALLELISM = 1024

/**
 * Argon2 needs at least 8 bytes of salt. Accepted forms:
 *   ''                                  -> 16 cryptographically random bytes
 *   an even number of hex chars (>= 16) -> those bytes
 *   anything else                       -> its UTF-8 bytes
 */
const parseArgonSalt = (raw: string): Uint8Array => {
  const s = raw.trim()
  if (s === '') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return bytes
  }
  const compact = s.replace(/\s+/g, '').replace(/^0x/i, '')
  if (/^[0-9a-fA-F]{16,}$/.test(compact) && compact.length % 2 === 0) {
    return hexToBytes(compact)
  }
  const bytes = new TextEncoder().encode(s)
  if (bytes.length < 8) {
    throw new Error(
      `argon2 salt must be at least 8 bytes; ${JSON.stringify(s)} is ${bytes.length} bytes`
    )
  }
  return bytes
}

const parseInteger = (raw: unknown, fallback: number, label: string): number => {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n)) throw new Error(`${label} must be a whole number`)
  return n
}

const util: Utility = {
  id: 'argon2_hash',
  name: 'argon2 hash',
  category: 'Hashing',
  description:
    'Hash a password with Argon2 (argon2id, argon2i, or argon2d), tuning iterations, memory, parallelism, hash length, and salt.',
  accepts: 'string',
  produces: 'string',
  tags: ['password hashing', 'kdf', 'key derivation', 'argon2id', 'argon2i', 'argon2d'],
  examples: [
    {
      title: 'argon2id with a fixed salt (reproducible for the example)',
      input: 'hunter2',
      params: { iterations: 2, memoryKiB: 8, parallelism: 1, salt: '0000000000000000' },
      output: '$argon2id$v=19$m=8,t=2,p=1$AAAAAAAAAAA$kJIgd5fDoU8M8s/bTbAR8Pbft1SJMQmQGBZjeJT0PT4'
    }
  ],
  params: {
    variant: {
      kind: 'select',
      label: 'variant',
      options: [...VARIANTS],
      default: 'argon2id'
    },
    iterations: { kind: 'number', label: 'iterations (t)', default: 3, min: 1, max: MAX_ITERATIONS, integer: true },
    memoryKiB: { kind: 'number', label: 'memory (KiB)', default: 4096, max: MAX_MEMORY_KIB, integer: true },
    parallelism: { kind: 'number', label: 'parallelism (p)', default: 1, min: 1, max: MAX_PARALLELISM, integer: true },
    hashLength: { kind: 'number', label: 'hash length (bytes)', default: 32, min: 4, max: MAX_HASH_LENGTH, integer: true },
    salt: {
      kind: 'string',
      label: 'salt (blank = random)',
      default: '',
      placeholder: 'hex or text, at least 8 bytes'
    }
  },
  apply: async (input: any, params: any) => {
    const password = String(input ?? '')
    if (password === '') return ''

    const variantName = String(params?.variant || 'argon2id') as Variant
    if (!VARIANTS.includes(variantName)) {
      throw new Error(`unknown argon2 variant ${JSON.stringify(variantName)}; use ${VARIANTS.join(', ')}`)
    }

    const iterations = parseInteger(params?.iterations, 3, 'iterations')
    if (iterations < 1) throw new Error(`iterations must be at least 1 (got ${iterations})`)
    if (iterations > MAX_ITERATIONS) {
      throw new Error(`iterations is capped at ${MAX_ITERATIONS} (got ${iterations})`)
    }

    const parallelism = parseInteger(params?.parallelism, 1, 'parallelism')
    if (parallelism < 1) throw new Error(`parallelism must be at least 1 (got ${parallelism})`)
    if (parallelism > MAX_PARALLELISM) {
      throw new Error(`parallelism is capped at ${MAX_PARALLELISM} (got ${parallelism})`)
    }

    const memoryKiB = parseInteger(params?.memoryKiB, 4096, 'memory (KiB)')
    if (memoryKiB < 8 * parallelism) {
      throw new Error(`memory must be at least 8 KiB per lane, i.e. ${8 * parallelism} KiB for parallelism ${parallelism} (got ${memoryKiB})`)
    }
    if (memoryKiB > MAX_MEMORY_KIB) {
      throw new Error(`memory is capped at ${MAX_MEMORY_KIB} KiB (1 GiB) (got ${memoryKiB})`)
    }

    const hashLength = parseInteger(params?.hashLength, 32, 'hash length')
    if (hashLength < 4) throw new Error(`hash length must be at least 4 bytes (got ${hashLength})`)
    if (hashLength > MAX_HASH_LENGTH) {
      throw new Error(`hash length is capped at ${MAX_HASH_LENGTH} bytes (got ${hashLength})`)
    }

    const salt = parseArgonSalt(params?.salt == null ? '' : String(params.salt))

    const hashWasm = await getHashWasm()
    const fn =
      variantName === 'argon2i' ? hashWasm.argon2i
        : variantName === 'argon2d' ? hashWasm.argon2d
          : hashWasm.argon2id

    return await fn({
      password: new TextEncoder().encode(password),
      salt,
      iterations,
      parallelism,
      memorySize: memoryKiB,
      hashLength,
      outputType: 'encoded'
    })
  }
}

export default util
