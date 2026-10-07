import { run } from '../../harness'
import { recipe } from '../idn-def'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { domainToASCII } from 'node:url'
const steps = toPipelineSteps(recipe.steps)
const lines = ['ΣΟΦΟΣ.example', 'σοφος.example', 'İstanbul.example', '*.bücher.example', '_dmarc.bücher.example', 'BÜCHER.EXAMPLE', 'ＢＵＣＨＥＲ.example', 'bü­cher.example', 'bü‍cher.example', 'XN--BCHER-KVA.example', '😀.example', 'bücher.example.', 'https://bücher.example/Pfad', '# Kommentar Über', 'bücher.example:8443', 'server_name bücher.example www.bücher.example;', '192.0.2.10 bücher.example', '\tbücher.example\t', 'faß.de', 'ⓑⓤⓒⓗⓔⓡ.example', 'bücher。example', 'bücher．example', 'bücher｡example', 'a'.repeat(70) + 'ü.example', 'Bücher.Example.COM', 'xn--bcher-kva.example', '-bücher-.example', 'bücher..example', 'ﬁnance.example', 'ǅemal.example']
const r = await run(lines.join('\r\n') + '\r\n', steps)
const outs = r.out.split('\r\n')
console.log('errors', JSON.stringify(r.errors))
lines.forEach((l, i) => { const n = domainToASCII(l); console.log((outs[i] === n ? 'SAME ' : 'DIFF ') + JSON.stringify(l).padEnd(48), JSON.stringify(outs[i]).padEnd(46), 'node:', JSON.stringify(n)) })
// punycode_encode alone on a multi-line list (claim: newline lands inside a label)
console.log((await run('münchen.de\nbücher.example', [{ id: 'p', utilityId: 'punycode_encode', enabled: true, params: { mode: 'domain' } } as any])).out)
