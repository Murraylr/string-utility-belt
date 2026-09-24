import { describe, it, expect } from 'vitest'
import util from './index'

const TYPES = [
  'name', 'first-name', 'last-name', 'email', 'username', 'phone', 'address', 'city', 'country',
  'company', 'job-title', 'sentence', 'url', 'domain', 'ipv4', 'mac', 'date', 'price',
  'credit-card', 'row'
]

const ROW_FIELDS = [
  'id', 'firstName', 'lastName', 'email', 'username', 'phone', 'address',
  'city', 'country', 'company', 'jobTitle', 'url', 'ipv4', 'date', 'price'
]

function luhnValid(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    double = !double
    sum += d
  }
  return sum % 10 === 0
}

const defaults = () =>
  Object.fromEntries(
    Object.entries(util.params).map(([k, v]) => [k, (v as { default?: unknown }).default])
  )

/** Distinct values a type yields over a large seeded sample — proxy for list size. */
const distinct = async (type: string, count: number): Promise<Set<string>> =>
  new Set(String(await util.apply('', { type, count, seed: 1 })).split('\n'))

describe('fake_data', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('fake_data')
    expect(util.name).toBe('fake data')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect((util.params.type as { options: string[] }).options).toEqual(TYPES)
    expect((util.params.format as { options: string[] }).options).toEqual(['lines', 'json', 'csv'])
  })

  it('declares the specified default for every param', () => {
    expect(defaults()).toEqual({
      type: 'name',
      count: 5,
      format: 'lines',
      separator: '\n',
      seed: 0
    })
  })

  it('embeds word lists that are large enough to look varied', async () => {
    // the spec floors: >=50 first names, >=50 surnames, >=30 cities/streets/domains/companies/words
    expect((await distinct('first-name', 2000)).size).toBeGreaterThanOrEqual(50)
    expect((await distinct('last-name', 2000)).size).toBeGreaterThanOrEqual(50)
    expect((await distinct('city', 2000)).size).toBeGreaterThanOrEqual(30)
    expect((await distinct('company', 2000)).size).toBeGreaterThanOrEqual(30)
    expect((await distinct('domain', 2000)).size).toBeGreaterThanOrEqual(30)
    expect((await distinct('job-title', 2000)).size).toBeGreaterThanOrEqual(30)
    expect((await distinct('country', 2000)).size).toBeGreaterThanOrEqual(30)

    const streets = new Set(
      String(await util.apply('', { type: 'address', count: 2000, seed: 1 }))
        .split('\n')
        .map((a) => a.split(',')[0].split(' ').slice(1, -1).join(' '))
    )
    expect(streets.size).toBeGreaterThanOrEqual(30)

    const words = new Set(
      String(await util.apply('', { type: 'sentence', count: 400, seed: 1 }))
        .toLowerCase()
        .replace(/[.\n]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
    )
    expect(words.size).toBeGreaterThanOrEqual(30)
  })

  it('generates the requested number of values and ignores the input', async () => {
    const out = String(await util.apply('this input is ignored', { type: 'name', count: 5, seed: 1 }))
    const lines = out.split('\n')
    expect(lines).toHaveLength(5)
    for (const line of lines) expect(line).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    expect(await util.apply('', { type: 'name', count: 5, seed: 1 })).toBe(out)
  })

  it('is reproducible for a non-zero seed and random for seed 0', async () => {
    expect(await util.apply('', { type: 'name', count: 3, seed: 5, format: 'json' }))
      .toEqual(['Owen Campbell', 'Jackson Nguyen', 'Ethan Scott'])
    expect(await util.apply('', { type: 'email', count: 2, seed: 12345 }))
      .toBe('violet.jackson@woodgrovebank.example\nella.lee@fabrikam.example')
    expect(await util.apply('', { type: 'name', count: 3, seed: 6, format: 'json' }))
      .not.toEqual(await util.apply('', { type: 'name', count: 3, seed: 5, format: 'json' }))

    const unseeded = new Set<string>()
    for (let i = 0; i < 6; i++) {
      unseeded.add(String(await util.apply('', { type: 'ipv4', count: 8, seed: 0 })))
    }
    expect(unseeded.size).toBeGreaterThan(1)
  })

  it('produces a well-formed value for every type option', async () => {
    const shapes: Record<string, RegExp> = {
      'name': /^[A-Za-z]+ [A-Za-z]+$/,
      'first-name': /^[A-Z][a-z]+$/,
      'last-name': /^[A-Z][a-z]+$/,
      'email': /^[a-z]+\.[a-z]+\d{0,2}@[a-z-]+\.example$/,
      'username': /^[a-z]+\d{1,3}$/,
      'phone': /^\+1 \(\d{3}\) 555-01\d{2}$/,
      'address': /^\d{1,4} .+ \w+, .+, [A-Z]{2} \d{5}$/,
      'city': /^[A-Z][A-Za-z ]+$/,
      'country': /^[A-Z][A-Za-z ]+$/,
      'company': /^[A-Z]/,
      'job-title': /^[A-Z]/,
      'sentence': /^[A-Z][a-z]+( [a-z]+){5,13}\.$/,
      'url': /^https:\/\/[a-z-]+\.example\/[a-z-]+$/,
      'domain': /^[a-z-]+\.example$/,
      'ipv4': /^\d{1,3}(\.\d{1,3}){3}$/,
      'mac': /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/,
      'date': /^\d{4}-\d{2}-\d{2}$/,
      'price': /^\$\d+\.\d{2}$/,
      'credit-card': /^\d{15,16}$/,
      'row': /^1,[A-Za-z]+,/
    }
    for (const type of TYPES) {
      const out = String(await util.apply('', { type, count: 1, seed: 3 }))
      expect(out, `type ${type}`).toMatch(shapes[type])
    }
  })

  it('generates Luhn-valid credit cards and locally-administered MACs', async () => {
    const cards = String(await util.apply('', { type: 'credit-card', count: 20, seed: 0 })).split('\n')
    for (const card of cards) expect(luhnValid(card), card).toBe(true)

    const macs = String(await util.apply('', { type: 'mac', count: 10, seed: 0 })).split('\n')
    for (const mac of macs) {
      const first = parseInt(mac.slice(0, 2), 16)
      expect(first & 0x01).toBe(0)
      expect(first & 0x02).toBe(2)
    }
  })

  it('supports the lines, csv and json formats', async () => {
    expect(await util.apply('', { type: 'city', count: 2, seed: 9, format: 'lines' }))
      .toMatch(/^[A-Za-z ]+\n[A-Za-z ]+$/)

    const csv = String(await util.apply('', { type: 'email', count: 2, seed: 5, format: 'csv' }))
    expect(csv.split('\n')[0]).toBe('email')
    expect(csv.split('\n')).toHaveLength(3)

    const json = await util.apply('', { type: 'city', count: 3, seed: 9, format: 'json' })
    expect(Array.isArray(json)).toBe(true)
    expect(json as unknown as string[]).toHaveLength(3)
    expect(typeof (json as unknown as string[])[0]).toBe('string')
  })

  it('emits full rows as objects, csv with a header, and quoted csv cells', async () => {
    const rows = await util.apply('', { type: 'row', count: 2, seed: 12345, format: 'json' })
    expect(Array.isArray(rows)).toBe(true)
    const first = (rows as unknown as Record<string, unknown>[])[0]
    expect(Object.keys(first)).toEqual(ROW_FIELDS)
    expect(first.id).toBe(1)
    expect(first.email).toBe('violet.jackson@woodgrovebank.example')

    const csv = String(await util.apply('', { type: 'row', count: 1, seed: 99, format: 'csv' }))
    const [header, row] = csv.split('\n')
    expect(header).toBe(ROW_FIELDS.join(','))
    // the address contains commas, so it must be quoted
    expect(row).toContain('"1055 Ridge Ct, Milton, AR 34530"')

    // scalar csv quotes comma-bearing cells too, and uses the type as the header
    const addresses = String(await util.apply('', { type: 'address', count: 2, seed: 99, format: 'csv' }))
      .split('\n')
    expect(addresses[0]).toBe('address')
    for (const cell of addresses.slice(1)) expect(cell).toMatch(/^"[^"]+"$/)

    // format 'lines' on a row emits the same csv record without the header
    const asLines = String(await util.apply('', { type: 'row', count: 1, seed: 99, format: 'lines' }))
    expect(asLines).toBe(row)
  })

  it('joins with a custom separator, including a non-ASCII one', async () => {
    const out = String(await util.apply('', { type: 'first-name', count: 3, seed: 2, separator: ' 🎈 ' }))
    expect(out.split(' 🎈 ')).toHaveLength(3)
    expect([...out]).toContain('🎈')

    const tabbed = String(await util.apply('', { type: 'city', count: 2, seed: 2, separator: '\\t' }))
    expect(tabbed.split('\t')).toHaveLength(2)
  })

  it('returns empty output for count 0 without throwing', async () => {
    expect(await util.apply('', { count: 0 })).toBe('')
    expect(await util.apply('', { count: 0, format: 'json' })).toEqual([])
    expect(await util.apply('', { count: 0, format: 'csv', type: 'email' })).toBe('email')
    expect(await util.apply('', {})).toMatch(/^[A-Za-z]+ [A-Za-z]+(\n[A-Za-z]+ [A-Za-z]+){4}$/)
  })

  it('throws clear errors for bad params', async () => {
    const run = async (params: Record<string, unknown>) => util.apply('', params)
    await expect(run({ type: 'wizard' })).rejects.toThrow(/unknown type: wizard/)
    await expect(run({ format: 'xml' })).rejects.toThrow(/unknown format: xml/)
    await expect(run({ count: -3 })).rejects.toThrow(/count must be 0 or more/)
    await expect(run({ count: 10001 })).rejects.toThrow(/10000 or less/)
    await expect(run({ count: 'lots' })).rejects.toThrow(/count must be a number/)
  })
})
