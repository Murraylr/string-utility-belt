import { recipe as a } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/strip-tracking'
import { recipe as b } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/bulk-slugs'
import { recipe as c } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/line-lengths'
import { recipe as d } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/hashtags'
for (const r of [a, b, c, d]) {
  console.log('\n@@', r.slug, '| name', r.name.length, '| summary', r.summary.length, '| first input', r.samples[0].input.length)
  for (const s of r.steps) console.log('  why', s.id, (s.why.match(/\S+/g) ?? []).length, 'words')
}
