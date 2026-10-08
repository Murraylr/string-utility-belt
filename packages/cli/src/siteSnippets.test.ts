// @vitest-environment node
/**
 * The website's utility pages print `npx subelt …` commands (`src/app/integrations/snippets.ts`).
 * Every one of them must parse here exactly as the site meant it, and reproduce the utility's
 * own golden examples when run.
 */
import { describe, expect, it } from 'vitest'
import { resolveParams } from '../../../src/core/params'
import { EXAMPLES } from '../../../src/utilities/_generated/examples'
import { staticRegistry } from '../../../src/utilities/static-registry'
import { cliCommand, cliStep, runsOffBrowser } from '../../../src/app/integrations/snippets'
import type { Params } from '../../../src/types/utility'
import type { CliIo } from './args'
import { parseArgv } from './args'
import { main } from './main'
import { parseStepSpec } from './steps'

/** Split a command line into words the way a POSIX shell does for the quoting `shellQuote` emits. */
function shellWords(line: string): string[] {
  const words: string[] = []
  let cur = ''
  let inWord = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === "'") {
      const end = line.indexOf("'", i + 1)
      if (end < 0) throw new Error(`unterminated quote in ${line}`)
      cur += line.slice(i + 1, end)
      i = end
      inWord = true
    } else if (c === '\\') {
      cur += line[++i]
      inWord = true
    } else if (c === ' ') {
      if (inWord) words.push(cur)
      cur = ''
      inWord = false
    } else {
      cur += c
      inWord = true
    }
  }
  if (inWord) words.push(cur)
  return words
}

/** The params a run actually uses, as the runner resolves them. */
const resolved = (id: string, params: Params): Params => resolveParams(staticRegistry.get(id), params)

const textExamples = staticRegistry.list().filter(runsOffBrowser).flatMap(meta =>
  (EXAMPLES[meta.id] ?? [])
    .filter(ex => !ex.inputEncoding || ex.inputEncoding === 'text')
    .map(ex => ({ meta, ex })))

function makeIo() {
  const out: (Uint8Array | string)[] = []
  const err: string[] = []
  const io: CliIo = { stdin: async () => new Uint8Array(0), stdout: b => out.push(b), stderr: s => err.push(s) }
  return {
    io,
    outText: () => out.map(c => (typeof c === 'string' ? c : Buffer.from(c).toString('utf8'))).join(''),
    errText: () => err.join(''),
  }
}

describe('the site\'s subelt commands', () => {
  it('cover every utility the CLI can run', () => {
    expect(textExamples.length).toBeGreaterThan(200)
  })

  it.each(textExamples.map(({ meta, ex }) => [`${meta.id}: ${ex.title ?? ex.input.slice(0, 20)}`, meta.id, ex] as const))(
    '%s parses back to the same step and input',
    (_label, id, ex) => {
      const meta = staticRegistry.get(id)!
      const params = ex.params ?? {}
      const command = cliCommand(meta, ex.input, params)
      expect(command).toBeDefined()
      const words = shellWords(command!)
      expect(words.slice(0, 2)).toEqual(['npx', 'subelt'])
      const args = parseArgv(words.slice(2))
      if (args.text !== undefined) expect(args.text).toBe(ex.input)
      else expect(args.inputFile).toBe('input.txt')
      expect(args.stepArgs).toEqual([cliStep(meta, params)])
      const step = parseStepSpec(args.stepArgs[0], 0, staticRegistry)
      expect(resolved(id, step.params ?? {})).toEqual(resolved(id, params))
    },
  )

  // one example per utility, end to end through the CLI's own argv handling and output
  // (the engine itself is golden-tested on every example elsewhere)
  const runnable = textExamples
    .filter(({ meta, ex }) => meta.produces === 'string' && typeof ex.output === 'string' && cliCommand(meta, ex.input, ex.params ?? {})!.includes(' -t '))
    .filter(({ meta }, i, all) => all.findIndex(o => o.meta.id === meta.id) === i)

  it('runs a broad sample end to end', () => {
    expect(runnable.length).toBeGreaterThan(100)
  })

  it.each(runnable.map(({ meta, ex }) => [meta.id, ex] as const))('%s reproduces its example output', async (id, ex) => {
    const meta = staticRegistry.get(id)!
    const words = shellWords(cliCommand(meta, ex.input, ex.params ?? {})!)
    const { io, outText, errText } = makeIo()
    expect(await main(words.slice(2), io), errText()).toBe(0)
    expect(outText()).toBe(ex.output)
  })
})
