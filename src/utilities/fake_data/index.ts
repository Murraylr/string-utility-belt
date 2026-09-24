import type { Utility, Value } from '@/types/utility'

/* -------------------------------------------------------------------------- */
/* randomness                                                                  */
/* -------------------------------------------------------------------------- */

/** Deterministic 32-bit PRNG — same seed always yields the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cryptoFloat(): number {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    c.getRandomValues(buf)
    return buf[0] / 4294967296
  }
  return Math.random()
}

/** seed === 0 ⇒ real randomness; any other seed ⇒ reproducible stream. */
function makeRng(seed: unknown): () => number {
  const s = Math.trunc(Number(seed) || 0)
  return s === 0 ? cryptoFloat : mulberry32(s)
}

/* -------------------------------------------------------------------------- */
/* embedded data                                                               */
/* -------------------------------------------------------------------------- */

const FIRST_NAMES = [
  'Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Logan',
  'Mia', 'Lucas', 'Charlotte', 'Jackson', 'Amelia', 'Aiden', 'Harper', 'Elijah', 'Evelyn', 'James',
  'Abigail', 'Benjamin', 'Emily', 'Sebastian', 'Elizabeth', 'Henry', 'Sofia', 'Alexander', 'Avery', 'Daniel',
  'Ella', 'Matthew', 'Scarlett', 'Samuel', 'Grace', 'David', 'Chloe', 'Joseph', 'Victoria', 'Carter',
  'Riley', 'Owen', 'Aria', 'Wyatt', 'Lily', 'John', 'Aubrey', 'Jack', 'Zoey', 'Luke',
  'Penelope', 'Julian', 'Layla', 'Levi', 'Nora', 'Isaac', 'Hazel', 'Gabriel', 'Violet', 'Anthony'
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes'
]

const CITIES = [
  'Springfield', 'Riverton', 'Fairview', 'Georgetown', 'Kingston', 'Salem', 'Ashland', 'Clinton',
  'Madison', 'Arlington', 'Bristol', 'Burlington', 'Dover', 'Auburn', 'Milton', 'Newport',
  'Oxford', 'Hudson', 'Lexington', 'Manchester', 'Oakland', 'Portland', 'Richmond', 'Winchester',
  'Concord', 'Trenton', 'Chester', 'Lincoln', 'Marion', 'Greenville', 'Franklin', 'Bloomington',
  'Cedar Falls', 'Lakewood', 'Brookfield', 'Westfield', 'Northfield', 'Summit', 'Redwood City', 'Silverton'
]

const STREETS = [
  'Maple', 'Oak', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lake', 'Hill', 'Walnut', 'Spruce',
  'Sunset', 'Willow', 'Highland', 'Chestnut', 'Birch', 'Ridge', 'River', 'Meadow', 'Park', 'Forest',
  'Franklin', 'Jackson', 'Jefferson', 'Lincoln', 'Madison', 'Adams', 'Broadway', 'Church', 'Center', 'Union',
  'Market', 'Water', 'Spring', 'School', 'Prospect', 'Summit', 'Valley', 'Bridge', 'Dogwood', 'Juniper'
]

const STREET_SUFFIXES = ['St', 'Ave', 'Rd', 'Dr', 'Ln', 'Blvd', 'Ct', 'Way', 'Ter', 'Pl']

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

// Reserved-for-fiction style domains, so generated data can never hit a real host.
const DOMAINS = [
  'northwind.example', 'contoso.example', 'fabrikam.example', 'adventure-works.example',
  'litware.example', 'proseware.example', 'wingtiptoys.example', 'tailspintoys.example',
  'wideworldimporters.example', 'lucernepublishing.example', 'cohovineyard.example', 'fourthcoffee.example',
  'blueyonder.example', 'alpineskihouse.example', 'treyresearch.example', 'woodgrovebank.example',
  'humongousinsurance.example', 'margiestravel.example', 'relecloud.example', 'vanarsdel.example',
  'graphicdesigninstitute.example', 'thephonecompany.example', 'consolidatedmessenger.example',
  'southridgevideo.example', 'bellowscollege.example', 'munsonspickles.example', 'nodpublishers.example',
  'firstupconsultants.example', 'cronusenergy.example', 'lamnahealthcare.example',
  'worldwideimporters.example', 'fincordfinance.example'
]

const COMPANIES = [
  'Northwind Traders', 'Contoso Ltd', 'Fabrikam Inc', 'Adventure Works',
  'Litware Inc', 'Proseware Inc', 'Wingtip Toys', 'Tailspin Toys',
  'Wide World Importers', 'Lucerne Publishing', 'Coho Vineyard', 'Fourth Coffee',
  'Blue Yonder Airlines', 'Alpine Ski House', 'Trey Research', 'Woodgrove Bank',
  'Humongous Insurance', "Margie's Travel", 'Relecloud', 'Van Arsdel Ltd',
  'Graphic Design Institute', 'The Phone Company', 'Consolidated Messenger',
  'Southridge Video', 'Bellows College', "Munson's Pickles", 'Nod Publishers',
  'First Up Consultants', 'Cronus Energy', 'Lamna Healthcare',
  'Worldwide Importers', 'Fincord Finance'
]

const COUNTRIES = [
  'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'United Kingdom', 'Ireland', 'France',
  'Germany', 'Spain', 'Portugal', 'Italy', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czechia', 'Hungary', 'Greece',
  'Turkey', 'Ukraine', 'Romania', 'Japan', 'China', 'South Korea', 'India', 'Indonesia',
  'Vietnam', 'Thailand', 'Philippines', 'Australia', 'New Zealand', 'South Africa', 'Kenya', 'Nigeria',
  'Egypt', 'Morocco'
]

const JOB_TITLES = [
  'Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer',
  'DevOps Engineer', 'QA Engineer', 'Marketing Manager', 'Sales Representative',
  'Account Executive', 'HR Coordinator', 'Financial Analyst', 'Project Manager',
  'Systems Administrator', 'Database Administrator', 'Technical Writer', 'Customer Success Manager',
  'Business Analyst', 'Research Scientist', 'Graphic Designer', 'Operations Manager',
  'Security Engineer', 'Site Reliability Engineer', 'Frontend Developer', 'Backend Developer',
  'Mobile Developer', 'Machine Learning Engineer', 'Solutions Architect', 'Chief Technology Officer',
  'Office Manager', 'Legal Counsel', 'Content Strategist', 'Support Specialist'
]

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
  'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim',
  'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip',
  'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat',
  'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim',
  'id', 'est', 'laborum', 'accusantium', 'doloremque', 'laudantium', 'totam', 'rem', 'aperiam', 'eaque'
]

const AREA_CODES = [
  201, 202, 203, 205, 206, 212, 213, 214, 301, 303, 305, 310, 312, 313, 404, 415,
  503, 505, 512, 602, 608, 617, 702, 703, 801, 808, 904, 917
]

const CARD_BRANDS: { prefix: string; length: number }[] = [
  { prefix: '4', length: 16 },
  { prefix: '51', length: 16 },
  { prefix: '52', length: 16 },
  { prefix: '53', length: 16 },
  { prefix: '54', length: 16 },
  { prefix: '55', length: 16 },
  { prefix: '6011', length: 16 },
  { prefix: '34', length: 15 },
  { prefix: '37', length: 15 }
]

/* -------------------------------------------------------------------------- */
/* field generators                                                            */
/* -------------------------------------------------------------------------- */

type Rng = () => number

const pick = <T,>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)]
const randInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1))
const pad = (n: number, width: number): string => String(n).padStart(width, '0')

function makeEmail(rng: Rng, first: string, last: string): string {
  const domain = pick(rng, DOMAINS)
  const suffix = rng() < 0.35 ? String(randInt(rng, 1, 99)) : ''
  return `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@${domain}`
}

function makeUsername(rng: Rng, first: string, last: string): string {
  return `${first[0]}${last}${randInt(rng, 1, 999)}`.toLowerCase()
}

function makePhone(rng: Rng): string {
  // 555-01xx is the block reserved for fictitious numbers.
  return `+1 (${pick(rng, AREA_CODES)}) 555-${pad(randInt(rng, 100, 199), 4)}`
}

function makeStreetAddress(rng: Rng): string {
  return `${randInt(rng, 1, 9999)} ${pick(rng, STREETS)} ${pick(rng, STREET_SUFFIXES)}`
}

function makeAddress(rng: Rng): string {
  return `${makeStreetAddress(rng)}, ${pick(rng, CITIES)}, ${pick(rng, STATES)} ${pad(randInt(rng, 1001, 99950), 5)}`
}

function makeSentence(rng: Rng): string {
  const n = randInt(rng, 6, 14)
  const words: string[] = []
  for (let i = 0; i < n; i++) words.push(pick(rng, WORDS))
  const s = words.join(' ')
  return `${s[0].toUpperCase()}${s.slice(1)}.`
}

function makeUrl(rng: Rng): string {
  const segments = randInt(rng, 1, 3)
  const parts: string[] = []
  for (let i = 0; i < segments; i++) parts.push(pick(rng, WORDS))
  return `https://${pick(rng, DOMAINS)}/${parts.join('-')}`
}

function makeIpv4(rng: Rng): string {
  // 1–223 avoids 0.x and the multicast/reserved space above 223.
  return `${randInt(rng, 1, 223)}.${randInt(rng, 0, 255)}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}`
}

function makeMac(rng: Rng): string {
  const bytes: number[] = []
  for (let i = 0; i < 6; i++) bytes.push(randInt(rng, 0, 255))
  // unicast + locally administered, so the address can never be a real OUI
  bytes[0] = (bytes[0] & 0xfe) | 0x02
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(':')
}

function makeDate(rng: Rng): string {
  const year = randInt(rng, 2000, 2030)
  const month = randInt(rng, 1, 12)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad(month, 2)}-${pad(randInt(rng, 1, daysInMonth), 2)}`
}

function makePrice(rng: Rng): string {
  return `$${(randInt(rng, 99, 99999) / 100).toFixed(2)}`
}

function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true // the check digit position doubles the digit to its left
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    double = !double
    sum += d
  }
  return (10 - (sum % 10)) % 10
}

function makeCreditCard(rng: Rng): string {
  const brand = pick(rng, CARD_BRANDS)
  let digits = brand.prefix
  while (digits.length < brand.length - 1) digits += String(randInt(rng, 0, 9))
  return digits + String(luhnCheckDigit(digits))
}

type Row = Record<string, string | number>

const ROW_FIELDS = [
  'id', 'firstName', 'lastName', 'email', 'username', 'phone', 'address',
  'city', 'country', 'company', 'jobTitle', 'url', 'ipv4', 'date', 'price'
]

function makeRow(rng: Rng, id: number): Row {
  const first = pick(rng, FIRST_NAMES)
  const last = pick(rng, LAST_NAMES)
  return {
    id,
    firstName: first,
    lastName: last,
    email: makeEmail(rng, first, last),
    username: makeUsername(rng, first, last),
    phone: makePhone(rng),
    address: makeAddress(rng),
    city: pick(rng, CITIES),
    country: pick(rng, COUNTRIES),
    company: pick(rng, COMPANIES),
    jobTitle: pick(rng, JOB_TITLES),
    url: makeUrl(rng),
    ipv4: makeIpv4(rng),
    date: makeDate(rng),
    price: makePrice(rng)
  }
}

const TYPES = [
  'name', 'first-name', 'last-name', 'email', 'username', 'phone', 'address', 'city', 'country',
  'company', 'job-title', 'sentence', 'url', 'domain', 'ipv4', 'mac', 'date', 'price',
  'credit-card', 'row'
]

function makeScalar(rng: Rng, type: string): string {
  switch (type) {
    case 'name': return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
    case 'first-name': return pick(rng, FIRST_NAMES)
    case 'last-name': return pick(rng, LAST_NAMES)
    case 'email': return makeEmail(rng, pick(rng, FIRST_NAMES), pick(rng, LAST_NAMES))
    case 'username': return makeUsername(rng, pick(rng, FIRST_NAMES), pick(rng, LAST_NAMES))
    case 'phone': return makePhone(rng)
    case 'address': return makeAddress(rng)
    case 'city': return pick(rng, CITIES)
    case 'country': return pick(rng, COUNTRIES)
    case 'company': return pick(rng, COMPANIES)
    case 'job-title': return pick(rng, JOB_TITLES)
    case 'sentence': return makeSentence(rng)
    case 'url': return makeUrl(rng)
    case 'domain': return pick(rng, DOMAINS)
    case 'ipv4': return makeIpv4(rng)
    case 'mac': return makeMac(rng)
    case 'date': return makeDate(rng)
    case 'price': return makePrice(rng)
    case 'credit-card': return makeCreditCard(rng)
    default: throw new Error(`unknown type: ${type}`)
  }
}

/* -------------------------------------------------------------------------- */
/* output helpers                                                              */
/* -------------------------------------------------------------------------- */

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A single-line text input cannot hold a real newline, so accept `\n`, `\t`, … */
function unescapeSeparator(s: string): string {
  return s.replace(/\\([nrt0\\])/g, (_m, c: string) => {
    switch (c) {
      case 'n': return '\n'
      case 'r': return '\r'
      case 't': return '\t'
      case '0': return '\0'
      default: return '\\'
    }
  })
}

const MAX_COUNT = 10000

const util: Utility = {
  id: 'fake_data',
  name: 'fake data',
  category: 'Generators',
  description:
    'Generate placeholder data — names, emails, addresses, companies, cards and full rows — as lines, CSV or JSON, reproducibly when a seed is set.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['mock data', 'faker', 'test data', 'dummy data', 'placeholder', 'sample data', 'csv', 'seed data'],
  aliases: ['faker.js', 'mockaroo'],
  examples: [
    {
      title: 'seeded names, one per line',
      input: '',
      params: { type: 'name', count: 3, seed: 42 },
      output: 'Chloe Clark\nJulian Green\nMia Young'
    },
    {
      title: 'a row of fake data as JSON',
      input: '',
      params: { type: 'row', count: 1, format: 'json', seed: 7 },
      output: '[\n  {\n    "id": 1,\n    "firstName": "Olivia",\n    "lastName": "Brown",\n    "email": "olivia.brown@fincordfinance.example",\n    "username": "obrown521",\n    "phone": "+1 (310) 555-0146",\n    "address": "2400 Jefferson Way, Bristol, DE 76607",\n    "city": "Oakland",\n    "country": "Germany",\n    "company": "Fourth Coffee",\n    "jobTitle": "HR Coordinator",\n    "url": "https://tailspintoys.example/ad-aperiam",\n    "ipv4": "196.48.36.40",\n    "date": "2009-07-24",\n    "price": "$75.43"\n  }\n]'
    }
  ],
  params: {
    type: { kind: 'select', label: 'type', options: TYPES, default: 'name' },
    count: { kind: 'number', label: 'count', default: 5, min: 0, max: MAX_COUNT, integer: true },
    format: { kind: 'select', label: 'format', options: ['lines', 'json', 'csv'], default: 'lines' },
    separator: { kind: 'string', label: 'separator', default: '\n' },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (_input: any, params: any = {}): Value => {
    const type = String(params.type ?? 'name')
    if (!TYPES.includes(type)) throw new Error(`unknown type: ${type}`)

    const format = String(params.format ?? 'lines')
    if (!['lines', 'json', 'csv'].includes(format)) throw new Error(`unknown format: ${format}`)

    const rawCount = Number(params.count ?? 5)
    if (!Number.isFinite(rawCount)) throw new Error('count must be a number')
    const count = Math.trunc(rawCount)
    if (count < 0) throw new Error('count must be 0 or more')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)

    const separator = unescapeSeparator(
      params.separator === undefined || params.separator === null ? '\n' : String(params.separator)
    )
    const rng = makeRng(params.seed)

    if (type === 'row') {
      const rows: Row[] = []
      for (let i = 0; i < count; i++) rows.push(makeRow(rng, i + 1))

      if (format === 'json') return rows as unknown as Value
      const body = rows.map((r) => ROW_FIELDS.map((f) => csvCell(r[f])).join(',')).join(separator)
      if (format === 'csv') {
        const header = ROW_FIELDS.join(',')
        return count === 0 ? header : `${header}${separator}${body}`
      }
      return body
    }

    const items: string[] = []
    for (let i = 0; i < count; i++) items.push(makeScalar(rng, type))

    if (format === 'json') return items as unknown as Value
    if (format === 'csv') {
      const body = items.map(csvCell).join(separator)
      return count === 0 ? type : `${type}${separator}${body}`
    }
    return items.join(separator)
  }
}

export default util
