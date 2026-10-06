/** Entry point for `npm run gen` — see gen-utilities.ts and seo/lastmod.ts. */
import { discover, generate } from './gen-utilities'
import { hashPages, pageSources, writeContentDates, LASTMOD_FILE } from './seo/lastmod'
import { SITE_PAGES } from '../src/lib/router'

async function main(): Promise<string> {
  const { count, written } = await generate()
  const root = process.cwd()
  const hashes = hashPages(root, pageSources(root, discover().map(d => d.dir), SITE_PAGES))
  if (writeContentDates(root, hashes, new Date().toISOString().slice(0, 10))) written.push(LASTMOD_FILE)
  return `[gen] ${count} utilities; ${written.length ? 'updated ' + written.join(', ') : 'up to date'}`
}

main().then(
  message => console.log(message),
  e => { console.error(`[gen] ${e?.message ?? e}`); process.exit(1) },
)
