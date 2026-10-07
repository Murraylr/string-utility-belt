process.env.NO_PROTO = '1'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('../docker-auth')
const steps = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  identityToken: '{"auths":{"myregistry.azurecr.example":{"auth":"MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwOg==","identitytoken":"eyJhbGciOiJub25lIn0.e30."}}}',
  noAuthsKey: '{"credsStore":"desktop","currentContext":"default"}',
  k8sSecretYaml: 'apiVersion: v1\nkind: Secret\ndata:\n  .dockerconfigjson: eyJhdXRocyI6e319\n',
  passwordOnly: '{"auths":{"r.example.com":{"username":"u","password":"p"}}}',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log(`## ${k}`, JSON.stringify(r.errors)); console.log(r.out.slice(0, 300))
}
