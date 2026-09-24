import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * CSS named colours (CSS Color 4 `<named-color>` + `transparent`)
 * ------------------------------------------------------------------ */

/** name -> 6-digit hex (lower case, no `#`). `transparent` carries its alpha separately. */
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

/**
 * hex -> canonical name. Several names share a hex (aqua/cyan, gray/grey, …);
 * the first in the alphabetically-ordered table above wins so the output is
 * deterministic (aqua, fuchsia, gray, darkgray, …).
 */
const NAME_BY_HEX: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    if (name === 'transparent') continue
    if (!(hex in out)) out[hex] = name
  }
  return out
})()

/* ------------------------------------------------------------------ *
 * Colour model
 * ------------------------------------------------------------------ */

/** sRGB in 0..1 (deliberately NOT clamped — lab()/oklch() can be out of gamut) plus alpha 0..1. */
type RGBA = { r: number; g: number; b: number; a: number }

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)
const clamp01 = (n: number) => clamp(n, 0, 1)

const OUTPUTS = [
  'hex',
  'hex-alpha',
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'named',
  'all'
] as const
type Output = (typeof OUTPUTS)[number]

/* --- transfer functions (sign preserving, per CSS Color 4) --------- */

const srgbToLinear = (c: number) => {
  const sign = c < 0 ? -1 : 1
  const abs = Math.abs(c)
  return abs <= 0.04045 ? c / 12.92 : sign * Math.pow((abs + 0.055) / 1.055, 2.4)
}

const linearToSrgb = (c: number) => {
  const sign = c < 0 ? -1 : 1
  const abs = Math.abs(c)
  return abs <= 0.0031308 ? c * 12.92 : sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055)
}

const mul = (m: number[][], v: number[]) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
]

const LIN_SRGB_TO_XYZ65 = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607]
]
const XYZ65_TO_LIN_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]
]
const XYZ65_TO_XYZ50 = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008]
]
const XYZ50_TO_XYZ65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]
]
const XYZ65_TO_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309]
]
const LMS_TO_OKLAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]
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

/** CIE standard illuminant D50, the white point CSS `lab()`/`lch()` are relative to. */
const D50 = [0.3457 / 0.3585, 1.0, (1.0 - 0.3457 - 0.3585) / 0.3585]
const LAB_E = 216 / 24389
const LAB_K = 24389 / 27

const rgbToLab = (rgb: number[]): number[] => {
  const xyz = mul(XYZ65_TO_XYZ50, mul(LIN_SRGB_TO_XYZ65, rgb.map(srgbToLinear)))
  const f = xyz.map((v, i) => {
    const t = v / D50[i]
    return t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116
  })
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
}

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

const rgbToOklab = (rgb: number[]): number[] => {
  const lms = mul(XYZ65_TO_LMS, mul(LIN_SRGB_TO_XYZ65, rgb.map(srgbToLinear)))
  return mul(LMS_TO_OKLAB, lms.map(Math.cbrt))
}

const oklabToRgb = (lab: number[]): number[] => {
  const lms = mul(OKLAB_TO_LMS, lab).map((v) => v * v * v)
  return mul(XYZ65_TO_LIN_SRGB, mul(LMS_TO_XYZ65, lms)).map(linearToSrgb)
}

/** Rectangular -> polar. Tiny chroma is snapped to hue 0 so grey stays grey. */
const toPolar = (rect: number[]): number[] => {
  const [L, a, b] = rect
  const c = Math.sqrt(a * a + b * b)
  const h = c < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return [L, c, h]
}
const fromPolar = (polar: number[]): number[] => {
  const [L, c, h] = polar
  const rad = (h * Math.PI) / 180
  return [L, c * Math.cos(rad), c * Math.sin(rad)]
}

/* --- hsl / hwb ---------------------------------------------------- */

/** Hue in degrees, saturation/lightness 0..1, from clamped sRGB. */
const rgbToHsl = (r: number, g: number, b: number): number[] => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return [h, clamp01(s), clamp01(l)]
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

const rgbToHwb = (r: number, g: number, b: number): number[] => {
  const [h] = rgbToHsl(r, g, b)
  return [h, Math.min(r, g, b), 1 - Math.max(r, g, b)]
}

const hwbToRgb = (h: number, w: number, bl: number): number[] => {
  if (w + bl >= 1) {
    const grey = w / (w + bl)
    return [grey, grey, grey]
  }
  return hslToRgb(h, 1, 0.5).map((v) => v * (1 - w - bl) + w)
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

const bad = (text: string): never => {
  throw new Error(`invalid color: ${text.trim() || '(empty)'}`)
}

/** A bare CSS number, optionally signed / exponential. */
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

const asNumber = (token: string, text: string): number => {
  if (token === 'none') return 0
  if (!NUMBER_RE.test(token)) bad(text)
  return Number(token)
}

/**
 * `scale` is what 100% means. A bare number is taken at face value, which is
 * what every real-world colour string does (`hsl(120 50 50)` still works).
 */
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
  return clamp01(token.endsWith('%') ? asNumber(token.slice(0, -1), text) / 100 : asNumber(token, text))
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

/** Splits `a b c / d`, `a, b, c, d` and `a b c` into components + alpha. */
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
        fromPolar([asScaled(comps[0], 1, text), asScaled(comps[1], 0.4, text), asHue(comps[2], text)])
      )
      return { r, g, b, a }
    }
    default:
      return bad(text)
  }
}

/** Parses every notation this utility understands into unclamped sRGB + alpha. */
export function parseColor(raw: string): RGBA {
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
  // A bare hex without the `#` is common in config files. Only the 6/8-digit
  // forms are accepted — `add`, `bad`, `face` are words far more often than colours.
  if (/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) return parseHex(text, text)
  return bad(text)
}

/* ------------------------------------------------------------------ *
 * Serialising
 * ------------------------------------------------------------------ */

const fmt = (n: number, precision: number): string => {
  if (!Number.isFinite(n)) return '0'
  let s = n.toFixed(precision)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

const byte = (c: number) => Math.round(clamp01(c) * 255)
const hex2 = (n: number) => n.toString(16).padStart(2, '0')
const toHex6 = ({ r, g, b }: RGBA) => hex2(byte(r)) + hex2(byte(g)) + hex2(byte(b))

/** Alpha suffix for the CSS Color 4 functions, omitted when fully opaque. */
const slashAlpha = (a: number, precision: number) =>
  a >= 1 ? '' : ` / ${fmt(a, Math.max(precision, 2))}`

let _namedLab: { name: string; lab: number[] }[] | null = null
const namedLabTable = () =>
  (_namedLab ??= Object.entries(NAME_BY_HEX).map(([hex, name]) => {
    const c = parseHex(hex, hex)
    return { name, lab: rgbToLab([c.r, c.g, c.b]) }
  }))

/** Exact name when the colour is one, otherwise the perceptually nearest name. */
function toName(color: RGBA): { name: string; exact: boolean } {
  if (color.a === 0) return { name: 'transparent', exact: true }
  const hex = toHex6(color)
  if (hex in NAME_BY_HEX) return { name: NAME_BY_HEX[hex], exact: true }
  const target = rgbToLab([clamp01(color.r), clamp01(color.g), clamp01(color.b)])
  let best = namedLabTable()[0]
  let bestDist = Infinity
  for (const entry of namedLabTable()) {
    const d =
      Math.pow(entry.lab[0] - target[0], 2) +
      Math.pow(entry.lab[1] - target[1], 2) +
      Math.pow(entry.lab[2] - target[2], 2)
    if (d < bestDist) {
      bestDist = d
      best = entry
    }
  }
  return { name: best.name, exact: false }
}

function render(color: RGBA, to: Output, precision: number): string {
  const { a } = color
  const r = clamp01(color.r)
  const g = clamp01(color.g)
  const b = clamp01(color.b)

  switch (to) {
    case 'hex':
      return `#${toHex6(color)}`
    case 'hex-alpha':
      return `#${toHex6(color)}${hex2(Math.round(clamp01(a) * 255))}`
    case 'rgb':
      return `rgb(${byte(r)}, ${byte(g)}, ${byte(b)})`
    case 'rgba':
      return `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${fmt(a, Math.max(precision, 2))})`
    case 'hsl': {
      const [h, s, l] = rgbToHsl(r, g, b)
      return `hsl(${fmt(h, precision)}, ${fmt(s * 100, precision)}%, ${fmt(l * 100, precision)}%)`
    }
    case 'hsla': {
      const [h, s, l] = rgbToHsl(r, g, b)
      return `hsla(${fmt(h, precision)}, ${fmt(s * 100, precision)}%, ${fmt(l * 100, precision)}%, ${fmt(a, Math.max(precision, 2))})`
    }
    case 'hwb': {
      const [h, w, bl] = rgbToHwb(r, g, b)
      return `hwb(${fmt(h, precision)} ${fmt(w * 100, precision)}% ${fmt(bl * 100, precision)}%${slashAlpha(a, precision)})`
    }
    case 'lab': {
      const [L, la, lb] = rgbToLab([color.r, color.g, color.b])
      return `lab(${fmt(L, precision)} ${fmt(la, precision)} ${fmt(lb, precision)}${slashAlpha(a, precision)})`
    }
    case 'lch': {
      const [L, c, h] = toPolar(rgbToLab([color.r, color.g, color.b]))
      return `lch(${fmt(L, precision)} ${fmt(c, precision)} ${fmt(h, precision)}${slashAlpha(a, precision)})`
    }
    case 'oklab': {
      const [L, la, lb] = rgbToOklab([color.r, color.g, color.b])
      return `oklab(${fmt(L, precision)} ${fmt(la, precision)} ${fmt(lb, precision)}${slashAlpha(a, precision)})`
    }
    case 'oklch': {
      const [L, c, h] = toPolar(rgbToOklab([color.r, color.g, color.b]))
      return `oklch(${fmt(L, precision)} ${fmt(c, precision)} ${fmt(h, precision)}${slashAlpha(a, precision)})`
    }
    case 'named':
      return toName(color).name
    default:
      return bad(to)
  }
}

function describe(color: RGBA, source: string, precision: number): Record<string, unknown> {
  const named = toName(color)
  return {
    input: source,
    hex: render(color, 'hex', precision),
    hexAlpha: render(color, 'hex-alpha', precision),
    rgb: render(color, 'rgb', precision),
    rgba: render(color, 'rgba', precision),
    hsl: render(color, 'hsl', precision),
    hsla: render(color, 'hsla', precision),
    hwb: render(color, 'hwb', precision),
    lab: render(color, 'lab', precision),
    lch: render(color, 'lch', precision),
    oklab: render(color, 'oklab', precision),
    oklch: render(color, 'oklch', precision),
    named: named.name,
    namedExact: named.exact,
    alpha: Number(fmt(color.a, Math.max(precision, 4))),
    components: { r: byte(color.r), g: byte(color.g), b: byte(color.b) }
  }
}

/* ------------------------------------------------------------------ *
 * Utility
 * ------------------------------------------------------------------ */

const asBool = (value: unknown, fallback: boolean) =>
  value === undefined || value === null || value === '' ? fallback : !!value

const util: Utility = {
  id: 'color_convert',
  name: 'color convert',
  category: 'Color',
  description:
    'Convert a CSS color — hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a named color — into any other notation, one per line, with "all" producing every notation as JSON.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['color', 'css', 'hex', 'rgb', 'hsl', 'hwb', 'lab', 'oklch', 'convert'],
  examples: [
    {
      title: 'named color to hsl',
      input: 'red',
      params: { to: 'hsl', perLine: true, precision: 2 },
      output: 'hsl(0, 100%, 50%)'
    },
    {
      title: 'hex to every notation',
      input: '#336699',
      params: { to: 'all', perLine: true, precision: 2 },
      output:
        '{\n  "input": "#336699",\n  "hex": "#336699",\n  "hexAlpha": "#336699ff",\n  "rgb": "rgb(51, 102, 153)",\n  "rgba": "rgba(51, 102, 153, 1)",\n  "hsl": "hsl(210, 50%, 40%)",\n  "hsla": "hsla(210, 50%, 40%, 1)",\n  "hwb": "hwb(210 20% 40%)",\n  "lab": "lab(41.52 -4.57 -33.49)",\n  "lch": "lch(41.52 33.8 262.23)",\n  "oklab": "oklab(0.5 -0.03 -0.09)",\n  "oklch": "oklch(0.5 0.1 250.43)",\n  "named": "steelblue",\n  "namedExact": false,\n  "alpha": 1,\n  "components": {\n    "r": 51,\n    "g": 102,\n    "b": 153\n  }\n}'
    }
  ],
  params: {
    to: {
      kind: 'select',
      label: 'convert to',
      options: [...OUTPUTS],
      default: 'hex'
    },
    perLine: { kind: 'boolean', label: 'one color per line', default: true },
    precision: { kind: 'number', label: 'decimal places', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, params: any): any => {
    const rawTo = String(params?.to ?? '') || 'hex'
    if (!(OUTPUTS as readonly string[]).includes(rawTo)) {
      throw new Error(`unknown output format: ${rawTo} (expected ${OUTPUTS.join(', ')})`)
    }
    const to = rawTo as Output
    const perLine = asBool(params?.perLine, true)
    const rawPrecision = Number(params?.precision)
    const precision = Number.isFinite(rawPrecision) ? clamp(Math.trunc(rawPrecision), 0, 10) : 2

    const text = String(input ?? '')
    if (!text.trim()) return to === 'all' ? {} : ''

    const sources = perLine ? text.split(/\r?\n/) : [text]

    if (to === 'all') {
      const results = sources
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => describe(parseColor(line), line, precision))
      if (results.length === 0) return {}
      return results.length === 1 ? results[0] : results
    }

    return sources
      .map((line) => (line.trim() ? render(parseColor(line.trim()), to, precision) : ''))
      .join('\n')
  }
}

export default util
