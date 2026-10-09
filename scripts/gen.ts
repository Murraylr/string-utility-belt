/** Entry point for `npm run gen` — see gen-utilities.ts, then gen-presets.ts (which reads the utility manifest). */
import { generate as generateUtilities } from './gen-utilities'

async function main() {
  const utilities = await generateUtilities()
  console.log(`[gen] ${utilities.count} utilities; ${utilities.written.length ? 'updated ' + utilities.written.join(', ') : 'up to date'}`)
  // imported after the utility manifest is written: the preset generator reads it at import time
  const { generate: generatePresets } = await import('./gen-presets')
  const presets = await generatePresets()
  console.log(`[gen] ${presets.count} presets; ${presets.written.length ? 'updated ' + presets.written.join(', ') : 'up to date'}`)
}

main().catch(e => { console.error(`[gen] ${e?.message ?? e}`); process.exit(1) })
