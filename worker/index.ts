import { createApi } from './api'
import type { ApiEnv } from './env'

const api = createApi()

/** Cloudflare Worker entry: the HTTP API, falling back to the static SPA. Routes: ./api.ts */
export default {
  fetch: (request, env, ctx) => api.fetch(request, env, ctx),
} satisfies ExportedHandler<ApiEnv>
