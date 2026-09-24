/** Entry point for `npm run gen` — see gen-utilities.ts. */
import { generate } from './gen-utilities'

generate().then(
  ({ count, written }) => {
    console.log(`[gen] ${count} utilities; ${written.length ? 'updated ' + written.join(', ') : 'up to date'}`)
  },
  e => { console.error(`[gen] ${e?.message ?? e}`); process.exit(1) },
)
