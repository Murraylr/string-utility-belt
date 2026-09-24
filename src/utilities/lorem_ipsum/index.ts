import type { Utility } from '@/types/utility'

/** The canonical opening, used when `startWithLorem` is on. */
const OPENER =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua.'

const OPENER_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
  'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua'
]

/** Classic lorem vocabulary; deduplicated so the sampler does not favour repeats. */
const WORDS: string[] = Array.from(
  new Set(
    (
      'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ' +
      'ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco ' +
      'laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate ' +
      'velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident ' +
      'sunt culpa qui officia deserunt mollit anim id est laborum at vero eos accusamus iusto ' +
      'odio dignissimos ducimus blanditiis praesentium voluptatum deleniti atque corrupti quos ' +
      'dolores quas molestias excepturi occaecati cupiditate provident similique mollitia animi ' +
      'dolorum fuga harum quidem rerum facilis expedita distinctio nam libero tempore cum soluta ' +
      'nobis eligendi optio cumque nihil impedit quo minus quod maxime placeat facere possimus ' +
      'omnis voluptas assumenda repellendus temporibus autem quibusdam necessitatibus saepe ' +
      'eveniet voluptates repudiandae recusandae itaque earum hic tenetur sapiente delectus ' +
      'reiciendis maiores alias perferendis doloribus asperiores repellat sequi nesciunt neque ' +
      'porro quisquam dolorem adipisci numquam eius modi tempora incidunt magnam quaerat ' +
      'voluptatem aliquam consectetuer suscipit laboriosam aliquid commodi autem vel illum ' +
      'perspiciatis unde iste natus error accusantium doloremque laudantium totam aperiam eaque ' +
      'ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta explicabo'
    ).split(' ')
  )
)

type Rng = () => number

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `crypto.getRandomValues` has real per-call overhead and this generator draws once per
 * word, so refill a block at a time. A megabyte of `bytes` output is ~250k draws, which
 * is one call per draw otherwise — on the pipeline's every-keystroke re-run.
 */
function cryptoRng(): Rng {
  const buf = new Uint32Array(256)
  let i = buf.length
  return () => {
    if (i >= buf.length) {
      crypto.getRandomValues(buf)
      i = 0
    }
    return buf[i++] / 4294967296
  }
}

const makeRng = (seed: number): Rng => (seed === 0 ? cryptoRng() : mulberry32(seed))

const word = (rng: Rng): string => WORDS[Math.floor(rng() * WORDS.length)]

function sentence(rng: Rng): string {
  const n = 6 + Math.floor(rng() * 9) // 6..14 words
  const parts: string[] = []
  for (let i = 0; i < n; i++) parts.push(word(rng))
  if (n > 8 && rng() < 0.5) {
    const at = 3 + Math.floor(rng() * (n - 5))
    parts[at] += ','
  }
  const text = parts.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

function paragraph(rng: Rng, opener: string | null): string {
  const n = 3 + Math.floor(rng() * 4) // 3..6 sentences
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(i === 0 && opener ? opener : sentence(rng))
  return out.join(' ')
}

const UNITS = ['paragraphs', 'sentences', 'words', 'bytes'] as const

const util: Utility = {
  id: 'lorem_ipsum',
  name: 'lorem ipsum',
  category: 'Generators',
  description:
    'Generate placeholder lorem ipsum text measured in paragraphs, sentences, words, or bytes, optionally wrapped in HTML paragraphs.',
  accepts: 'string',
  produces: 'string',
  tags: ['placeholder text', 'filler text', 'dummy text', 'latin', 'lipsum', 'greeking'],
  aliases: ['lipsum'],
  examples: [
    {
      title: 'five words, starting with "Lorem ipsum"',
      input: '',
      params: { unit: 'words', count: 5 },
      output: 'lorem ipsum dolor sit amet'
    },
    {
      title: 'seeded sentence without the classic opener',
      input: '',
      params: { unit: 'sentences', count: 1, startWithLorem: false, seed: 42 },
      output: 'Cupiditate laboriosam voluptates commodo libero cupidatat assumenda commodi animi pariatur unde.'
    }
  ],
  params: {
    unit: {
      kind: 'select',
      label: 'unit',
      options: ['paragraphs', 'sentences', 'words', 'bytes'],
      default: 'paragraphs'
    },
    count: { kind: 'number', label: 'count', default: 3, min: 0, max: 1000 },
    startWithLorem: { kind: 'boolean', label: 'start with "Lorem ipsum"', default: true },
    html: { kind: 'boolean', label: 'wrap in <p> tags', default: false },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (_input: any, p: any) => {
    const params = p ?? {}
    const unit = String(params.unit ?? 'paragraphs')
    const count = Math.floor(Number(params.count ?? 3))
    const startWithLorem = params.startWithLorem !== false
    const html = params.html === true
    const seedRaw = Number(params.seed ?? 0)
    const seed = Number.isFinite(seedRaw) ? Math.floor(seedRaw) : 0

    // validate the unit before any early return, so a bad unit is never silently accepted
    if (!(UNITS as readonly string[]).includes(unit)) throw new Error(`unknown unit "${unit}"`)
    if (!Number.isFinite(count) || count < 0) throw new Error('count must be zero or more')
    const max = unit === 'bytes' ? 1000000 : 10000
    if (count > max) throw new Error(`count must be ${max} or less for unit "${unit}"`)
    if (count === 0) return ''

    const rng = makeRng(seed)
    const wrap = (t: string) => (html ? `<p>${t}</p>` : t)

    switch (unit) {
      case 'paragraphs': {
        const parts: string[] = []
        for (let i = 0; i < count; i++) {
          parts.push(paragraph(rng, i === 0 && startWithLorem ? OPENER : null))
        }
        return html ? parts.map(wrap).join('\n') : parts.join('\n\n')
      }
      case 'sentences': {
        const parts: string[] = []
        for (let i = 0; i < count; i++) {
          parts.push(i === 0 && startWithLorem ? OPENER : sentence(rng))
        }
        return wrap(parts.join(' '))
      }
      case 'words': {
        const list: string[] = startWithLorem ? OPENER_WORDS.slice(0, count) : []
        while (list.length < count) list.push(word(rng))
        return wrap(list.slice(0, count).join(' '))
      }
      case 'bytes': {
        // the vocabulary is pure ASCII, so one character is one UTF-8 byte
        let text = startWithLorem ? OPENER : sentence(rng)
        while (text.length < count) text += ' ' + sentence(rng)
        return wrap(text.slice(0, count))
      }
      default:
        throw new Error(`unknown unit "${unit}"`)
    }
  }
}

export default util
