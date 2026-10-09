/**
 * The Cloudflare runtime types the worker code names, declared against the DOM lib
 * (see tsconfig.worker.json for why the generated worker-configuration.d.ts is not
 * part of this program). Shapes match @cloudflare/workers-types.
 */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

interface AnalyticsEngineDataPoint {
  indexes?: ((ArrayBuffer | string) | null)[]
  doubles?: number[]
  blobs?: ((ArrayBuffer | string) | null)[]
}

interface AnalyticsEngineDataset {
  writeDataPoint(event?: AnalyticsEngineDataPoint): void
}

interface ExportedHandler<Env = unknown> {
  fetch?(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
}
