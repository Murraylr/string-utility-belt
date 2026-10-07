// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { publishToChromeWebStore, type ChromeWebStoreOptions } from './chrome-web-store'
import type { Fetch } from './http'

const ITEM = 'https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext'
const UPLOAD = 'https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/ext:upload'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

interface Store {
  published?: string[]
  submitted?: { state: string; versions: string[] }
  upload?: { uploadState: string; crxVersion?: string }
  asyncStates?: string[]
  publishState?: string
  takenDown?: boolean
}

/** A fake Chrome Web Store V2 API that records the calls it receives. */
function fakeStore(store: Store) {
  const calls: string[] = []
  const fetch = vi.fn<Fetch>(async (url, init) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token')
    if (url === `${ITEM}:fetchStatus`) {
      return json({
        takenDown: store.takenDown ?? false,
        lastAsyncUploadState: store.asyncStates?.shift(),
        publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: (store.published ?? []).map(v => ({ crxVersion: v, deployPercentage: 100 })) },
        ...(store.submitted && {
          submittedItemRevisionStatus: { state: store.submitted.state, distributionChannels: store.submitted.versions.map(v => ({ crxVersion: v })) },
        }),
      })
    }
    if (url === `${ITEM}:cancelSubmission`) return json({})
    if (url === UPLOAD) {
      expect(init?.body).toBeInstanceOf(Uint8Array)
      return json(store.upload ?? { uploadState: 'SUCCEEDED', crxVersion: '1.4.1' })
    }
    if (url === `${ITEM}:publish`) {
      expect(JSON.parse(String(init?.body))).toEqual({ publishType: 'DEFAULT_PUBLISH' })
      return json({ state: store.publishState ?? 'PENDING_REVIEW' })
    }
    return json({ error: 'unexpected' }, 400)
  })
  return { fetch, calls }
}

const options = (fetch: Fetch, extra: Partial<ChromeWebStoreOptions> = {}): ChromeWebStoreOptions => ({
  publisherId: 'pub', itemId: 'ext', accessToken: 'token', zip: new Uint8Array([80, 75]), version: '1.4.1',
  fetch, sleep: async () => {}, ...extra,
})

describe('publishToChromeWebStore', () => {
  it('uploads the package and submits it for review', async () => {
    const { fetch, calls } = fakeStore({ published: ['1.4.0'] })
    expect(await publishToChromeWebStore(options(fetch))).toBe('submitted')
    expect(calls).toEqual([`GET ${ITEM}:fetchStatus`, `POST ${UPLOAD}`, `POST ${ITEM}:publish`])
  })

  it('leaves a version that is already published or in review alone', async () => {
    const published = fakeStore({ published: ['1.4.1'] })
    expect(await publishToChromeWebStore(options(published.fetch))).toBe('already-published')
    expect(published.calls).toHaveLength(1)

    const inReview = fakeStore({ published: ['1.4.0'], submitted: { state: 'PENDING_REVIEW', versions: ['1.4.1'] } })
    expect(await publishToChromeWebStore(options(inReview.fetch))).toBe('already-in-review')
    expect(inReview.calls).toHaveLength(1)
  })

  it('cancels a pending submission of an older version before submitting the new one', async () => {
    const { fetch, calls } = fakeStore({ published: ['1.4.0'], submitted: { state: 'PENDING_REVIEW', versions: ['1.4.0'] } })
    const log = vi.fn()
    expect(await publishToChromeWebStore(options(fetch, { log }))).toBe('submitted')
    expect(calls).toEqual([`GET ${ITEM}:fetchStatus`, `POST ${ITEM}:cancelSubmission`, `POST ${UPLOAD}`, `POST ${ITEM}:publish`])
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/cancelling the pending submission of 1\.4\.0/))
  })

  it('does not cancel a rejected or cancelled submission (nothing is pending)', async () => {
    const { fetch, calls } = fakeStore({ published: ['1.4.0'], submitted: { state: 'REJECTED', versions: ['1.4.1'] } })
    expect(await publishToChromeWebStore(options(fetch))).toBe('submitted')
    expect(calls).not.toContain(`POST ${ITEM}:cancelSubmission`)
  })

  it('waits for an asynchronous upload to finish processing', async () => {
    const { fetch, calls } = fakeStore({ upload: { uploadState: 'IN_PROGRESS' }, asyncStates: [undefined as unknown as string, 'IN_PROGRESS', 'SUCCEEDED'] })
    expect(await publishToChromeWebStore(options(fetch))).toBe('submitted')
    expect(calls.filter(c => c.endsWith(':fetchStatus'))).toHaveLength(3)
  })

  it('fails loudly instead of publishing something unexpected', async () => {
    await expect(publishToChromeWebStore(options(fakeStore({ published: ['1.5.0'] }).fetch)))
      .rejects.toThrow(/already publishes 1\.5\.0, newer than 1\.4\.1/)
    await expect(publishToChromeWebStore(options(fakeStore({ upload: { uploadState: 'FAILED' } }).fetch)))
      .rejects.toThrow(/upload ended in state FAILED/)
    await expect(publishToChromeWebStore(options(fakeStore({ upload: { uploadState: 'SUCCEEDED', crxVersion: '1.4.0' } }).fetch)))
      .rejects.toThrow(/package is version 1\.4\.0, expected 1\.4\.1/)
    await expect(publishToChromeWebStore(options(fakeStore({ publishState: 'REJECTED' }).fetch)))
      .rejects.toThrow(/publish answered state REJECTED/)
    await expect(publishToChromeWebStore(options(fakeStore({ takenDown: true }).fetch)))
      .rejects.toThrow(/taken down/)
  })

  it('gives up on an upload that never finishes processing', async () => {
    const { fetch } = fakeStore({ upload: { uploadState: 'IN_PROGRESS' }, asyncStates: Array(100).fill('IN_PROGRESS') })
    await expect(publishToChromeWebStore(options(fetch, { uploadTimeoutMs: -1 }))).rejects.toThrow(/still processing/)
  })

  it('surfaces API errors with their body', async () => {
    const fetch = vi.fn<Fetch>(async () => json({ error: { message: 'The caller does not have permission' } }, 403))
    await expect(publishToChromeWebStore(options(fetch))).rejects.toThrow(/fetchStatus: HTTP 403 — .*does not have permission/)
  })
})
