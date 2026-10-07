import { proto, run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'bulk-slug-generator',
  name: 'Turn a list of titles into URL slugs',
  summary:
    'Paste post titles or product names one per line and get one clean URL slug per line, with ß, ø, æ and ł spelled out, apostrophes dropped and blank rows kept so a spreadsheet column still lines up.',
  category: 'Writing & Marketing',
  primaryQuery: 'bulk slug generator',
  published: '2026-10-08',
  steps: [
    step('spell-out', 'multi_replace', {
      rules: [
        ['ß', 'ss'], ['æ', 'ae'], ['ø', 'o'], ['œ', 'oe'], ['ł', 'l'], ['đ', 'd'], ['ð', 'd'], ['þ', 'th'], ['ı', 'i'],
        ["'", ''], ['’', ''], ['&', ' and '],
      ],
      regex: false, ignoreCase: true, applyOnce: false,
    },
    'The slug step strips accents by decomposing letters, but ß, ø, æ, œ, ł, đ, ð, þ and ı have no accent to strip, so it cuts them out: Straße becomes stra-e and Łódź odz. This table spells them out, drops apostrophes so don’t stays one word, and writes & as and.',
    { label: 'spell out special letters' }),
    each('per-title', { mode: 'lines' }, [laneStep('slug', 'slug')],
      'The slug step turns every run of characters other than letters and digits into one hyphen, line breaks included, so a whole list would become one long slug. Running it once per line gives one slug per title, and blank rows stay blank so the results paste back beside their titles.',
      { label: 'slug every line' }),
  ],
  samples: [
    {
      id: 'blog-titles',
      title: 'Blog post titles',
      input: [
        'Don’t Miss: 10 SEO Tips for 2026',
        'Email Marketing & Automation — A Beginner’s Guide',
        'What Is a Canonical Tag? (And Why It Matters)',
        '',
        'Black Friday: 50% Off Everything!',
        'How We Cut Page Load Time by 3.2 Seconds',
        '',
      ].join('\n'),
      output: 'dont-miss-10-seo-tips-for-2026\nemail-marketing-and-automation-a-beginners-guide\nwhat-is-a-canonical-tag-and-why-it-matters\n\nblack-friday-50-off-everything\nhow-we-cut-page-load-time-by-3-2-seconds\n',
    },
    {
      id: 'european-products',
      title: 'European product names',
      input: [
        'Straßenbahn Wandkalender 2027',
        'Smørrebrød Serving Board – Oak',
        'Łódź Linen Napkins (Set of 4)',
        'Crème Brûlée Torch',
        'Ærø Wool Throw',
        'İstanbul Çay Glasses',
      ].join('\n'),
      output: 'strassenbahn-wandkalender-2027\nsmorrebrod-serving-board-oak\nlodz-linen-napkins-set-of-4\ncreme-brulee-torch\naero-wool-throw\nistanbul-cay-glasses',
    },
  ],
}

await proto(recipe)

if (process.env.EDGE) {
  const steps = toPipelineSteps(recipe.steps)
  const show = async (label: string, input: string) => {
    const r = await run(input, steps)
    console.log(`\n# ${label}\n${JSON.stringify(input)}\n=> ${JSON.stringify(r.out)}${Object.keys(r.errors).length ? '  ERR ' + JSON.stringify(r.errors) : ''}`)
  }
  await show('CRLF + trailing newline', 'One Title\r\n\r\nTwo & Three\r\n')
  await show('uppercase specials', 'STRASSE ẞ ÆØÅ ŁÓDŹ ÐÞ')
  await show('non-latin only', 'Привет мир\n東京 Travel Guide\nΑθήνα')
  await show('C++ vs C#', 'C++ vs C#\nC# Tips')
  await show('emoji + punctuation only', '🎉🎉\n---\n!!!')
  await show('long title', 'The Complete, Definitive, Absolutely Exhaustive Guide to Writing Title Tags That Actually Get Clicked in 2026')
  await show('whitespace-only line', 'a b\n   \nc d')
  await show('ascii apostrophe + backtick + prime', "Rock 'n' Roll\nIt`s\nThe 5′ Rule")
  await show('Turkish/Vietnamese/Romanian', 'Kılıç ve Şövalye\nPhở Bò Hà Nội\nȘtiri și Țări')
  await show('empty', '')
}
