import { run } from '../harness'
import { each, laneStep, branch } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'

const SCHEDULE = '^\\s*(?:@[A-Za-z]+|[\\d*])'
const inner = {
  id: 'annotate', type: 'branch', enabled: true,
  branches: [
    [
      laneStep('fields', 'replace', { pattern: '^\\s*(@[A-Za-z]+|\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+).*$', replacement: '$1', regex: true, flags: '' }),
      laneStep('describe', 'cron_describe', { format: 'text', locale: 'en', verbose: false, use24Hour: true, dayOfWeekStartIndexZero: true, seconds: false }),
      laneStep('comment', 'replace', { pattern: '^([^\\n]*)[\\s\\S]*$', replacement: '# $1', regex: true, flags: '' }),
    ],
    [],
  ],
  merge: { mode: 'concat', separator: '\n' },
  condition: { kind: 'regex', pattern: SCHEDULE, flags: '' },
}
const steps = toPipelineSteps([each('per-line', { mode: 'lines' }, [inner as any], 'x')])
const crontab = `# m h  dom mon dow   command
SHELL=/bin/bash
MAILTO=ops@example.com
CRON_TZ=UTC

*/15 * * * * /usr/local/bin/healthcheck.sh >/dev/null 2>&1
0 2 * * * /usr/local/bin/backup.sh --target s3://backups.example.com
30 4 1,15 * * /opt/app/bin/rotate-logs
0 9 * * MON-FRI /opt/app/bin/report --email team@example.com
@reboot /opt/app/bin/start-worker
@daily  find /tmp -mtime +7 -delete
@weekly /usr/sbin/certbot renew --quiet
5 0 * * 0 root run-parts /etc/cron.weekly
0 22 * * 1-5   echo "date: \`date +\\%F\`" >> /var/log/x.log
   0 */6 * * *  indented.sh
`
const r = await run(crontab, steps)
console.log(r.out); console.log(r.errors)
const bad = await run('61 * * * * x\n0 0 31 2 * y\nfoo bar\n* * * *\n@hourly\n@bogus z\n0 0 * * * \n', steps)
console.log(bad.out); console.log(bad.errors, JSON.stringify(bad.result.items))
