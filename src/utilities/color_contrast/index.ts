import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * CSS named colours (CSS Color 4 `<named-color>` + `transparent`)
 *
 * Kept local on purpose: every utility in this app is self-contained so a
 * change to one can never silently alter another.
 * ------------------------------------------------------------------ */

const NAMED_COLORS: Record<string, string> = {
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '00ffff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000000',
  blanchedalmond: 'ffebcd',
  blue: '0000ff',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '00ffff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '778899',
  lightslategrey: '778899',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '00ff00',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'ff00ff',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  rebeccapurple: '663399',
  red: 'ff0000',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  transparent: '000000',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'ffffff',
  whitesmoke: 'f5f5f5',
  yellow: 'ffff00',
  yellowgreen: '9acd32'
}

/* ------------------------------------------------------------------ *
 * Colour parsing (sRGB 0..1 + alpha)
 * ------------------------------------------------------------------ */

type RGBA = { r: number; g: number; b: number; a: number }

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

const bad = (text: string): never => {
  throw new Error(`invalid color: ${String(text).trim() || '(empty)'}`)
}

const mul = (m: number[][], v: number[]) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
]

const linearToSrgb = (c: number) => {
  const sign = c < 0 ? -1 : 1
  const abs = Math.abs(c)
  return abs <= 0.0031308 ? c * 12.92 : sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055)
}

const XYZ65_TO_LIN_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]
]
const XYZ50_TO_XYZ65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]
]
const OKLAB_TO_LMS = [
  [1.0, 0.3963377773761749, 0.2158037573099136],
  [1.0, -0.1055613458156586, -0.0638541728258133],
  [1.0, -0.0894841775298119, -1.2914855480194092]
]
const LMS_TO_XYZ65 = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.1122868032803173, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816]
]

/** CIE standard illuminant D50 — CSS `lab()`/`lch()` are D50-referenced. */
const D50 = [0.3457 / 0.3585, 1.0, (1.0 - 0.3457 - 0.3585) / 0.3585]
const LAB_E = 216 / 24389
const LAB_K = 24389 / 27

const labToRgb = (lab: number[]): number[] => {
  const [L, a, b] = lab
  const fy = (L + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  const xyz = [
    Math.pow(fx, 3) > LAB_E ? Math.pow(fx, 3) : (116 * fx - 16) / LAB_K,
    L > LAB_K * LAB_E ? Math.pow(fy, 3) : L / LAB_K,
    Math.pow(fz, 3) > LAB_E ? Math.pow(fz, 3) : (116 * fz - 16) / LAB_K
  ].map((v, i) => v * D50[i])
  return mul(XYZ65_TO_LIN_SRGB, mul(XYZ50_TO_XYZ65, xyz)).map(linearToSrgb)
}

const oklabToRgb = (lab: number[]): number[] => {
  const lms = mul(OKLAB_TO_LMS, lab).map((v) => v * v * v)
  return mul(XYZ65_TO_LIN_SRGB, mul(LMS_TO_XYZ65, lms)).map(linearToSrgb)
}

const fromPolar = ([L, c, h]: number[]): number[] => {
  const rad = (h * Math.PI) / 180
  return [L, c * Math.cos(rad), c * Math.sin(rad)]
}

const hslToRgb = (h: number, s: number, l: number): number[] => {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: number[]
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return rgb.map((v) => v + m)
}

const hwbToRgb = (h: number, w: number, bl: number): number[] => {
  if (w + bl >= 1) {
    const grey = w / (w + bl)
    return [grey, grey, grey]
  }
  return hslToRgb(h, 1, 0.5).map((v) => v * (1 - w - bl) + w)
}

const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

const asNumber = (token: string, text: string): number => {
  if (token === 'none') return 0
  if (!NUMBER_RE.test(token)) bad(text)
  return Number(token)
}

const asScaled = (token: string, scale: number, text: string): number => {
  if (token === 'none') return 0
  if (token.endsWith('%')) return (asNumber(token.slice(0, -1), text) / 100) * scale
  return asNumber(token, text)
}

const asHue = (token: string, text: string): number => {
  if (token === 'none') return 0
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i.exec(token)
  if (!m) bad(text)
  const n = Number(m![1])
  switch ((m![2] || 'deg').toLowerCase()) {
    case 'grad':
      return n * 0.9
    case 'rad':
      return (n * 180) / Math.PI
    case 'turn':
      return n * 360
    default:
      return n
  }
}

const asAlpha = (token: string | undefined, text: string): number => {
  if (token === undefined || token === '') return 1
  if (token === 'none') return 0
  return clamp01(
    token.endsWith('%') ? asNumber(token.slice(0, -1), text) / 100 : asNumber(token, text)
  )
}

const hexPair = (h: string) => parseInt(h, 16) / 255

function parseHex(body: string, text: string): RGBA {
  if (!/^[0-9a-f]+$/i.test(body)) bad(text)
  const h = body.toLowerCase()
  if (h.length === 3 || h.length === 4) {
    return {
      r: hexPair(h[0] + h[0]),
      g: hexPair(h[1] + h[1]),
      b: hexPair(h[2] + h[2]),
      a: h.length === 4 ? hexPair(h[3] + h[3]) : 1
    }
  }
  if (h.length === 6 || h.length === 8) {
    return {
      r: hexPair(h.slice(0, 2)),
      g: hexPair(h.slice(2, 4)),
      b: hexPair(h.slice(4, 6)),
      a: h.length === 8 ? hexPair(h.slice(6, 8)) : 1
    }
  }
  return bad(text)
}

function splitArgs(argsRaw: string, text: string): { comps: string[]; alpha?: string } {
  const parts = argsRaw.replace(/,/g, ' ').split('/')
  if (parts.length > 2) bad(text)
  const comps = parts[0].trim().split(/\s+/).filter(Boolean)
  let alpha = parts.length === 2 ? parts[1].trim() : undefined
  if (alpha === undefined && comps.length === 4) alpha = comps.pop()
  if (alpha === '') bad(text)
  return { comps, alpha }
}

function parseFunction(name: string, argsRaw: string, text: string): RGBA {
  const { comps, alpha } = splitArgs(argsRaw, text)
  if (comps.length !== 3) bad(text)
  const a = asAlpha(alpha, text)

  switch (name) {
    case 'rgb':
    case 'rgba': {
      const [r, g, b] = comps.map((c) => asScaled(c, 100, text) / (c.endsWith('%') ? 100 : 255))
      return { r, g, b, a }
    }
    case 'hsl':
    case 'hsla': {
      const [r, g, b] = hslToRgb(
        asHue(comps[0], text),
        clamp01(asScaled(comps[1], 100, text) / 100),
        clamp01(asScaled(comps[2], 100, text) / 100)
      )
      return { r, g, b, a }
    }
    case 'hwb': {
      const [r, g, b] = hwbToRgb(
        asHue(comps[0], text),
        clamp01(asScaled(comps[1], 100, text) / 100),
        clamp01(asScaled(comps[2], 100, text) / 100)
      )
      return { r, g, b, a }
    }
    case 'lab': {
      const [r, g, b] = labToRgb([
        asScaled(comps[0], 100, text),
        asScaled(comps[1], 125, text),
        asScaled(comps[2], 125, text)
      ])
      return { r, g, b, a }
    }
    case 'lch': {
      const [r, g, b] = labToRgb(
        fromPolar([
          asScaled(comps[0], 100, text),
          asScaled(comps[1], 150, text),
          asHue(comps[2], text)
        ])
      )
      return { r, g, b, a }
    }
    case 'oklab': {
      const [r, g, b] = oklabToRgb([
        asScaled(comps[0], 1, text),
        asScaled(comps[1], 0.4, text),
        asScaled(comps[2], 0.4, text)
      ])
      return { r, g, b, a }
    }
    case 'oklch': {
      const [r, g, b] = oklabToRgb(
        fromPolar([
          asScaled(comps[0], 1, text),
          asScaled(comps[1], 0.4, text),
          asHue(comps[2], text)
        ])
      )
      return { r, g, b, a }
    }
    default:
      return bad(text)
  }
}

/** hex / rgb() / hsl() / hwb() / lab() / lch() / oklab() / oklch() / named -> sRGB. */
function parseColor(raw: string): RGBA {
  const text = String(raw ?? '').trim()
  if (!text) bad(raw ?? '')
  if (text.startsWith('#')) return parseHex(text.slice(1), text)

  const fn = /^([a-z][a-z0-9-]*)\s*\(([^()]*)\)$/i.exec(text)
  if (fn) return parseFunction(fn[1].toLowerCase(), fn[2], text)

  const key = text.toLowerCase()
  if (key in NAMED_COLORS) {
    const rgba = parseHex(NAMED_COLORS[key], text)
    return key === 'transparent' ? { ...rgba, a: 0 } : rgba
  }
  if (/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) return parseHex(text, text)
  return bad(text)
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')
const toHex = ({ r, g, b }: RGBA) =>
  `#${hex2(Math.round(clamp01(r) * 255))}${hex2(Math.round(clamp01(g) * 255))}${hex2(Math.round(clamp01(b) * 255))}`

/* ------------------------------------------------------------------ *
 * WCAG 2.1 contrast
 * ------------------------------------------------------------------ */

/**
 * WCAG 2.x pins the transfer function threshold at 0.03928 (sRGB itself uses
 * 0.04045); the difference is invisible but the spec value keeps the numbers
 * identical to every published contrast checker.
 */
const wcagChannel = (c: number) => {
  const v = clamp01(c)
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

const relativeLuminance = ({ r, g, b }: RGBA) =>
  0.2126 * wcagChannel(r) + 0.7152 * wcagChannel(g) + 0.0722 * wcagChannel(b)

/**
 * Source-over composite of `fg` onto an already-opaque `bg`.
 * Both sides are gamut-clamped first: lab()/oklch() can land outside sRGB and
 * contrast is defined on what a display actually shows, not on the ideal value.
 */
const composite = (fg: RGBA, bg: RGBA): RGBA => {
  const f = { r: clamp01(fg.r), g: clamp01(fg.g), b: clamp01(fg.b) }
  if (fg.a >= 1) return { ...f, a: 1 }
  const a = clamp01(fg.a)
  return {
    r: f.r * a + clamp01(bg.r) * (1 - a),
    g: f.g * a + clamp01(bg.g) * (1 - a),
    b: f.b * a + clamp01(bg.b) * (1 - a),
    a: 1
  }
}

const WHITE: RGBA = { r: 1, g: 1, b: 1, a: 1 }

const round2 = (n: number) => Math.round(n * 100) / 100
const round4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Pulls colour tokens out of free text: `#abc`, `rgb(0 0 0 / .5)`, `red`.
 * Non-colour words simply fail to parse and are dropped.
 */
const TOKEN_RE = /#[0-9a-fA-F]{3,8}|[a-zA-Z][a-zA-Z0-9-]*\s*\([^()]*\)|[a-zA-Z][a-zA-Z0-9-]*/g

function extractColors(text: string): { color: RGBA; source: string }[] {
  const out: { color: RGBA; source: string }[] = []
  for (const match of text.match(TOKEN_RE) ?? []) {
    const source = match.trim()
    try {
      out.push({ color: parseColor(source), source })
    } catch {
      // not a colour — ignore and keep scanning
    }
  }
  return out
}

const THRESHOLDS = {
  AA: { normalText: 4.5, largeText: 3, ui: 3 },
  // WCAG 2.1 has no AAA non-text criterion; 1.4.11's 3:1 is reused for `ui` so
  // the two levels report the same shape.
  AAA: { normalText: 7, largeText: 4.5, ui: 3 }
}

/**
 * Grades the EXACT ratio, never the display-rounded one: #0078d7 on white is
 * 4.4989:1, which shows as "4.5" but does not meet the 4.5:1 minimum.
 */
const grade = (ratio: number, level: 'AA' | 'AAA') => ({
  normalText: ratio >= THRESHOLDS[level].normalText,
  largeText: ratio >= THRESHOLDS[level].largeText,
  ui: ratio >= THRESHOLDS[level].ui
})

// AA normal text and AAA large text share the same 4.5:1 minimum, so those two
// verdicts always agree — the summary reports them together.
function summarise(shown: number, aa: ReturnType<typeof grade>, aaa: ReturnType<typeof grade>) {
  if (aaa.normalText) return `${shown}:1 — passes AAA for normal and large text`
  if (aa.normalText) return `${shown}:1 — passes AA for normal text and AAA for large text`
  if (aa.largeText) return `${shown}:1 — passes AA for large text and UI only`
  return `${shown}:1 — fails every WCAG minimum`
}

/* ------------------------------------------------------------------ *
 * Utility
 * ------------------------------------------------------------------ */

const util: Utility = {
  id: 'color_contrast',
  name: 'color contrast',
  category: 'Color',
  description:
    'Report the WCAG 2.1 contrast ratio between a foreground and background color, with AA and AAA pass/fail for normal text, large text, and UI components.',
  accepts: 'string',
  produces: 'json',
  tags: ['wcag', 'a11y', 'accessibility', 'contrast ratio', 'color', 'aa', 'aaa', 'luminance'],
  aliases: ['wcag contrast checker'],
  examples: [
    {
      title: 'a borderline pair (looks 4.5, is not)',
      input: '',
      params: { foreground: '#0078d7', background: '#ffffff' },
      output:
        '{\n  "foreground": "#0078d7",\n  "background": "#ffffff",\n  "foregroundInput": "#0078d7",\n  "backgroundInput": "#ffffff",\n  "composited": false,\n  "ratio": 4.5,\n  "foregroundLuminance": 0.1834,\n  "backgroundLuminance": 1,\n  "AA": {\n    "normalText": false,\n    "largeText": true,\n    "ui": true\n  },\n  "AAA": {\n    "normalText": false,\n    "largeText": false,\n    "ui": true\n  },\n  "thresholds": {\n    "AA": {\n      "normalText": 4.5,\n      "largeText": 3,\n      "ui": 3\n    },\n    "AAA": {\n      "normalText": 7,\n      "largeText": 4.5,\n      "ui": 3\n    }\n  },\n  "summary": "4.5:1 — passes AA for large text and UI only"\n}'
    },
    {
      title: 'a pair that fails AA normal text',
      input: '',
      params: { foreground: '#777777', background: '#ffffff' },
      output:
        '{\n  "foreground": "#777777",\n  "background": "#ffffff",\n  "foregroundInput": "#777777",\n  "backgroundInput": "#ffffff",\n  "composited": false,\n  "ratio": 4.48,\n  "foregroundLuminance": 0.1845,\n  "backgroundLuminance": 1,\n  "AA": {\n    "normalText": false,\n    "largeText": true,\n    "ui": true\n  },\n  "AAA": {\n    "normalText": false,\n    "largeText": false,\n    "ui": true\n  },\n  "thresholds": {\n    "AA": {\n      "normalText": 4.5,\n      "largeText": 3,\n      "ui": 3\n    },\n    "AAA": {\n      "normalText": 7,\n      "largeText": 4.5,\n      "ui": 3\n    }\n  },\n  "summary": "4.48:1 — passes AA for large text and UI only"\n}'
    }
  ],
  params: {
    foreground: {
      kind: 'color',
      label: 'foreground',
      default: '',
      placeholder: 'blank = read from input'
    },
    background: { kind: 'color', label: 'background', default: '#ffffff' }
  },
  apply: (input: any, params: any): any => {
    const fgParam = String(params?.foreground ?? '').trim()
    const bgParam = String(params?.background ?? '').trim() || '#ffffff'
    const text = String(input ?? '')

    let fgSource: string
    let bgSource: string
    if (fgParam) {
      fgSource = fgParam
      bgSource = bgParam
    } else {
      const found = extractColors(text)
      if (found.length === 0) {
        // Empty input with no foreground param is simply "nothing to measure".
        if (!text.trim()) return {}
        throw new Error(
          `no color found in the input — set the foreground param, or pass something like "#112233 #ffffff"`
        )
      }
      fgSource = found[0].source
      bgSource = found.length > 1 ? found[1].source : bgParam
    }

    const rawForeground = parseColor(fgSource)
    const rawBackground = parseColor(bgSource)

    // WCAG contrast is only defined for opaque colours: flatten translucent
    // ones (background over white, then foreground over that background).
    const background = composite(rawBackground, WHITE)
    const foreground = composite(rawForeground, background)

    const fgLuminance = relativeLuminance(foreground)
    const bgLuminance = relativeLuminance(background)
    const lighter = Math.max(fgLuminance, bgLuminance)
    const darker = Math.min(fgLuminance, bgLuminance)
    const exact = (lighter + 0.05) / (darker + 0.05)
    const ratio = round2(exact)

    const aa = grade(exact, 'AA')
    const aaa = grade(exact, 'AAA')

    return {
      foreground: toHex(foreground),
      background: toHex(background),
      foregroundInput: fgSource,
      backgroundInput: bgSource,
      composited: rawForeground.a < 1 || rawBackground.a < 1,
      ratio,
      foregroundLuminance: round4(fgLuminance),
      backgroundLuminance: round4(bgLuminance),
      AA: aa,
      AAA: aaa,
      // A fresh copy each call — the caller must never be handed the shared
      // module-level table it could mutate.
      thresholds: { AA: { ...THRESHOLDS.AA }, AAA: { ...THRESHOLDS.AAA } },
      summary: summarise(ratio, aa, aaa)
    }
  }
}

export default util
