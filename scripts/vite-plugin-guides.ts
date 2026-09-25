import type { Plugin } from 'vite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Serves each utility's guide (`src/utilities/<id>/guide.md`, see
 * `src/app/pages/guide.ts`) at `/guides/<id>.md`: read from disk per request
 * by the dev server (so edits show on reload), emitted as static assets by
 * `vite build`. Plain files rather than JS chunks — only the doc page being
 * viewed fetches its own guide, and the ~250 of them stay out of the JS bundle
 * budget and the service worker's precache.
 */

const GUIDE_URL = /^\/guides\/([a-z0-9_]+)\.md(?:[?#].*)?$/

/** `/guides/<id>.md` → `<id>` (only ids that are safe as a path segment). */
export function guideIdFromUrl(url: string): string | null {
  return GUIDE_URL.exec(url)?.[1] ?? null
}

/** Every `<id>` with a `src/utilities/<id>/guide.md`, sorted. */
export function listGuides(utilitiesDir: string): string[] {
  if (!existsSync(utilitiesDir)) return []
  return readdirSync(utilitiesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && existsSync(path.join(utilitiesDir, d.name, 'guide.md')))
    .map(d => d.name)
    .sort()
}

export function utilityGuides(): Plugin {
  let utilitiesDir = ''
  let base = '/'
  let ssr = false
  return {
    name: 'utility-guides',
    configResolved(config) {
      utilitiesDir = path.join(config.root, 'src', 'utilities')
      base = config.base || '/'
      ssr = !!config.build.ssr
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        const id = url.startsWith(base) ? guideIdFromUrl(`/${url.slice(base.length)}`) : null
        const file = id && path.join(utilitiesDir, id, 'guide.md')
        if (!file || !existsSync(file)) return next()
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(file))
      })
    },
    generateBundle() {
      if (ssr) return
      for (const id of listGuides(utilitiesDir)) {
        this.emitFile({ type: 'asset', fileName: `guides/${id}.md`, source: readFileSync(path.join(utilitiesDir, id, 'guide.md')) })
      }
    },
  }
}
