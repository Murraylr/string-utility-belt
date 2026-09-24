import type { Utility } from '@/types/utility'

// Lazily imported + cached: see house rule on dynamic dependency loading.
let _hashWasm: typeof import('hash-wasm') | null = null
const getHashWasm = async () => (_hashWasm ??= await import('hash-wasm'))

/** `$2<variant>$<cost>$<22-char salt><31-char digest>` — 60 characters total. */
const BCRYPT_RE = /^\$(2[abxy])\$(\d{2})\$([./A-Za-z0-9]{53})$/

const util: Utility = {
  id: 'bcrypt_verify',
  name: 'bcrypt verify',
  category: 'Hashing',
  description:
    'Check whether the input is the password behind a bcrypt hash, reporting the match plus the hash variant, cost, and salt.',
  accepts: 'string',
  produces: 'json',
  tags: ['password check', 'verify hash', 'crypt', 'authenticate'],
  examples: [
    {
      title: 'a matching password',
      input: 'hunter2',
      params: { hash: '$2a$04$..CA.uOD/eaGAOmJB.yMBurkTM.teJW4P/NXJXOT49X8IHvXALk4i' },
      output: '{\n  "match": true,\n  "algorithm": "2a",\n  "cost": 4,\n  "salt": "..CA.uOD/eaGAOmJB.yMBu",\n  "reason": ""\n}'
    }
  ],
  params: {
    hash: {
      kind: 'string',
      label: 'bcrypt hash',
      default: '',
      placeholder: '$2b$10$……'
    }
  },
  apply: async (input: any, params: any) => {
    const password = String(input ?? '')
    const encoded = String(params?.hash ?? '').trim()

    if (encoded === '') {
      return { match: false, algorithm: '', cost: 0, salt: '', reason: 'no bcrypt hash supplied' }
    }

    const parsed = BCRYPT_RE.exec(encoded)
    if (!parsed) {
      throw new Error(
        'not a bcrypt hash: expected 60 characters shaped like $2b$10$<22-char salt><31-char digest>'
      )
    }
    const algorithm = parsed[1]
    const cost = Number(parsed[2])
    const salt = parsed[3].slice(0, 22)
    if (cost < 4 || cost > 31) {
      throw new Error(`bcrypt hash has an out-of-range cost factor: ${parsed[2]}`)
    }
    // $2x$ marks hashes made by the buggy crypt_blowfish that sign-extended
    // 8-bit characters. We implement correct bcrypt, so for any password with
    // non-ASCII bytes we would confidently return the wrong answer.
    if (algorithm === '2x') {
      throw new Error(
        '$2x$ hashes come from the buggy crypt_blowfish implementation and cannot be checked correctly here; use a $2a$, $2b$, or $2y$ hash'
      )
    }

    if (password === '') {
      return { match: false, algorithm, cost, salt, reason: 'input (the password) is empty' }
    }

    // bcrypt stops at the first NUL byte, so without this guard every password
    // sharing a prefix with the real one up to a NUL would report match: true.
    if (password.includes('\0')) {
      throw new Error(
        'bcrypt stops at the first NUL (U+0000) character, so this password cannot be checked without silently discarding everything after it — remove the NUL first'
      )
    }

    const passwordBytes = new TextEncoder().encode(password)
    if (passwordBytes.length > 72) {
      throw new Error(
        `bcrypt hashes at most 72 bytes of password; this input is ${passwordBytes.length} bytes`
      )
    }

    const { bcryptVerify } = await getHashWasm()
    const match = await bcryptVerify({ password: passwordBytes, hash: encoded })

    return {
      match,
      algorithm,
      cost,
      salt,
      reason: match ? '' : 'password does not match this hash'
    }
  }
}

export default util
