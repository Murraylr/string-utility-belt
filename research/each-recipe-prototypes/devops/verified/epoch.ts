/**
 * Reviewed copy of ../epoch.ts. The draft converted EVERY space-separated word that
 * looked like an epoch, so byte counts silently became dates: a 1.2 GB Squid download
 * (1288490188 bytes -> 2010-10-31T01:56:28.000Z) and a 1 GiB file in find -printf
 * output (1073741824 -> 2004-01-10T13:37:04.000Z). This version converts only the
 * timestamp that STARTS a line (Squid, find -printf '%T@ …', epoch-first app logs,
 * Zeek TSV), and keeps the rest of the line byte for byte. Same samples, same goldens.
 */
process.env.NO_PROTO = '1'
import { proto, run } from '../../harness'
import { branch, each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe: draft } = await import('../epoch')

const LEADING_EPOCH = '^(?:1\\d{9}(?:\\.\\d+)?|1\\d{12})(?=\\s|$)'
const swap = {
  ...branch('swap-timestamp', [
    [
      laneStep('first-word', 'replace', { pattern: '^(\\S+)[\\s\\S]*$', replacement: '$1', regex: true, flags: '' }, { label: 'the timestamp' }),
      laneStep('to-date', 'timestamp_convert', { to: 'iso', timezone: 'UTC', perLine: true }, { label: 'epoch to ISO 8601' }),
    ],
    [laneStep('rest', 'replace', { pattern: '^\\S+', replacement: '', regex: true, flags: '' }, { label: 'the rest of the line' })],
  ], { mode: 'concat', separator: '' }, '', { condition: { kind: 'regex', pattern: LEADING_EPOCH }, label: 'date for the leading timestamp' }),
}
delete (swap as any).why

export const recipe: Recipe = {
  ...draft,
  summary:
    'Paste a Squid access.log, find -printf output or any log whose lines start with a Unix epoch timestamp, and each one becomes a readable UTC date in place, with the rest of every line untouched.',
  steps: [
    each('per-line', { mode: 'lines' }, [swap as any],
      'Goes through the log line by line. When a line starts with a 10-digit epoch in seconds (fractions allowed) or a 13-digit epoch in milliseconds, that timestamp becomes an ISO 8601 date in UTC. Numbers later in the line, such as byte counts, stay as they are.',
      { label: 'convert timestamps' }),
  ],
}

if (!process.env.NO_PROTO_VERIFIED) {
  await proto(recipe)
  const steps = toPipelineSteps(recipe.steps)
  const cases: Record<string, string> = {
    squidBigDownload: '1791446459.912  98012 192.0.2.44 TCP_MISS/200 1288490188 GET http://mirror.example.org/ubuntu.iso - HIER_DIRECT/203.0.113.7 application/octet-stream\n',
    findBigFile: '1788703200.5124379010 1073741824 ./images/disk.img\n',
    zeekTsv: '1791446400.104\tCHhAvVGS1DHFjwGM9\t192.0.2.1\t51234\n',
    crlf: '1791446400.104 a\r\n1791446401 b\r\n',
    idMidLine: 'order 1234567890 shipped\n',
    leadingSpace: '  1791446400 indented\n',
    epochOnly: '1791446400\n',
    nanos: '1791446400123456789 docker\n',
  }
  for (const [k, v] of Object.entries(cases)) {
    const r = await run(v, steps)
    console.log(`## ${k}`, JSON.stringify(r.errors)); console.log(JSON.stringify(r.out))
  }
}
