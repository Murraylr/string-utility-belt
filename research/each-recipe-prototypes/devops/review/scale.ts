process.env.NO_PROTO = '1'
process.env.NO_PROTO_VERIFIED = '1'
import { readFileSync } from 'node:fs'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const draft = (await import('../epoch')).recipe
const fixed = (await import('../verified/epoch')).recipe
const ssh = (await import('../ssh-fp')).recipe
const cron = (await import('../verified/crontab')).recipe
const line = (i: number) => `${1791446400 + i}.104    182 192.0.2.10 TCP_MISS/200 4127 GET http://www.example.com/p/${i} - HIER_DIRECT/198.51.100.20 text/html`
for (const n of [5000, 7000, 20000]) {
  const log = Array.from({ length: n }, (_, i) => line(i)).join('\n') + '\n'
  for (const [name, r] of [['draft', draft], ['fixed', fixed]] as const) {
    const t = Date.now(); const res = await run(log, toPipelineSteps(r.steps))
    console.log(`epoch ${name} ${n} lines: ${Date.now() - t} ms, errors: ${JSON.stringify(res.errors).slice(0, 160)}`)
  }
}
const keys = JSON.parse(readFileSync(new URL('./keys.json', import.meta.url), 'utf8')).keys
const ak = Array.from({ length: 3000 }, (_, i) => keys[i % keys.length].line + ` u${i}@example.com`).join('\n')
let t = Date.now(); let res = await run(ak, toPipelineSteps(ssh.steps)); console.log(`ssh 3000 keys: ${Date.now() - t} ms`, JSON.stringify(res.errors).slice(0, 100))
const ct = Array.from({ length: 2000 }, (_, i) => `${i % 60} ${i % 24} * * * /opt/job${i}`).join('\n')
t = Date.now(); res = await run(ct, toPipelineSteps(cron.steps)); console.log(`cron 2000 jobs: ${Date.now() - t} ms`, JSON.stringify(res.errors).slice(0, 100))
