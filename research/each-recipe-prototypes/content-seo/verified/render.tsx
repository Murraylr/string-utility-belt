import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeArticle, RecipeWidget } from '/home/user/string-utility-belt/src/app/pages/recipes/RecipeArticle'
import { STATIC_UTILITIES } from '/home/user/string-utility-belt/src/utilities/static-registry'
const byId = new Map(STATIC_UTILITIES.map(u => [u.id, u]))
for (const f of ['verified/strip-tracking', 'line-lengths']) {
  const { recipe } = await import(`/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/${f}.ts`)
  const html = renderToStaticMarkup(<RecipeArticle recipe={recipe} utility={(id: string) => byId.get(id) as any} guideHtml="" steps={[]} skip={[]} related={[]}
    live={<RecipeWidget samples={recipe.samples} sampleId={recipe.samples[0].id} input="" output="" stepCount={recipe.steps.length} openHref="#" />} />)
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  console.log('\nRENDER', recipe.slug, '| mentions gclid:', /gclid/.test(text), '| mentions condition regex:', /Runs only when/.test(text), '| params shown:', /drop keys/.test(text), '| text_stats/jsonpath linked:', /util\/text_stats\//.test(html), /util\/jsonpath\//.test(html))
  console.log('  widget:', (text.match(/\d+ steps?, every one editable/) || [])[0])
  console.log('  step section:', (text.match(/Step by step.{0,260}/) || [])[0])
}
