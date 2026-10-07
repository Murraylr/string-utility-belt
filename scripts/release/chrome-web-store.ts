import { compareVersions, isVersion } from './semver'
import { ensureOk, request, sleep as defaultSleep, type Fetch } from './http'

/**
 * Publishing to the Chrome Web Store through its V2 API
 * (`chromewebstore.googleapis.com`, service-account friendly): upload the
 * package, then submit it for review with automatic publishing afterwards.
 *
 * Idempotent: a version that is already published or in review is left alone,
 * so re-running a release never uploads twice. A pending submission of an
 * *older* version is cancelled first — the store accepts one submission at a
 * time, and the newest main is what should be reviewed.
 */

export const CWS_API = 'https://chromewebstore.googleapis.com'

export interface ChromeWebStoreOptions {
  publisherId: string
  itemId: string
  /** OAuth access token with the `https://www.googleapis.com/auth/chromewebstore` scope. */
  accessToken: string
  /** The zipped extension (manifest.json at the root). */
  zip: Uint8Array<ArrayBuffer>
  /** The version inside `zip`. */
  version: string
  fetch?: Fetch
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
  /** How long to wait for an asynchronous upload to finish processing. */
  uploadTimeoutMs?: number
}

export type ChromeWebStoreResult = 'submitted' | 'already-published' | 'already-in-review'

interface DistributionChannel { crxVersion?: string; deployPercentage?: number }
interface ItemRevisionStatus { state?: string; distributionChannels?: DistributionChannel[] }
interface ItemStatus {
  lastAsyncUploadState?: string
  publishedItemRevisionStatus?: ItemRevisionStatus
  submittedItemRevisionStatus?: ItemRevisionStatus
  takenDown?: boolean
}

/** Submission states that mean "this revision is with the review team or waiting to go live". */
const IN_REVIEW = new Set(['PENDING_REVIEW', 'STAGED'])
const ACCEPTED_PUBLISH_STATES = new Set(['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'])

export async function publishToChromeWebStore(opts: ChromeWebStoreOptions): Promise<ChromeWebStoreResult> {
  const log = opts.log ?? (() => {})
  const wait = opts.sleep ?? defaultSleep
  const item = `publishers/${encodeURIComponent(opts.publisherId)}/items/${encodeURIComponent(opts.itemId)}`
  const auth = { authorization: `Bearer ${opts.accessToken}` }
  // reads and the (replaceable) draft upload retry; cancel and publish change review state, so they don't
  const call = (url: string, init: RequestInit = {}, retries = 3) =>
    request(url, { ...init, headers: { ...auth, ...(init.headers as Record<string, string> | undefined) } }, { fetch: opts.fetch, sleep: opts.sleep, retries })

  const fetchStatus = async (): Promise<ItemStatus> =>
    (await ensureOk(await call(`${CWS_API}/v2/${item}:fetchStatus`), 'Chrome Web Store fetchStatus')).json()

  const status = await fetchStatus()
  if (status.takenDown) throw new Error(`Chrome Web Store item ${opts.itemId} is taken down; resolve that in the dashboard first`)

  const published = versionsOf(status.publishedItemRevisionStatus)
  if (published.includes(opts.version)) {
    log(`${opts.version} is already published`)
    return 'already-published'
  }
  // the store allows four-part versions; only ones in this repo's major.minor.patch form are compared
  const ahead = published.find(v => isVersion(v) && compareVersions(v, opts.version) > 0)
  if (ahead) throw new Error(`the Chrome Web Store already publishes ${ahead}, newer than ${opts.version}`)

  const submitted = status.submittedItemRevisionStatus
  if (submitted?.state && IN_REVIEW.has(submitted.state)) {
    const pending = versionsOf(submitted)
    if (pending.includes(opts.version)) {
      log(`${opts.version} is already submitted (${submitted.state})`)
      return 'already-in-review'
    }
    log(`cancelling the pending submission of ${pending.join(', ') || 'an earlier version'} (${submitted.state}) so ${opts.version} replaces it`)
    await ensureOk(await call(`${CWS_API}/v2/${item}:cancelSubmission`, { method: 'POST' }, 0), 'Chrome Web Store cancelSubmission')
  }

  const upload = await (await ensureOk(await call(`${CWS_API}/upload/v2/${item}:upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/zip' },
    body: opts.zip,
  }), 'Chrome Web Store upload')).json() as { uploadState?: string; crxVersion?: string }

  let uploadState = upload.uploadState
  const deadline = Date.now() + (opts.uploadTimeoutMs ?? 5 * 60_000)
  while (uploadState === 'IN_PROGRESS') {
    if (Date.now() > deadline) throw new Error('the Chrome Web Store upload is still processing; re-run the job to retry')
    await wait(5000)
    uploadState = (await fetchStatus()).lastAsyncUploadState
  }
  if (uploadState !== 'SUCCEEDED') throw new Error(`Chrome Web Store upload ended in state ${uploadState ?? '(none)'}`)
  if (upload.crxVersion && upload.crxVersion !== opts.version) {
    throw new Error(`the uploaded package is version ${upload.crxVersion}, expected ${opts.version}`)
  }
  log(`uploaded ${opts.version}`)

  const publish = await (await ensureOk(await call(`${CWS_API}/v2/${item}:publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  }, 0), 'Chrome Web Store publish')).json() as { state?: string }
  if (!publish.state || !ACCEPTED_PUBLISH_STATES.has(publish.state)) {
    throw new Error(`Chrome Web Store publish answered state ${publish.state ?? '(none)'}`)
  }
  log(`submitted ${opts.version} (${publish.state})`)
  return 'submitted'
}

function versionsOf(status: ItemRevisionStatus | undefined): string[] {
  return (status?.distributionChannels ?? [])
    .map(c => c.crxVersion)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
}
