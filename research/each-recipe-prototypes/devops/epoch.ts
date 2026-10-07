import { proto } from '../harness'
import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

const EPOCH = '^1\\d{9}(?:\\.\\d+)?$|^1\\d{12}$'
const inner = each('per-word', { mode: 'delimiter', separator: ' ' }, [
  laneStep('to-date', 'timestamp_convert', { to: 'iso', timezone: 'UTC', perLine: true }, { condition: { kind: 'regex', pattern: EPOCH }, label: 'epoch to ISO 8601' }),
], '')
delete (inner as any).why

export const recipe: Recipe = {
  slug: 'convert-epoch-timestamps-in-logs',
  name: 'Convert Unix timestamps in a log to dates',
  summary:
    'Paste a Squid access.log, an nginx log with $msec or find -printf output and every Unix epoch timestamp becomes a readable UTC date in place, with the rest of each line untouched.',
  category: 'DevOps & Config',
  primaryQuery: 'convert epoch time in log file',
  published: '2026-10-08',
  steps: [
    each('per-line', { mode: 'lines' }, [inner as any],
      'Splits the log into lines and each line into space-separated words. A word that is a 10-digit epoch in seconds (fractions allowed) or a 13-digit epoch in milliseconds becomes an ISO 8601 date in UTC; every other word and every run of spaces is put back as it was.',
      { label: 'convert timestamps' }),
  ],
  samples: [
    {
      id: 'squid',
      title: 'Squid access.log',
      input: `1791446400.104    182 192.0.2.10 TCP_MISS/200 4127 GET http://www.example.com/ - HIER_DIRECT/198.51.100.20 text/html
1791446401.377     12 192.0.2.10 TCP_MEM_HIT/200 913 GET http://www.example.com/favicon.ico - HIER_NONE/- image/x-icon
1791446459.912   1206 192.0.2.44 TCP_TUNNEL/200 51234 CONNECT api.example.org:443 - HIER_DIRECT/203.0.113.7 -
1791446522.050      0 192.0.2.61 TCP_DENIED/403 3940 GET http://blocked.example.net/ - HIER_NONE/- text/html
`,
      output: `2026-10-08T08:00:00.104Z    182 192.0.2.10 TCP_MISS/200 4127 GET http://www.example.com/ - HIER_DIRECT/198.51.100.20 text/html
2026-10-08T08:00:01.377Z     12 192.0.2.10 TCP_MEM_HIT/200 913 GET http://www.example.com/favicon.ico - HIER_NONE/- image/x-icon
2026-10-08T08:00:59.912Z   1206 192.0.2.44 TCP_TUNNEL/200 51234 CONNECT api.example.org:443 - HIER_DIRECT/203.0.113.7 -
2026-10-08T08:02:02.050Z      0 192.0.2.61 TCP_DENIED/403 3940 GET http://blocked.example.net/ - HIER_NONE/- text/html
`,
    },
    {
      id: 'find-printf',
      title: "find -printf '%T@ %s %p'",
      input: `1786024800.0000000000 1048576 ./backups/db-2026-08-06.sql.gz
1788703200.5124379010 2097152 ./backups/db-2026-09-06.sql.gz
1791295200.2381904630 3145728 ./backups/db-2026-10-06.sql.gz
`,
      output: `2026-08-06T14:00:00.000Z 1048576 ./backups/db-2026-08-06.sql.gz
2026-09-06T14:00:00.512Z 2097152 ./backups/db-2026-09-06.sql.gz
2026-10-06T14:00:00.238Z 3145728 ./backups/db-2026-10-06.sql.gz
`,
    },
    {
      id: 'millis',
      title: 'App log with epoch milliseconds',
      input: `1791450000123 INFO  worker-3 job=invoice-export started
1791450012456 WARN  worker-3 job=invoice-export retry=1 delay=30s
1791450043001 INFO  worker-3 job=invoice-export finished rows=1250
`,
      output: `2026-10-08T09:00:00.123Z INFO  worker-3 job=invoice-export started
2026-10-08T09:00:12.456Z WARN  worker-3 job=invoice-export retry=1 delay=30s
2026-10-08T09:00:43.001Z INFO  worker-3 job=invoice-export finished rows=1250
`,
    },
  ],
}
if (!process.env.NO_PROTO) await proto(recipe)
