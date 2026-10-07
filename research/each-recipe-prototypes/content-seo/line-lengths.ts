import { proto, run } from '../harness'
import { branch, each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import type { PipelineStep } from '/home/user/string-utility-belt/src/types/utility'

const countLane: PipelineStep[] = [
  laneStep('stats', 'text_stats', { format: 'json' }),
  laneStep('graphemes', 'jsonpath', { path: '$.graphemes', mode: 'first', indent: 2 }, { label: 'keep the character count' }),
]

export const recipe: Recipe = {
  slug: 'character-count-per-line',
  name: 'Count the characters on each line',
  summary:
    'Paste title tags, meta descriptions or ad headlines one per line and see each line’s character count in front of it, with emoji and accented letters counted once, the way a reader sees them.',
  category: 'Writing & Marketing',
  primaryQuery: 'character count per line',
  published: '2026-10-08',
  steps: [
    each('per-line', { mode: 'lines' }, [
      { id: 'count-and-line', type: 'branch', enabled: true, label: 'count · line', branches: [countLane, []], merge: { mode: 'concat', separator: ' · ' } },
    ],
    'Counters total the whole text, so this runs once per line. One lane counts the line’s characters as a reader sees them, an emoji or accented letter as one, and an empty lane passes the line through, so each result reads as count · line. Blank lines stay blank.',
    { label: 'count every line' }),
  ],
  samples: [
    {
      id: 'title-tags',
      title: 'Title tags',
      input: [
        'Home | Example Outdoor Co.',
        'Waterproof Hiking Boots for Men & Women – Free Returns | Example Outdoor Co.',
        'How to Choose a Sleeping Bag: Temperature Ratings Explained',
        'Trail Running Shoes – Example Outdoor Co.',
        '🎒 Backpacks on Sale – Up to 40% Off | Example Outdoor Co.',
        'Contact Us',
      ].join('\n'),
      output: '26 · Home | Example Outdoor Co.\n76 · Waterproof Hiking Boots for Men & Women – Free Returns | Example Outdoor Co.\n59 · How to Choose a Sleeping Bag: Temperature Ratings Explained\n41 · Trail Running Shoes – Example Outdoor Co.\n57 · 🎒 Backpacks on Sale – Up to 40% Off | Example Outdoor Co.\n10 · Contact Us',
    },
    {
      id: 'meta-descriptions',
      title: 'Meta descriptions',
      input: [
        'Shop waterproof hiking boots for men and women. Free returns within 60 days and free shipping on orders over $50.',
        'Learn how temperature ratings, fill power and bag shape decide which sleeping bag keeps you warm, with a quick chart for picking the right one for every season of the year.',
        '',
        'Questions about an order? Reach our team by chat or email.',
      ].join('\n'),
      output: '113 · Shop waterproof hiking boots for men and women. Free returns within 60 days and free shipping on orders over $50.\n172 · Learn how temperature ratings, fill power and bag shape decide which sleeping bag keeps you warm, with a quick chart for picking the right one for every season of the year.\n\n58 · Questions about an order? Reach our team by chat or email.',
    },
    {
      id: 'ad-headlines',
      title: 'Search ad headlines',
      input: [
        'Waterproof Hiking Boots',
        'Free Returns Within 60 Days',
        'Lightweight Boots for Every Trail',
        'Crème de la Crème of Trail Gear',
        'Shop Now',
      ].join('\n'),
      output: '23 · Waterproof Hiking Boots\n27 · Free Returns Within 60 Days\n33 · Lightweight Boots for Every Trail\n31 · Crème de la Crème of Trail Gear\n8 · Shop Now',
    },
  ],
}

await proto(recipe)

if (process.env.EDGE) {
  const steps = toPipelineSteps(recipe.steps)
  const show = async (label: string, input: string, s = steps) => {
    const r = await run(input, s)
    console.log(`\n# ${label}\n${JSON.stringify(input)}\n=> ${JSON.stringify(r.out)}${Object.keys(r.errors).length ? '  ERR ' + JSON.stringify(r.errors) : ''}`)
  }
  await show('CRLF + trailing newline + blank', 'One\r\n\r\nTwo words\r\n')
  await show('whitespace-only line, leading/trailing spaces', 'a\n   \n  padded  ')
  await show('ZWJ family + flag + decomposed accent', '👩‍👩‍👧 Family\n🇫🇷 France\nCafé')
  await show('CJK', '東京の天気')
  await show('JSON-looking line', '{"a":1}\n[1,2]\n42\ntrue')
  await show('empty', '')
  // timing on 2000 lines
  const big = Array.from({ length: 2000 }, (_, i) => `Title number ${i} – Example Outdoor Co.`).join('\n')
  const t0 = performance.now(); const r = await run(big, steps); console.log('\n2000 lines ms', Math.round(performance.now() - t0), r.out.split('\n').length)
}
