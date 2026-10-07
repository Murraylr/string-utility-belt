import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from './extract-domains-from-urls'
const steps = toPipelineSteps(recipe.steps)
console.log(JSON.stringify((await run('www.example.com/about', [{ id: 'p', utilityId: 'url_parse', enabled: true, params: {} } as any])).out))
for (const i of ['https://www.example.com/a\r\nexample.com\r\n', '   www.example.com/x\nExample.COM\nmailto:info@example.com\n//cdn.example.com/x.js\nftp://files.example.com/pub\nhttps://bücher.example/\nhttps://www.example.com./\nnot a url\n   \nhttps://WWW.Example.com\n']) {
  const r = await run(i, steps); console.log(JSON.stringify(r.out), JSON.stringify(r.errors))
}
