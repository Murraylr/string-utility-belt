process.env.NO_PROTO = '1'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MANIFEST } from '/home/user/string-utility-belt/src/utilities/_generated/manifest'
import { RecipeArticle } from '/home/user/string-utility-belt/src/app/pages/recipes/RecipeArticle'
const metas = new Map(MANIFEST.map(m => [m.id, m]))
for (const f of ['crontab', 'ssh-fp', 'epoch', 'env-secret']) {
  const { recipe } = await import(`../${f}.ts`)
  const html = renderToStaticMarkup(<RecipeArticle recipe={recipe} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
  const m = html.match(/<section[^>]*recipe-steps-h[\s\S]*?<\/section>/)
  const text = (m ? m[0] : html).replace(/<a [^>]*href="([^"]+)"[^>]*>/g, '[$1 ').replace(/<\/a>/g, ']').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  console.log("#####", f, [...html.matchAll(/href="(\/util\/[^"]+)"/g)].map(x=>x[1]).join(" "), "| matches:", (html.match(/Runs only when|Skipped \(/g)||[]).length)
}
