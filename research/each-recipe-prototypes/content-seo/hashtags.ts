import { proto, run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'camel-case-hashtags',
  name: 'Turn phrases into CamelCase hashtags',
  summary:
    'Paste campaign phrases one per line and get one readable #CamelCase hashtag per line, so screen readers say each word instead of one long blur.',
  category: 'Writing & Marketing',
  primaryQuery: 'camelcase hashtag generator',
  published: '2026-10-08',
  steps: [
    step('tidy', 'multi_replace', { rules: [["'", ''], ['’', ''], ['&', ' and ']], regex: false, ignoreCase: false, applyOnce: false },
      'Drops apostrophes so mother’s becomes Mothers rather than MotherS, and writes & as and, which a hashtag cannot contain.'),
    each('per-phrase', { mode: 'lines' }, [laneStep('pascal', 'format_case', { mode: 'pascal' })],
      'Format case joins every word of its input, line breaks included, so a whole list would become one tag. Run per line, each phrase becomes its own PascalCase word.',
      { label: 'PascalCase every line' }),
    step('hash', 'line_affix', { prefix: '#', suffix: '', skipBlank: true, joinWith: '' },
      'Adds the # to every line that has a tag, leaving blank lines blank.'),
  ],
  samples: [
    { id: 'campaign', title: 'Campaign phrases', input: 'mother’s day gift ideas\nblack friday deals\nrock & roll\naccessibility matters\n', output: '#MothersDayGiftIdeas\n#BlackFridayDeals\n#RockAndRoll\n#AccessibilityMatters\n' },
    { id: 'acronyms', title: 'Phrases with acronyms', input: 'SEO tips 2026\nWomen in STEM\niPhone photography\ncafé culture', output: '#SeoTips2026\n#WomenInStem\n#IPhonePhotography\n#CaféCulture' },
  ],
}
await proto(recipe)
