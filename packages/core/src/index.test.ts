// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeShare } from '../../../src/core/serialize'
import type { PipelineDoc } from '../../../src/types/utility'
import { run, staticRegistry, STATIC_UTILITIES } from './index'

describe('staticRegistry / STATIC_UTILITIES', () => {
  it('exposes every utility, statically', () => {
    expect(STATIC_UTILITIES.length).toBeGreaterThan(200)
    expect(staticRegistry.has('trim')).toBe(true)
    expect(staticRegistry.get('trim')?.category).toBe('String Ops')
  })

  it('loads a utility implementation by id', async () => {
    const util = await staticRegistry.load('trim')
    expect(await util.apply('  hi  ', {})).toBe('hi')
  })
})

describe('run', () => {
  it('runs a bare step array against an explicit input', async () => {
    const result = await run('  hi  ', [{ id: 'a', utilityId: 'trim' }])
    expect(result.out).toBe('hi')
    expect(result.err).toEqual({})
  })

  it('runs a full PipelineDoc, chaining steps', async () => {
    const doc: PipelineDoc = {
      v: 2,
      steps: [
        { id: 'a', utilityId: 'trim' },
        { id: 'b', utilityId: 'base64_encode' },
      ],
    }
    const result = await run(' hi ', doc)
    expect(result.out).toBe('aGk=')
  })

  it('falls back to the document\'s own input when none is given', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }], input: '  from doc  ' }
    const result = await run(undefined, doc)
    expect(result.out).toBe('from doc')
  })

  it('accepts a share payload string', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] }
    const payload = encodeShare(doc)
    const result = await run('  hi  ', payload)
    expect(result.out).toBe('hi')
  })

  it('accepts a share URL, using whatever follows the last slash', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] }
    const payload = encodeShare(doc)
    const result = await run('  hi  ', `https://example.com/#/p/${payload}`)
    expect(result.out).toBe('hi')
  })

  it('accepts a share URL whose payload a chat app percent-encoded', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] }
    const escaped = [...encodeShare(doc)].map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    const result = await run('  hi  ', `https://example.com/#/p/${escaped}`)
    expect(result.out).toBe('hi')
  })

  it('reads the share link on the last line, in linear time however many #/p/ precede it', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] }
    const result = await run('  hi  ', `${'#/p/a'.repeat(100_000)}\nhttps://example.com/#/p/${encodeShare(doc)}`)
    expect(result.out).toBe('hi')
  })

  it('reads the payload after #/embed/ too', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] }
    const result = await run('  hi  ', `https://example.com/app/#/embed/${encodeShare(doc)}`)
    expect(result.out).toBe('hi')
  })

  it('refuses a pipeline with a step this environment cannot run', async () => {
    await expect(run('x', [{ id: 'a', utilityId: 'custom_js' }]))
      .rejects.toThrow(/unsupported/i)
  })

  it('refuses a DOM-only utility up front when there is no DOM (plain Node)', async () => {
    expect(typeof (globalThis as { DOMParser?: unknown }).DOMParser).toBe('undefined')
    await expect(run('<p>hi</p>', [{ id: 'a', utilityId: 'html_to_markdown' }]))
      .rejects.toThrow(/html_to_markdown \(step a\): needs dom/)
  })

  it('runs a DOM-only utility when the host provides a DOM (e.g. jsdom globals)', async () => {
    // @ts-expect-error -- jsdom ships no types (and @types/jsdom isn't installed); only DOMParser/document are used
    const { JSDOM } = await import('jsdom')
    const { window } = new JSDOM('')
    const g = globalThis as Record<string, unknown>
    g.DOMParser = window.DOMParser
    g.document = window.document
    try {
      const result = await run('<table><tr><td>a</td><td>b</td></tr></table>', [{ id: 'a', utilityId: 'html_table_to_csv' }])
      expect(result.err).toEqual({})
      expect(String(result.out)).toContain('a,b')
    } finally {
      delete g.DOMParser
      delete g.document
    }
  })

  it('refuses an unknown utility id', async () => {
    await expect(run('x', [{ id: 'a', utilityId: 'nope_not_real' }]))
      .rejects.toThrow(/unknown utility/i)
  })

  it('records per-step previews when asked', async () => {
    const result = await run('  hi  ', [{ id: 'a', utilityId: 'trim' }], { previews: true })
    expect(result.previews.a).toBe('hi')
    expect(result.inputs.a).toBe('  hi  ')
  })
})

const TYPES_ENTRY = path.resolve(__dirname, '../dist/types/packages/core/src/index.d.ts')

describe.skipIf(!existsSync(TYPES_ENTRY))('emitted declarations (npx tsc -p packages/core/tsconfig.json)', () => {
  it('match the package.json types path', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
    expect(path.resolve(__dirname, '..', pkg.types)).toBe(TYPES_ENTRY)
    expect(path.resolve(__dirname, '..', pkg.exports['.'].types)).toBe(TYPES_ENTRY)
  })

  it('only reference files that exist, by relative path (a consumer cannot resolve `@/…` or `import("src")`)', () => {
    const seen = new Set<string>()
    const problems: string[] = []
    const visit = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1]
        if (!spec.startsWith('.')) {
          if (spec !== 'lz-string') problems.push(`${path.relative(TYPES_ENTRY, file)}: ${spec}`)
          continue
        }
        const base = path.resolve(path.dirname(file), spec)
        const target = [`${base}.d.ts`, path.join(base, 'index.d.ts')].find(existsSync)
        if (target) visit(target)
        else problems.push(`${path.relative(TYPES_ENTRY, file)}: ${spec} (missing)`)
      }
    }
    visit(TYPES_ENTRY)
    expect(problems).toEqual([])
  })
})
