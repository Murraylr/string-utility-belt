import { describe, it, expect } from 'vitest'
import util from './index'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const defaults = () =>
  Object.fromEntries(
    Object.entries(util.params).map(([k, v]) => [k, (v as { default?: unknown }).default])
  )

describe('template_expand', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('template_expand')
    expect(util.name).toBe('template expand')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['count', 'seed', 'separator', 'start', 'template'])
    expect(util.params.template.kind).toBe('textarea')
  })

  it('declares the specified default for every param', () => {
    expect(defaults()).toEqual({
      template: '{i}, {uuid}',
      count: 10,
      start: 1,
      separator: '\n',
      seed: 0
    })
  })

  it('falls back to those defaults when no params are supplied', async () => {
    const out = String(await util.apply('', {}))
    const lines = out.split('\n')
    expect(lines).toHaveLength(10)
    for (const [i, line] of lines.entries()) {
      expect(line.startsWith(`${i + 1}, `)).toBe(true)
      expect(line.slice(String(i + 1).length + 2)).toMatch(UUID_RE)
    }
  })

  it('repeats the template with {i}, {i0} and {n}', async () => {
    const out = await util.apply('', { template: '{i}/{i0}/{n}', count: 3 })
    expect(out).toBe('1/0/3\n2/1/3\n3/2/3')
  })

  it('honours the start param and the separator param', async () => {
    const out = await util.apply('', { template: 'row {i}', count: 3, start: 100, separator: ', ' })
    expect(out).toBe('row 100, row 101, row 102')
    // {i0} is always zero-based; only {i} is shifted by start
    expect(await util.apply('', { template: '{i}|{i0}', count: 2, start: 7 })).toBe('7|0\n8|1')
    expect(await util.apply('', { template: '{i}', count: 2, start: -1 })).toBe('-1\n0')
  })

  it('decodes escape sequences typed into the separator field', async () => {
    const out = await util.apply('', { template: '{i}', count: 2, separator: '\\t' })
    expect(out).toBe('1\t2')
  })

  it('returns empty output for count 0 and never throws on empty input', async () => {
    expect(await util.apply('', { count: 0 })).toBe('')
    expect(await util.apply('', {})).toMatch(/^1, [0-9a-f-]{36}\n/)
    const lineOnly = await util.apply('', { template: '[{line}]', count: 2 })
    expect(lineOnly).toBe('[]\n[]')
  })

  it('substitutes {line} from the input, cycling and preserving astral characters', async () => {
    const out = await util.apply('alpha\nbêta\n🎈', { template: '{i}. {line}', count: 5, separator: ' / ' })
    expect(out).toBe('1. alpha / 2. bêta / 3. 🎈 / 4. alpha / 5. bêta')
    expect(out).toContain('🎈')
    const crlf = await util.apply('one\r\ntwo', { template: '{line}', count: 2 })
    expect(crlf).toBe('one\ntwo')
  })

  it('produces identical output for a non-zero seed', async () => {
    const args = { template: '{i}: {word}-{hex:4} #{randint:1,100} r={random}', count: 3, seed: 42 }
    const first = await util.apply('', args)
    expect(first).toBe(
      '1: oak-7da2 #53 r=0.273228\n2: orchid-d73e #75 r=0.307002\n3: comet-8a90 #48 r=0.837337'
    )
    expect(await util.apply('', args)).toBe(first)
    expect(await util.apply('', { ...args, seed: 43 })).not.toBe(first)
  })

  it('produces seeded uuids and well-shaped unseeded ones', async () => {
    const seeded = await util.apply('', { template: '{uuid}', count: 2, seed: 7 })
    expect(seeded).toBe('020ffab2-8567-473d-8dba-4227c384325e\n4b884bfa-3fe0-4024-a74a-8cc313e98d9f')

    const random = String(await util.apply('', { template: '{uuid}', count: 5, seed: 0 })).split('\n')
    expect(random).toHaveLength(5)
    for (const id of random) expect(id).toMatch(UUID_RE)
    expect(new Set(random).size).toBe(5)
  })

  it('keeps {randint:a,b} inside its bounds and {hex:len} at the right length', async () => {
    const ints = String(await util.apply('', { template: '{randint:5,7}', count: 30, seed: 0 })).split('\n')
    for (const n of ints) expect([5, 6, 7]).toContain(Number(n))
    const hexes = String(await util.apply('', { template: '{hex:12}', count: 4, seed: 0 })).split('\n')
    for (const h of hexes) expect(h).toMatch(/^[0-9a-f]{12}$/)
    // reversed bounds are tolerated
    expect(await util.apply('', { template: '{randint:9,9}', count: 1 })).toBe('9')
    expect(await util.apply('', { template: '{randint:3,1}', count: 1 })).toMatch(/^[123]$/)
  })

  it('expands {date} to an ISO timestamp and leaves unknown tokens alone', async () => {
    const out = String(await util.apply('', { template: '{date}', count: 1 }))
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(await util.apply('', { template: '{nope} {i} {word:2}', count: 1, seed: 1 }))
      .toBe('{nope} 1 {word:2}')
  })

  it('throws clear errors for malformed params and tokens', async () => {
    const run = async (params: Record<string, unknown>) => util.apply('', params)
    await expect(run({ count: -1 })).rejects.toThrow(/count must be 0 or more/)
    await expect(run({ count: 100001 })).rejects.toThrow(/100000 or less/)
    await expect(run({ count: 'many' })).rejects.toThrow(/count must be a number/)
    await expect(run({ count: 1, start: 'x' })).rejects.toThrow(/start index must be a number/)
    await expect(run({ template: '{randint:a,b}', count: 1 })).rejects.toThrow(/randint/)
    await expect(run({ template: '{hex:0}', count: 1 })).rejects.toThrow(/hex/)
    await expect(run({ template: '{hex:99999}', count: 1 })).rejects.toThrow(/hex/)
  })
})
