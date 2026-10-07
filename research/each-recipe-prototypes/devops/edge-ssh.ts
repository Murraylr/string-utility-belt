process.env.NO_PROTO = '1'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('./ssh-fp')
const steps = toPipelineSteps(recipe.steps)
const ED = 'AAAAC3NzaC1lZDI1NTE5AAAAIGaPc7xK1xCItitCt06F4+cX6XAD+uOe1OZUYF4D3sUe'
const cases: Record<string, string> = {
  crlf: 'ssh-ed25519 ' + ED + ' a@example.com\r\n',
  noComment: 'ssh-ed25519 ' + ED + '\n',
  trailingSpace: 'ssh-ed25519 ' + ED + '   \n',
  hashedKnownHost: '|1|F1E1KeoE/eEWhi10WpGv4OdiO6Y=|3988QV0VE8wmZL7suNrYQLITLCg= ssh-ed25519 ' + ED + '\n',
  certAuthority: '@cert-authority *.example.com ssh-ed25519 ' + ED + '\n',
  truncated: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGaPc7xK1 x@example.com\n',
  badChars: 'ssh-ed25519 AAAA!!!! x\n',
  cert: 'ssh-ed25519-cert-v01@openssh.com AAAAIHNzaC1lZDI1NTE5LWNlcnQtdjAxQG9wZW5zc2guY29t x\n',
  tabs: 'ssh-ed25519\t' + ED + '\tt@example.com\n',
  twoKeysOneLine: 'ssh-ed25519 ' + ED + ' ssh-ed25519 ' + ED + '\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log('## ' + k, JSON.stringify(r.errors)); console.log(JSON.stringify(r.out))
}
