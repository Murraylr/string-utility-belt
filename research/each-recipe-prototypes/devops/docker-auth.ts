import { proto } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
export const recipe: Recipe = {
  slug: 'decode-docker-config-auth',
  name: 'Decode the logins in a Docker config.json',
  summary: 'Paste ~/.docker/config.json or a decoded .dockerconfigjson and see the user name and password stored for every registry, instead of decoding each auth field by hand.',
  category: 'DevOps & Config',
  primaryQuery: 'decode docker config.json auth',
  published: '2026-10-08',
  steps: [
    step('auths', 'jsonpath', { path: '$.auths', mode: 'first', indent: 2 }, 'Keeps only the auths map, one entry per registry, and drops credsStore, credHelpers and other settings.', { label: 'keep auths' }),
    each('decode', { mode: 'json-values' }, [laneStep('auth', 'jsonpath', { path: '$.auth', mode: 'first', indent: 2 }), laneStep('b64', 'base64_decode')],
      'Decodes the auth field of every registry on its own and writes it back under the registry name, as user:password.', { label: 'decode every auth' }),
  ],
  samples: [
    { id: 'config-json', title: '~/.docker/config.json after docker login', input: `{
  "auths": {
    "registry.example.com": {
      "auth": "Y2ktcm9ib3Q6bm90LWEtcmVhbC10b2tlbi0x"
    },
    "ghcr.example.org": {
      "auth": "b2N0by1idWlsZGVyOm5vdC1hLXJlYWwtdG9rZW4tMg=="
    },
    "https://index.docker.example/v1/": {
      "auth": "amRvZTpub3QtYS1yZWFsLXBhc3N3b3Jk"
    }
  }
}
`, output: `{
  "registry.example.com": "ci-robot:not-a-real-token-1",
  "ghcr.example.org": "octo-builder:not-a-real-token-2",
  "https://index.docker.example/v1/": "jdoe:not-a-real-password"
}`,
    },
    { id: 'pull-secret', title: 'decoded .dockerconfigjson', input: '{"auths":{"registry.example.com":{"username":"ci-robot","password":"not-a-real-token","auth":"Y2ktcm9ib3Q6bm90LWEtcmVhbC10b2tlbg=="}}}', output: `{
  "registry.example.com": "ci-robot:not-a-real-token"
}`,
    },
  ],
}
if (!process.env.NO_PROTO) await proto(recipe)
