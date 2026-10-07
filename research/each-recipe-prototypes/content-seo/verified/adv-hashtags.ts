import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/hashtags.ts')
const steps = toPipelineSteps(recipe.steps)
const input = 'mother’s day gift ideas\nSEO tips 2026\nWomen in STEM\niPhone photography\ncafé culture\nrock & roll\n\n  black friday deals  \n#already tagged\nsuper bowl LX'
const script = ["s/['’]//g", "s/&/ and /g", "s/(^|[^\\p{L}\\p{N}])(\\p{Ll})/\\1\\u\\2/g", "s/[^\\p{L}\\p{N}]//g", "/./ s/^/#/"].join('\n')
console.log('\n=== ADV')
console.log('EACH  ', JSON.stringify((await run(input, steps)).out))
const sed = await run(input, [{ id: 's', utilityId: 'sed', enabled: true, params: { script } } as any])
console.log('SED   ', JSON.stringify(sed.out), JSON.stringify(sed.errors))
