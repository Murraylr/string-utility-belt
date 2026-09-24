import type { Utility } from '@/types/utility'

/**
 * Parse a `curl` command line into structured JSON.
 *
 * The tokenizer understands POSIX single/double quoting, `$'...'` ANSI-C
 * quoting (what Chrome's "copy as cURL" emits for binary-ish bodies), backslash
 * escapes, and `\`, `^` or backtick line continuations, so pastes from bash,
 * cmd.exe and PowerShell all work.
 */

type Named = { name: string; value?: string }

/* ------------------------------------------------------------------ shell */

const isBreakAt = (s: string, i: number) => s[i] === '\n' || (s[i] === '\r' && s[i + 1] === '\n')
const breakLen = (s: string, i: number) => (s[i] === '\r' ? 2 : 1)

function readAnsiC(src: string, start: number): { text: string; next: number } {
  let out = ''
  let i = start
  while (i < src.length) {
    const c = src[i]
    if (c === "'") return { text: out, next: i + 1 }
    if (c !== '\\') { out += c; i += 1; continue }
    const n = src[i + 1]
    i += 2
    switch (n) {
      case 'n': out += '\n'; break
      case 't': out += '\t'; break
      case 'r': out += '\r'; break
      case 'a': out += '\x07'; break
      case 'b': out += '\b'; break
      case 'f': out += '\f'; break
      case 'v': out += '\v'; break
      case 'e': out += '\x1b'; break
      // bash \nnn is octal, 1-3 digits ("\0" is just its shortest form)
      case '0': case '1': case '2': case '3':
      case '4': case '5': case '6': case '7': {
        const more = /^[0-7]{0,2}/.exec(src.slice(i))?.[0] ?? ''
        out += String.fromCharCode(parseInt(n + more, 8) & 0xff)
        i += more.length
        break
      }
      case '\\': out += '\\'; break
      case "'": out += "'"; break
      case '"': out += '"'; break
      case 'x':
      case 'u':
      case 'U': {
        const rest = src.slice(i)
        const braced = /^\{([0-9a-fA-F]{1,6})\}/.exec(rest)
        if (braced) {
          out += String.fromCodePoint(parseInt(braced[1], 16))
          i += braced[0].length
          break
        }
        const width = n === 'x' ? 2 : n === 'u' ? 4 : 8
        const m = new RegExp(`^[0-9a-fA-F]{1,${width}}`).exec(rest)
        if (m) {
          out += String.fromCodePoint(parseInt(m[0], 16))
          i += m[0].length
        } else {
          out += n
        }
        break
      }
      default:
        out += n === undefined ? '\\' : '\\' + n
    }
  }
  throw new Error("unterminated $'...' quote in curl command")
}

function readDoubleQuoted(src: string, start: number): { text: string; next: number } {
  let out = ''
  let i = start
  while (i < src.length) {
    const c = src[i]
    if (c === '"') return { text: out, next: i + 1 }
    if (c === '\\') {
      const n = src[i + 1]
      if (n === undefined) { out += '\\'; i += 1; continue }
      if (isBreakAt(src, i + 1)) { i += 1 + breakLen(src, i + 1); continue }
      if (n === '"' || n === '\\' || n === '$' || n === '`') { out += n; i += 2; continue }
      out += '\\' + n
      i += 2
      continue
    }
    if (c === '`') {
      // PowerShell escape / continuation inside a double-quoted string
      if (isBreakAt(src, i + 1)) { i += 1 + breakLen(src, i + 1); continue }
      const n = src[i + 1]
      if (n === '"' || n === '`' || n === '$') { out += n; i += 2; continue }
      out += c
      i += 1
      continue
    }
    out += c
    i += 1
  }
  throw new Error('unterminated double quote in curl command')
}

/** Split a command line into argv, honouring quotes, escapes and continuations. */
export function tokenizeShell(src: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let started = false
  let i = 0
  const flush = () => { if (started) { tokens.push(cur); cur = ''; started = false } }

  while (i < src.length) {
    const c = src[i]

    if ((c === '\\' || c === '^' || c === '`') && isBreakAt(src, i + 1)) {
      i += 1 + breakLen(src, i + 1)
      continue
    }
    if (c === '\\') {
      const n = src[i + 1]
      if (n === undefined) { cur += '\\'; started = true; i += 1; continue }
      cur += n
      started = true
      i += 2
      continue
    }
    if (c === '$' && src[i + 1] === "'") {
      const r = readAnsiC(src, i + 2)
      cur += r.text
      started = true
      i = r.next
      continue
    }
    if (c === "'") {
      const end = src.indexOf("'", i + 1)
      if (end === -1) throw new Error('unterminated single quote in curl command')
      cur += src.slice(i + 1, end)
      started = true
      i = end + 1
      continue
    }
    if (c === '"') {
      const r = readDoubleQuoted(src, i + 1)
      cur += r.text
      started = true
      i = r.next
      continue
    }
    if (/\s/.test(c)) { flush(); i += 1; continue }

    cur += c
    started = true
    i += 1
  }
  flush()
  return tokens
}

/* ------------------------------------------------------------------ flags */

const LONG_VALUE = new Set([
  'request', 'header', 'data', 'data-raw', 'data-ascii', 'data-binary', 'data-urlencode',
  'form', 'form-string', 'user', 'url', 'cookie', 'cookie-jar', 'user-agent', 'referer',
  'output', 'upload-file', 'proxy', 'proxy-user', 'max-time', 'connect-timeout', 'write-out',
  'dump-header', 'cacert', 'cert', 'key', 'resolve', 'retry', 'oauth2-bearer', 'range',
  'interface', 'limit-rate', 'max-redirs', 'trace', 'trace-ascii', 'config', 'continue-at',
  'time-cond', 'aws-sigv4', 'json'
])

const LONG_BOOL = new Set([
  'compressed', 'insecure', 'location', 'location-trusted', 'get', 'head', 'silent',
  'show-error', 'verbose', 'include', 'fail', 'fail-with-body', 'globoff', 'no-buffer',
  'remote-name', 'remote-header-name', 'remote-time', 'netrc', 'ipv4', 'ipv6', 'http1.0',
  'http1.1', 'http2', 'http2-prior-knowledge', 'http3', 'path-as-is', 'raw', 'tcp-nodelay',
  'anyauth', 'basic', 'digest', 'ntlm', 'negotiate', 'no-keepalive', 'junk-session-cookies',
  'create-dirs', 'tlsv1.2', 'tlsv1.3', 'list-only', 'append', 'progress-bar',
  'no-progress-meter', 'next'
])

const SHORT_VALUE: Record<string, string> = {
  X: 'request', H: 'header', d: 'data', F: 'form', u: 'user', b: 'cookie', c: 'cookie-jar',
  A: 'user-agent', e: 'referer', o: 'output', x: 'proxy', m: 'max-time', T: 'upload-file',
  D: 'dump-header', w: 'write-out', K: 'config', E: 'cert', r: 'range', C: 'continue-at',
  z: 'time-cond', y: 'speed-time', Y: 'speed-limit'
}

const SHORT_BOOL: Record<string, string> = {
  k: 'insecure', L: 'location', G: 'get', s: 'silent', S: 'show-error', v: 'verbose',
  i: 'include', I: 'head', f: 'fail', g: 'globoff', N: 'no-buffer', O: 'remote-name',
  J: 'remote-header-name', R: 'remote-time', n: 'netrc', '4': 'ipv4', '6': 'ipv6',
  '#': 'progress-bar', j: 'junk-session-cookies', a: 'append', l: 'list-only'
}

const DATA_FLAGS = new Set(['data', 'data-raw', 'data-ascii', 'data-binary', 'data-urlencode', 'json'])
const CORE_FLAGS = ['compressed', 'insecure', 'location', 'get'] as const

/** RFC 7230 token, plus a leading ':' for HTTP/2 pseudo-headers (:authority, …). */
const HEADER_NAME_RE = /^:?[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/**
 * curl_easy_escape leaves only the RFC 3986 unreserved set (A-Za-z0-9-._~)
 * alone; encodeURIComponent additionally spares !'()* , so escape those too.
 */
const escapeLikeCurl = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

function urlencodeData(part: string): string {
  // curl --data-urlencode: "content" | "=content" | "name=content"
  if (part.startsWith('=')) return escapeLikeCurl(part.slice(1))
  const eq = part.indexOf('=')
  if (eq > 0) return `${part.slice(0, eq)}=${escapeLikeCurl(part.slice(eq + 1))}`
  return escapeLikeCurl(part)
}

/**
 * Unknown flags that take a value leave that value in the positional list, so
 * "the first positional is the URL" picks up junk (`--max-filesize 1000 URL`
 * yielded url "1000"). Prefer the first positional that is shaped like a URL.
 */
const looksLikeUrl = (t: string) =>
  /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(t) ||
  /^(?:localhost|\[[0-9A-Fa-f:.]+\])(?::[0-9]+)?(?:[/?#]|$)/i.test(t) ||
  /^[^\s/?#@:]+\.[^\s/?#@:]+/.test(t)

function splitArgs(tokens: string[]): { named: Named[]; positional: string[] } {
  const named: Named[] = []
  const positional: string[] = []
  let onlyPositional = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (onlyPositional) { positional.push(token); continue }
    if (token === '--') { onlyPositional = true; continue }

    if (token.startsWith('--') && token.length > 2) {
      const body = token.slice(2)
      const eq = body.indexOf('=')
      const name = eq >= 0 ? body.slice(0, eq) : body
      const inline = eq >= 0 ? body.slice(eq + 1) : undefined

      if (LONG_VALUE.has(name)) {
        const value = inline !== undefined ? inline : tokens[++i]
        if (value === undefined) throw new Error(`curl flag --${name} requires a value`)
        named.push({ name, value })
      } else if (LONG_BOOL.has(name)) {
        named.push({ name })
      } else {
        named.push(inline !== undefined ? { name, value: inline } : { name })
      }
      continue
    }

    if (token.startsWith('-') && token.length > 1) {
      const chars = Array.from(token.slice(1))
      for (let c = 0; c < chars.length; c++) {
        const ch = chars[c]
        if (SHORT_VALUE[ch]) {
          const rest = chars.slice(c + 1).join('')
          const value = rest !== '' ? rest : tokens[++i]
          if (value === undefined) throw new Error(`curl flag -${ch} requires a value`)
          named.push({ name: SHORT_VALUE[ch], value })
          break
        }
        if (SHORT_BOOL[ch]) { named.push({ name: SHORT_BOOL[ch] }); continue }
        // unknown short flag: ignored rather than mistaken for the URL
      }
      continue
    }

    positional.push(token)
  }

  return { named, positional }
}

const util: Utility = {
  id: 'curl_parse',
  name: 'curl command to json',
  category: 'Web & Dev',
  description:
    'Parse a curl command into JSON — method, url, headers, body, auth, form fields and flags — handling shell quoting and line continuations.',
  accepts: 'string',
  produces: 'json',
  tags: ['curl', 'parse command', 'http request', 'shell', 'postman import', 'json'],
  examples: [
    {
      title: 'POST with a JSON body',
      input: 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Ada"}\'',
      output:
        '{\n  "method": "POST",\n  "url": "https://api.example.com/users",\n  "headers": {\n    "Content-Type": "application/json"\n  },\n  "body": "{\\"name\\":\\"Ada\\"}",\n  "auth": null,\n  "flags": {\n    "compressed": false,\n    "insecure": false,\n    "location": false,\n    "get": false\n  }\n}'
    }
  ],
  params: {},
  apply: (input: any) => {
    const raw = String(input ?? '')

    const empty = (): Record<string, unknown> => ({
      method: 'GET',
      url: '',
      headers: {},
      body: '',
      auth: null,
      flags: { compressed: false, insecure: false, location: false, get: false }
    })

    if (!raw.trim()) return empty()

    const tokens = tokenizeShell(raw)

    // tolerate a shell prompt (`$ curl ...`) and env prefixes (`FOO=bar curl ...`)
    let cmdIndex = 0
    while (
      cmdIndex < tokens.length &&
      (/^[$#>]$/.test(tokens[cmdIndex]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[cmdIndex]))
    ) cmdIndex++
    if (!/^(?:.*[/\\])?curl(?:\.exe)?$/i.test(tokens[cmdIndex] ?? '')) {
      throw new Error("not a curl command: expected it to start with 'curl'")
    }
    cmdIndex += 1

    const { named, positional } = splitArgs(tokens.slice(cmdIndex))

    const headerOrder: string[] = []
    const headerMap = new Map<string, { display: string; values: string[] }>()
    const addHeader = (name: string, value: string, replace = false) => {
      const key = name.toLowerCase()
      const bucket = headerMap.get(key)
      if (!bucket) {
        headerMap.set(key, { display: name, values: [value] })
        headerOrder.push(key)
      } else if (replace) {
        bucket.values = [value]
      } else {
        bucket.values.push(value)
      }
    }

    const dataParts: string[] = []
    const form: Array<Record<string, unknown>> = []
    const flags: Record<string, unknown> = {
      compressed: false, insecure: false, location: false, get: false
    }
    let method = ''
    let url = ''
    let auth: Record<string, unknown> | null = null
    let sawUpload = false
    let sawHead = false

    for (const { name, value } of named) {
      if (DATA_FLAGS.has(name)) {
        const v = value ?? ''
        if (name === 'data-urlencode') dataParts.push(urlencodeData(v))
        else dataParts.push(v)
        if (name === 'json') {
          addHeader('Content-Type', 'application/json', true)
          addHeader('Accept', 'application/json', true)
        }
        continue
      }

      switch (name) {
        case 'request':
          method = (value ?? '').trim()
          break
        case 'header': {
          const h = (value ?? '').trim()
          if (!h) break
          // a pseudo-header owns its leading colon; the separator comes after it
          const colon = h.indexOf(':', h.startsWith(':') ? 1 : 0)
          let hName: string
          let hValue: string
          if (colon >= 0) {
            hName = h.slice(0, colon).trim()
            hValue = h.slice(colon + 1).trim()
          } else if (h.endsWith(';')) {
            hName = h.slice(0, -1).trim()
            hValue = ''
          } else {
            throw new Error(`malformed -H header (expected "Name: value"): ${h}`)
          }
          if (!HEADER_NAME_RE.test(hName)) throw new Error(`invalid header name in -H: "${hName}"`)
          addHeader(hName, hValue)
          break
        }
        case 'form':
        case 'form-string': {
          const f = value ?? ''
          const eq = f.indexOf('=')
          const fname = eq >= 0 ? f.slice(0, eq) : f
          const fvalue = eq >= 0 ? f.slice(eq + 1) : ''
          form.push({
            name: fname,
            value: fvalue,
            type: name === 'form' && /^[@<]/.test(fvalue) ? 'file' : 'text'
          })
          break
        }
        case 'user': {
          const u = value ?? ''
          const colon = u.indexOf(':')
          auth = colon >= 0
            ? { user: u.slice(0, colon), password: u.slice(colon + 1) }
            : { user: u, password: '' }
          break
        }
        case 'oauth2-bearer':
          addHeader('Authorization', `Bearer ${value ?? ''}`, true)
          break
        case 'url':
          url = value ?? ''
          break
        case 'cookie': {
          const c = value ?? ''
          if (c.includes('=')) addHeader('Cookie', c)
          else flags['cookie-file'] = c
          break
        }
        case 'user-agent':
          addHeader('User-Agent', value ?? '', true)
          break
        case 'referer':
          addHeader('Referer', value ?? '', true)
          break
        case 'head':
          sawHead = true
          flags.head = true
          break
        case 'upload-file':
          sawUpload = true
          flags['upload-file'] = value ?? ''
          break
        case 'compressed':
        case 'insecure':
        case 'location':
        case 'get':
          flags[name] = true
          break
        default:
          flags[name] = value === undefined ? true : value
      }
    }

    if (!url && positional.length > 0) url = positional.find(looksLikeUrl) ?? positional[0]

    const body = dataParts.join('&')

    if (!method) {
      if (sawHead) method = 'HEAD'
      else if (sawUpload) method = 'PUT'
      else if ((dataParts.length > 0 || form.length > 0) && !flags.get) method = 'POST'
      else method = 'GET'
    }
    method = method.toUpperCase()

    const headers: Record<string, string | string[]> = {}
    for (const key of headerOrder) {
      const bucket = headerMap.get(key)
      if (!bucket) continue
      headers[bucket.display] = bucket.values.length === 1 ? bucket.values[0] : bucket.values
    }

    // keep the four documented flags first and always present
    const orderedFlags: Record<string, unknown> = {}
    for (const key of CORE_FLAGS) orderedFlags[key] = flags[key] === true
    for (const [key, value] of Object.entries(flags)) {
      if (!(CORE_FLAGS as readonly string[]).includes(key)) orderedFlags[key] = value
    }

    const result: Record<string, unknown> = { method, url, headers, body, auth, flags: orderedFlags }
    if (form.length > 0) result.form = form
    return result
  }
}

export default util
