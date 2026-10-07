import { proto } from '../harness'
import { recipe } from './idn-def'
import { withoutEach } from './without'
import { domainToASCII } from 'node:url'
await proto(recipe)
await withoutEach(recipe)
for (const s of recipe.samples) console.log('node domainToASCII:', JSON.stringify(s.input.split('\n').map(l => l && domainToASCII(l)).join('\n')))
