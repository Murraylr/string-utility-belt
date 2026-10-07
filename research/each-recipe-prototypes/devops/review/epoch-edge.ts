process.env.NO_PROTO = '1'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('../epoch')
const steps = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  squidBigDownload: '1791446459.912  98012 192.0.2.44 TCP_MISS/200 1288490188 GET http://mirror.example.org/ubuntu.iso - HIER_DIRECT/203.0.113.7 application/octet-stream\n',
  findBigFile: '1788703200.5124379010 1073741824 ./images/disk.img\n',
  nginxMsec: '192.0.2.1 - - 1791446400.104 "GET / HTTP/1.1" 200 612\n',
  jsonLog: '{"ts":1791446400.104,"level":"info","msg":"started"}\n',
  auditd: 'type=SYSCALL msg=audit(1791446400.104:3021): arch=c000003e\n',
  phoneLike: 'user 1555123456 called\n',
  zeekTsv: '1791446400.104\tCHhAvVGS1DHFjwGM9\t192.0.2.1\n',
  commaAfter: 'started at 1791446400, done\n',
  unicodeLine: '1791446400 ✓ déploiement terminé\n',
  longLine: '1791446400 ' + 'x '.repeat(20000) + '\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log(`## ${k}`, JSON.stringify(r.errors)); console.log(r.out.slice(0, 250))
}
