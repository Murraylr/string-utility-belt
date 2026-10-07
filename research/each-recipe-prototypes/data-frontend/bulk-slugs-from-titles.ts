import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'bulk-slugs-from-titles',
  name: 'Turn a list of titles into URL slugs',
  summary:
    'Paste product names or post titles, one per line, and get a URL slug for each on the same line: accents stripped, lowercase, words joined by hyphens, ready for a CMS import.',
  category: 'Writing & Marketing',
  primaryQuery: 'bulk slug generator',
  published: '2026-10-08',
  steps: [
    each('slug-each', { mode: 'lines' }, [laneStep('slug', 'slug')],
      'Slugifies each line on its own. The slug utility treats a line break like any other punctuation, so the whole list pasted at once would come out as one long slug.',
      { label: 'slug every line' }),
  ],
  samples: [
    { id: 'post-titles', title: 'Blog post titles', input: '10 Tips for Better Sleep\nCafé Crème: A Guide\nWhat’s New in 2026?\n\nQ&A with Our CEO\n', output: `10-tips-for-better-sleep
cafe-creme-a-guide
what-s-new-in-2026

q-a-with-our-ceo
` },
    { id: 'product-names', title: 'Product names', input: 'Men’s Wool Socks (3-Pack)\nSmart LED Bulb — 60W Equivalent\nNaïve Art Print 50×70 cm\n', output: `men-s-wool-socks-3-pack
smart-led-bulb-60w-equivalent
naive-art-print-50-70-cm
` },
  ],
}
