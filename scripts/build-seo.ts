/**
 * Post-build SEO pass — run after `vite build` (see `npm run build:seo`).
 *
 * Reads the built site (`--outDir <dir>` / `--outDir=<dir>` or `SEO_OUT_DIR`,
 * default `dist`) and writes pre-rendered pages, `sitemap.xml`, `rss.xml` and
 * Open Graph images into it — see `scripts/seo/build.ts`. `--no-og` skips the
 * (slow) image rendering.
 *
 * Run with vite-node so the `@/`-aliased generated manifest/examples and the
 * markdown renderer resolve exactly as they do in the app:
 *
 *   vite-node scripts/build-seo.ts [--outDir <dir>] [--no-og]
 */
import path from 'node:path'
import { buildSeo } from './seo/build'

/** `--outDir <dir>`, `--outDir=<dir>`, then `SEO_OUT_DIR`, then `dist`; resolved against `root`. */
export function resolveOutDir(argv: string[], env: Record<string, string | undefined>, root: string): string {
  let dir: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--outDir') dir = argv[i + 1]
    else if (argv[i].startsWith('--outDir=')) dir = argv[i].slice('--outDir='.length)
  }
  const chosen = dir || env.SEO_OUT_DIR || 'dist'
  return path.isAbsolute(chosen) ? chosen : path.join(root, chosen)
}

async function main() {
  const root = process.cwd()
  const argv = process.argv.slice(2)
  const outDir = resolveOutDir(argv, process.env, root)
  const result = await buildSeo({ outDir, root, og: !argv.includes('--no-og') })
  console.log(`[build-seo] ${result.pages} pages written in ${result.htmlMs}ms`)
  console.log(`[build-seo] ${result.ogImages} OG images rendered in ${result.ogMs}ms`)
  console.log(`[build-seo] sitemap.xml: ${result.sitemapUrls} urls; rss.xml: ${result.rssItems} items`)
  console.log(`[build-seo] outDir: ${outDir}`)
}

// only when executed as the script, not when a test imports `resolveOutDir`
if (!process.env.VITEST) {
  main().catch(e => {
    console.error(`[build-seo] ${e?.stack ?? e}`)
    process.exit(1)
  })
}
