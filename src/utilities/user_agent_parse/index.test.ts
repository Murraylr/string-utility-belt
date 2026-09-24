import { describe, it, expect } from 'vitest'
import util from './index'

type UAResult = {
  browser: { name: string | null; version: string | null; major: string | null; type: string | null }
  engine: { name: string | null; version: string | null }
  os: { name: string | null; version: string | null }
  device: { type: string | null; vendor: string | null; model: string | null }
  cpu: { architecture: string | null }
  isBot: boolean
}

const parse = async (ua: string) => (await util.apply(ua, {})) as unknown as UAResult

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const GOOGLEBOT_SMARTPHONE =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const ROKU = 'Roku4640X/DVP-7.70 (297.70E04154A)'

describe('user_agent_parse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('user_agent_parse')
    expect(util.name).toBe('user agent parse')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('parses a desktop Chrome user agent', async () => {
    const r = await parse(CHROME_WIN)
    expect(r.browser.name).toBe('Chrome')
    expect(r.browser.version).toBe('120.0.0.0')
    expect(r.browser.major).toBe('120')
    expect(r.engine.name).toBe('Blink')
    expect(r.os.name).toBe('Windows')
    expect(r.os.version).toBe('10')
    expect(r.cpu.architecture).toBe('amd64')
    expect(r.device.type).toBe('desktop')
    expect(r.isBot).toBe(false)
  })

  it('parses a mobile Safari user agent with device details', async () => {
    const r = await parse(SAFARI_IPHONE)
    expect(r.browser.name).toBe('Mobile Safari')
    expect(r.os.name).toBe('iOS')
    expect(r.os.version).toBe('17.2')
    expect(r.device.type).toBe('mobile')
    expect(r.device.vendor).toBe('Apple')
    expect(r.device.model).toBe('iPhone')
  })

  it('keeps the device type the parser reports instead of assuming desktop', async () => {
    expect((await parse(IPAD)).device.type).toBe('tablet')
    const roku = await parse(ROKU)
    expect(roku.device.type).toBe('smarttv')
    expect(roku.device.vendor).toBe('Roku')
    expect(roku.browser.name).toBeNull()
    expect(roku.isBot).toBe(false)
  })

  it('returns a real object, not a JSON string', async () => {
    const r = await util.apply(CHROME_WIN, {})
    expect(typeof r).toBe('object')
    expect(Array.isArray(r)).toBe(false)
    expect(Object.keys(r as object).sort()).toEqual(['browser', 'cpu', 'device', 'engine', 'isBot', 'os'])
  })

  it('flags crawlers and command-line clients as bots', async () => {
    const bot = await parse(GOOGLEBOT)
    expect(bot.isBot).toBe(true)
    expect(bot.browser.name).toBe('Googlebot')
    expect(bot.browser.type).toBe('crawler')
    expect(bot.device.type).toBeNull()

    const curl = await parse('curl/8.4.0')
    expect(curl.isBot).toBe(true)
    expect(curl.browser.type).toBe('cli')

    const requests = await parse('python-requests/2.31.0')
    expect(requests.isBot).toBe(true)

    // a crawler that also carries a full browser UA keeps its device details
    const smartphoneBot = await parse(GOOGLEBOT_SMARTPHONE)
    expect(smartphoneBot.isBot).toBe(true)
    expect(smartphoneBot.device.type).toBe('mobile')

    const headless = await parse(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36'
    )
    expect(headless.isBot).toBe(true)
  })

  it('does not mistake a device model containing "bot" for a crawler', async () => {
    const spaced = await parse(
      'Mozilla/5.0 (Linux; Android 9; CUBOT X19) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.111 Mobile Safari/537.36'
    )
    expect(spaced.isBot).toBe(false)
    expect(spaced.os.name).toBe('Android')

    // the model can also be the last token before ")" — still a phone, not a crawler
    const trailing = await parse(
      'Mozilla/5.0 (Linux; Android 8.1.0; CUBOT) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.111 Mobile Safari/537.36'
    )
    expect(trailing.isBot).toBe(false)
    expect(trailing.device.type).toBe('mobile')
  })

  it('catches an unknown crawler through the token heuristic', async () => {
    const withVersion = await parse('Mozilla/5.0 (compatible; TotallyNewCrawler/0.9; +https://example.com)')
    expect(withVersion.isBot).toBe(true)
    // no version, no engine token: still recognisably automated
    const bare = await parse('Mozilla/5.0 (compatible; SomeBrandNewBot)')
    expect(bare.isBot).toBe(true)
  })

  it('handles empty input without throwing', async () => {
    const r = await parse('')
    expect(r.browser.name).toBeNull()
    expect(r.os.name).toBeNull()
    expect(r.device.type).toBeNull()
    expect(r.isBot).toBe(false)
    expect(await parse('   ')).toEqual(r)
  })

  it('survives non-ASCII characters in the user agent', async () => {
    const r = await parse(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; 中文版 🚀) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    expect(r.browser.name).toBe('Chrome')
    expect(r.os.name).toBe('Windows')
    expect(r.isBot).toBe(false)
  })

  it('reports unknown fields as null rather than dropping them', async () => {
    const r = await parse('SomeCompletelyUnknownClient')
    expect(r.browser.name).toBeNull()
    expect(r.engine.version).toBeNull()
    expect(r.isBot).toBe(false)
    expect(JSON.parse(JSON.stringify(r))).toHaveProperty('cpu.architecture', null)
  })

  it('throws on structured or binary input', async () => {
    await expect(util.apply({ ua: 'x' } as never, {})).rejects.toThrow(/structured data/)
    await expect(util.apply(new Uint8Array([1, 2, 3]), {})).rejects.toThrow(/raw bytes/)
  })
})
