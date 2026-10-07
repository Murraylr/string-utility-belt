import { proto } from '../harness'
import { branch, each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

const describeLine = {
  ...branch('describe-line', [
    [
      laneStep('schedule', 'replace', { pattern: '^\\s*(@[A-Za-z]+|\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+).*$', replacement: '$1', regex: true, flags: '' }, { label: 'keep the five time fields' }),
      laneStep('describe', 'cron_describe', { format: 'text', locale: 'en', verbose: false, use24Hour: true, dayOfWeekStartIndexZero: true, seconds: false }),
      laneStep('as-comment', 'replace', { pattern: '^([^\\n]*)[\\s\\S]*$', replacement: '# $1', regex: true, flags: '' }, { label: 'first line as a comment' }),
    ],
    [],
  ], { mode: 'concat', separator: '\n' }, '', { condition: { kind: 'regex', pattern: '^\\s*(?:@[A-Za-z]|[\\d*])' }, label: 'comment above each job' }),
}
delete (describeLine as any).why

export const recipe: Recipe = {
  slug: 'explain-crontab-file',
  name: 'Explain every job in a crontab',
  summary:
    'Paste the output of crontab -l, /etc/crontab or a cron.d file and get it back with a plain-English comment above every job, while comments, variables and commands stay exactly as they were.',
  category: 'DevOps & Config',
  primaryQuery: 'explain crontab file',
  published: '2026-10-08',
  related: ['fix-bash-bad-interpreter'],
  steps: [
    each('per-line', { mode: 'lines' }, [describeLine as any],
      'Goes through the crontab line by line. A line that starts with a schedule (a digit, * or an @ macro such as @daily) gets its schedule described in plain English in a comment above it. Comments, blank lines and settings such as MAILTO pass through, so the result is still a valid crontab.',
      { label: 'describe every job' }),
  ],
  samples: [
    {
      id: 'user-crontab',
      title: 'crontab -l of an app server',
      input: `MAILTO=ops@example.com
PATH=/usr/local/bin:/usr/bin:/bin

# m h  dom mon dow   command
*/5 * * * * /opt/shop/bin/queue-worker --once >> /var/log/shop/queue.log 2>&1
0 2 * * * /opt/shop/bin/backup-db --to s3://backups.example.com/shop
30 6 * * 1-5 /opt/shop/bin/send-report --to team@example.com
15 3 1,15 * * /opt/shop/bin/rotate-invoices
@reboot /opt/shop/bin/start-worker
@weekly /usr/bin/docker system prune -af
`,
      output: `MAILTO=ops@example.com
PATH=/usr/local/bin:/usr/bin:/bin

# m h  dom mon dow   command
# Every 5 minutes
*/5 * * * * /opt/shop/bin/queue-worker --once >> /var/log/shop/queue.log 2>&1
# At 02:00
0 2 * * * /opt/shop/bin/backup-db --to s3://backups.example.com/shop
# At 06:30, Monday through Friday
30 6 * * 1-5 /opt/shop/bin/send-report --to team@example.com
# At 03:15, on day 1 and 15 of the month
15 3 1,15 * * /opt/shop/bin/rotate-invoices
# At system startup
@reboot /opt/shop/bin/start-worker
# At 00:00, only on Sunday
@weekly /usr/bin/docker system prune -af
`,
    },
    {
      id: 'etc-crontab',
      title: 'Debian /etc/crontab (with user field)',
      input: `# /etc/crontab: system-wide crontab
SHELL=/bin/sh

# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat
# |  |  |  |  |
# *  *  *  *  * user-name command to be executed
17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly
25 6\t* * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }
47 6\t* * 7\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }
52 6\t1 * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }
#
`,
      output: `# /etc/crontab: system-wide crontab
SHELL=/bin/sh

# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat
# |  |  |  |  |
# *  *  *  *  * user-name command to be executed
# At 17 minutes past the hour
17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly
# At 06:25
25 6\t* * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }
# At 06:47, only on Sunday
47 6\t* * 7\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }
# At 06:52, on day 1 of the month
52 6\t1 * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }
#
`,
    },
    {
      id: 'cron-d-names',
      title: '/etc/cron.d file with names and ranges',
      input: `# /etc/cron.d/reporting
CRON_TZ=UTC
SHELL=/bin/bash

*/10 8-18 * * mon-fri  reporting  /srv/reporting/bin/refresh-dashboards
0 4 * jan,jul sun  reporting  /srv/reporting/bin/archive-half-year
0 0 1 * MON  reporting  /srv/reporting/bin/monthly-or-monday
@hourly  reporting  /srv/reporting/bin/sync-exchange-rates
`,
      output: `# /etc/cron.d/reporting
CRON_TZ=UTC
SHELL=/bin/bash

# Every 10 minutes, between 08:00 and 18:59, Monday through Friday
*/10 8-18 * * mon-fri  reporting  /srv/reporting/bin/refresh-dashboards
# At 04:00, only on Sunday, only in January and July
0 4 * jan,jul sun  reporting  /srv/reporting/bin/archive-half-year
# At 00:00, on day 1 of the month, and on Monday
0 0 1 * MON  reporting  /srv/reporting/bin/monthly-or-monday
# Every hour
@hourly  reporting  /srv/reporting/bin/sync-exchange-rates
`,
    },
  ],
}
if (!process.env.NO_PROTO) await proto(recipe)
