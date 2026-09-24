import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/*
 * ua-parser-js is loaded lazily and cached: src/utilities/index.ts eagerly globs every
 * utility module, so a top-level import would drag the whole regex database into the
 * app's initial bundle. The pipeline re-runs on every keystroke, so the module must only
 * ever be fetched once.
 */
type UAMain = typeof import('ua-parser-js')
type UAExtensions = typeof import('ua-parser-js/extensions')

let _uaMain: UAMain | null = null
const getUAParser = async () => (_uaMain ??= await import('ua-parser-js'))

// The bot/crawler/CLI/library regexes live in a separate entry point. It is optional:
// if it cannot be resolved the parser still works, we just fall back to the regex below.
let _uaExtensions: UAExtensions | null = null
let _uaExtensionsTried = false
const getBotExtension = async () => {
  if (!_uaExtensionsTried) {
    _uaExtensionsTried = true
    try {
      _uaExtensions = await import('ua-parser-js/extensions')
    } catch {
      _uaExtensions = null
    }
  }
  return _uaExtensions ? _uaExtensions.Bots : null
}

/** Browser "types" ua-parser-js reports for non-human clients. */
const AUTOMATED_TYPES = new Set(['bot', 'crawler', 'fetcher', 'cli', 'library'])

/**
 * Curated second opinion for bot detection. Deliberately anchored (`something-bot/1.0`,
 * `curl/`, ...) rather than a bare /bot/ substring, which would flag device models such
 * as "Cubot" as crawlers.
 */
const BOT_HINTS = new RegExp(
  [
    // standalone words: "compatible; bot", "... crawler ..."
    '\\b(?:bot|crawler|spider|scraper|slurp|archiver|indexer|validator|feedfetcher)\\b',
    // glued product names, but only when a version delimiter follows ("mj12bot/1.4"),
    // so device models such as "CUBOT X19" are not swept up. No leading [a-z0-9._-]*
    // for the name: this is only `.test`ed, and that prefix made it quadratic.
    '(?:bot|crawler|spider|scraper|archiver|fetcher|indexer)[/;]',
    'mediapartners-google|facebookexternalhit|ia_archiver',
    'headless(?:chrome|firefox)|phantomjs|puppeteer|playwright|selenium|scrapy|lighthouse',
    'uptimerobot|pingdom|statuscake|site24x7|newrelicpinger|datadog',
    'curl/|wget/|libwww-perl|python-requests|python-urllib|aiohttp|httpie',
    'okhttp|axios/|node-fetch|undici|go-http-client|java/|apache-httpclient',
    'guzzlehttp|postmanruntime|insomnia|restsharp'
  ].join('|'),
  'i'
)

/**
 * A glued product name closed by `)` — "(compatible; SomeNewBot)". Phone vendors do the
 * same thing ("(Linux; Android 8; CUBOT)"), so this only counts when the string carries
 * no rendering-engine token: every real browser UA names one, crawler UAs do not.
 */
// only ever `.test`ed, so the name before the hint (which may be empty) need not be matched:
// a leading [a-z0-9._-]* made every position of a long token rescan it (quadratic)
const BOT_HINT_IN_PARENS = /(?:bot|crawler|spider|scraper|archiver|fetcher|indexer)\)/i
const ENGINE_TOKEN = /applewebkit|khtml|gecko\/|trident|presto|edgehtml/i

const looksAutomated = (ua: string): boolean =>
  BOT_HINTS.test(ua) || (BOT_HINT_IN_PARENS.test(ua) && !ENGINE_TOKEN.test(ua))

const asUserAgent = (input: unknown): string => {
  if (typeof input === 'string') return input
  if (input === null || input === undefined) return ''
  if (isBytes(input)) throw new Error('user agent parse expects a user-agent string, not raw bytes')
  if (typeof input === 'object') throw new Error('user agent parse expects a user-agent string, not structured data')
  return String(input)
}

/** JSON.stringify drops undefined, so unknown fields become explicit nulls. */
const orNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

const util: Utility = {
  id: 'user_agent_parse',
  name: 'user agent parse',
  category: 'Web & Dev',
  description: 'Parse a user-agent string into browser, engine, OS, device and CPU details, and flag bots, crawlers and command-line clients.',
  accepts: 'string',
  produces: 'json',
  tags: ['user agent', 'browser detection', 'os detection', 'device detection', 'bot detection', 'ua string', 'client hints'],
  aliases: ['ua-parser'],
  examples: [
    {
      title: 'desktop Chrome on Windows',
      input: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      output:
        '{\n  "browser": {\n    "name": "Chrome",\n    "version": "117.0.0.0",\n    "major": "117",\n    "type": null\n  },\n  "engine": {\n    "name": "Blink",\n    "version": "117.0.0.0"\n  },\n  "os": {\n    "name": "Windows",\n    "version": "10"\n  },\n  "device": {\n    "type": "desktop",\n    "vendor": null,\n    "model": null\n  },\n  "cpu": {\n    "architecture": "amd64"\n  },\n  "isBot": false\n}'
    },
    {
      title: 'a crawler',
      input: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      output:
        '{\n  "browser": {\n    "name": "Googlebot",\n    "version": "2.1",\n    "major": "2",\n    "type": "crawler"\n  },\n  "engine": {\n    "name": null,\n    "version": null\n  },\n  "os": {\n    "name": null,\n    "version": null\n  },\n  "device": {\n    "type": null,\n    "vendor": null,\n    "model": null\n  },\n  "cpu": {\n    "architecture": null\n  },\n  "isBot": true\n}'
    }
  ],
  params: {},
  apply: async (input: any) => {
    const ua = asUserAgent(input).trim()

    if (!ua) {
      return {
        browser: { name: null, version: null, major: null, type: null },
        engine: { name: null, version: null },
        os: { name: null, version: null },
        device: { type: null, vendor: null, model: null },
        cpu: { architecture: null },
        isBot: false
      }
    }

    const { UAParser } = await getUAParser()
    const bots = await getBotExtension()
    const result = bots ? new UAParser(ua, bots).getResult() : new UAParser(ua).getResult()

    const browserType = orNull(result.browser.type)
    const isBot =
      (browserType !== null && AUTOMATED_TYPES.has(browserType.toLowerCase())) || looksAutomated(ua)

    const rawDeviceType = orNull(result.device.type)
    // ua-parser-js leaves device.type undefined for desktops; only infer "desktop" when a
    // real browser was identified, so crawlers and CLI clients stay device-less.
    const deviceType =
      rawDeviceType ??
      (!isBot && orNull(result.browser.name) !== null && orNull(result.os.name) !== null ? 'desktop' : null)

    return {
      browser: {
        name: orNull(result.browser.name),
        version: orNull(result.browser.version),
        major: orNull(result.browser.major),
        type: browserType
      },
      engine: {
        name: orNull(result.engine.name),
        version: orNull(result.engine.version)
      },
      os: {
        name: orNull(result.os.name),
        version: orNull(result.os.version)
      },
      device: {
        type: deviceType,
        vendor: orNull(result.device.vendor),
        model: orNull(result.device.model)
      },
      cpu: {
        architecture: orNull(result.cpu.architecture)
      },
      isBot
    }
  }
}

export default util
