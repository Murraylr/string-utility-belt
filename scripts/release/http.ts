export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export interface RequestOptions {
  fetch?: Fetch
  /** Attempts after the first for network errors, 429 and 5xx answers. */
  retries?: number
  sleep?: (ms: number) => Promise<void>
}

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * `fetch` that retries what is worth retrying (network failures, 429, 5xx) with
 * exponential backoff, and hands every other answer — including 4xx — back to
 * the caller to interpret.
 */
export async function request(url: string, init: RequestInit = {}, opts: RequestOptions = {}): Promise<Response> {
  const doFetch = opts.fetch ?? fetch
  const wait = opts.sleep ?? sleep
  const retries = opts.retries ?? 3
  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined
    let failure: unknown
    try {
      res = await doFetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(60_000) })
    } catch (err) {
      failure = err
    }
    const retryable = !res || res.status === 429 || res.status >= 500
    if (!retryable) return res!
    if (attempt >= retries) {
      if (res) return res
      throw new Error(`${init.method ?? 'GET'} ${url} failed: ${failure instanceof Error ? failure.message : String(failure)}`)
    }
    await wait(1000 * 2 ** attempt)
  }
}

export interface PollOptions {
  timeoutMs: number
  intervalMs: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/**
 * Calls `check` (with the time elapsed so far) every `intervalMs` until it returns true or
 * `timeoutMs` has passed; whether it ever did.
 */
export async function poll(check: (elapsedMs: number) => Promise<boolean>, opts: PollOptions): Promise<boolean> {
  const now = opts.now ?? Date.now
  const wait = opts.sleep ?? sleep
  const start = now()
  for (;;) {
    if (await check(now() - start)) return true
    if (now() - start + opts.intervalMs > opts.timeoutMs) return false
    await wait(opts.intervalMs)
  }
}

/** Throws with the response body when `res` is not 2xx. */
export async function ensureOk(res: Response, what: string): Promise<Response> {
  if (res.ok) return res
  const body = await res.text().catch(() => '')
  throw new Error(`${what}: HTTP ${res.status}${body ? ` — ${body.slice(0, 500)}` : ''}`)
}
