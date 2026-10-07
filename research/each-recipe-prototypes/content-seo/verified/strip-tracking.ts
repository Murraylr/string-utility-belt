import { proto, run } from '../../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'

/** Click ids and campaign tags that only identify the visit, never the page (ClearURLs global rules, Brave, Google Ads docs). */
export const TRACKERS = [
  'utm_*',
  // Google Ads and Merchant Center
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid', 'srsltid', '_gl',
  // Meta, Microsoft, X, TikTok, LinkedIn
  'fbclid', 'igshid', 'igsh', 'msclkid', 'twclid', 'ttclid', 'li_fat_id',
  // email platforms: Mailchimp, HubSpot, Marketo, MailerLite, Vero
  'mc_cid', 'mc_eid', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'hsCtaTracking', 'hsa_*', 'mkt_tok',
  'ml_subscriber', 'ml_subscriber_hash', 'vero_id', 'vero_conv',
  // others in the ClearURLs and Firefox lists
  'yclid', 'oly_anon_id', 'oly_enc_id', 's_cid', 'rb_clickid', 'wickedid',
].join(',')

/** A line that is one link with a query string: no spaces, something after the ?. */
/** A line that is one bare link or root-relative path with a query: nothing that wraps a link (quotes, brackets, parentheses) or separates CSV fields. */
const URL_CHAR = String.raw`[^\s"'<>()\[\]{}|\\^,]`
const ONE_LINK_WITH_QUERY = String.raw`^\s*(?:https?://|//|/|[a-z0-9-]+(?:\.[a-z0-9-]+)+[/?])` + URL_CHAR + '*\\?' + URL_CHAR + String.raw`+\s*$`

export const recipe: Recipe = {
  slug: 'remove-tracking-parameters-from-urls',
  name: 'Remove tracking parameters from a list of URLs',
  summary:
    'Paste links one per line and get them back without utm_ tags, fbclid, gclid, srsltid and other click ids, with the parameters a page needs, the order and any #anchor kept.',
  category: 'Writing & Marketing',
  primaryQuery: 'remove tracking parameters from urls',
  published: '2026-10-08',
  related: ['bulk-utm-link-builder'],
  steps: [
    step('unescape', 'unescape_html', {},
      'Links copied from an email template or page source write & as &amp;. That turns the next parameter name into amp;utm_source, which no list matches. Only the basic HTML escapes are undone, so a parameter such as &reg= is not turned into ®=.',
      { label: 'undo &amp;' }),
    each('per-link', { mode: 'lines' }, [
      laneStep('strip', 'query_params_normalize', {
        sort: false, dedupe: 'none', dropEmpty: false, drop: TRACKERS, decode: false, lowercaseHost: false,
      }, { condition: { kind: 'regex', pattern: ONE_LINK_WITH_QUERY, flags: 'i' }, label: 'drop tracking parameters' }),
    ],
    'Normalize query params reads its input as one URL: given a whole list, it took later links for part of a tracking value and deleted them. Run once per line, it touches only a bare link or path with a ?, so headings, notes, links in quotes or brackets and CSV rows stay as typed. Other parameters keep their order.',
    { label: 'clean every link' }),
  ],
  samples: [
    {
      id: 'content-audit',
      title: 'Links gathered for a content audit',
      input: '',
      output: 'https://shop.example.com/products/trail-runner-2?variant=41\nhttps://www.example.com/blog/choosing-running-shoes\nhttps://shop.example.com/collections/sale?page=2\nhttps://shop.example.com/products/rain-shell\nhttps://www.example.com/pricing?plan=team#compare\nhttps://shop.example.com/search?q=waterproof+jacket&color=blue&color=green\nhttps://shop.example.com/products/gift-card?amount=50\nhttps://www.example.com/contact\n',
    },
    {
      id: 'email-html',
      title: 'Links from an email template',
      input: '',
      output: 'October newsletter: which links still carry trackers?\nhttps://www.example.com/webinars/content-audit\nhttps://www.example.com/guides/seo-audit-checklist\nhttps://events.example.org/2026/lyon-meetup?ticket=early#agenda\n',
    },
    {
      id: 'ga4-paths',
      title: 'Landing page paths (GA4)',
      input: '',
      output: '/pricing?plan=pro\n/blog/seo-checklist\n/\n/docs/getting-started#install\n/landing/summer?ref=tiktok\n/p/insta-launch',
    },
  ],
}

recipe.samples[0].input = [
  'https://shop.example.com/products/trail-runner-2?variant=41&utm_source=newsletter&utm_medium=email&utm_campaign=fall_sale_2026',
  'https://www.example.com/blog/choosing-running-shoes?fbclid=IwZXh0bgNhZW0CMTEAARSrOw6IhJ9_y136Cf41Am5NIGKCAbQTOyOlNRfoB4',
  'https://shop.example.com/collections/sale?page=2&gad_source=1&gad_campaignid=21839402711&gclid=Cj0KCQjwUGX1QmH8HPvAUjzF68YqzMp4qDwTG_5DQi3bGeiO_BL9skGVIlG-ImOrWbMY_BwE',
  'https://shop.example.com/products/rain-shell?srsltid=AfmBOoDdEmWqX6LUQ5CYh87r4hTuS1i2p_AP25bEfZswbpTmxm',
  'https://www.example.com/pricing?plan=team&msclkid=316e70c60cf58bf70f3f6cda88f99b0b#compare',
  'https://shop.example.com/search?q=waterproof+jacket&color=blue&color=green&utm_source=onsite',
  'https://shop.example.com/products/gift-card?amount=50&amp;mc_cid=1607f293e8&amp;mc_eid=0e96b356ee',
  'https://www.example.com/contact',
  '',
].join('\n')

recipe.samples[1].input = [
  'October newsletter: which links still carry trackers?',
  'https://www.example.com/webinars/content-audit?utm_source=hs_email&amp;utm_medium=email&amp;_hsenc=p2ANqtz-CKAYqPpnew5Dlw-AI0c7sOltsJKj9wcESykzUVbpQ2AE3KG9UTrTyGtki73q&amp;_hsmi=289412311',
  'https://www.example.com/guides/seo-audit-checklist?utm_campaign=october_newsletter&amp;hsCtaTracking=7c1f2b9e-4d3a-4e8f-9a61-2b5c8d0e3f47%7C3a9d6e12-5b7c-4f80-a1d2-6e9f0b3c4d58',
  'https://events.example.org/2026/lyon-meetup?ticket=early&amp;mkt_tok=NzQ3LUZXUC0yMDQAAAGIy_W1kaSpeWkF1X3fAfZmhY7-0ZJqnLj48Jg960b#agenda',
  '',
].join('\n')

recipe.samples[2].input = [
  '/pricing?plan=pro&utm_source=linkedin&utm_medium=paid_social&li_fat_id=2caab4c1-ab67-ffd2-3117-998aa6d85563',
  '/blog/seo-checklist?srsltid=AfmBOoDdEmWqX6LUQ5CYh87r4hTuS1i2p_AP25bEfZswbpTmxm',
  '/?gad_source=1&gbraid=0AAAAADm7yUoR3sj-os6t1hzNFUNKgpC&gclid=Cj0KCQjwUGX1QmH8HPvAUjzF68YqzMp4qDwTG_5DQi3bGeiO_BL9skGVIlG-ImOrWbMY_BwE',
  '/docs/getting-started#install',
  '/landing/summer?ttclid=E.C.P.pC2MfOaqGWBn6kS4TeBpDnVz65EGpaR04NDbvFH3&ref=tiktok',
  '/p/insta-launch?igsh=yj3fkm96jn9fwjuf',
].join('\n')

await proto(recipe)

// --- edge cases ---
const steps = toPipelineSteps(recipe.steps)
const show = async (label: string, input: string, s = steps) => {
  const r = await run(input, s)
  console.log(`\n# ${label}\n${JSON.stringify(input)}\n=> ${JSON.stringify(r.out)}${Object.keys(r.errors).length ? '  ERR ' + JSON.stringify(r.errors) : ''}`)
}
if (process.env.EDGE) {
  await show('CRLF + blank lines + trailing newline', 'https://a.example.com/?utm_source=x&id=1\r\n\r\nhttps://b.example.com/?fbclid=1\r\n')
  await show('indented + trailing space', '   https://a.example.com/x?utm_source=x&id=1   \n\thttps://b.example.com/?gclid=2')
  await show('markdown bullet (skipped by condition)', '- https://a.example.com/x?utm_source=x&id=1')
  await show('text after URL (skipped)', 'https://a.example.com/x?utm_source=x see notes')
  await show('only trackers -> no dangling ?', 'https://a.example.com/x?utm_source=x&utm_medium=y')
  await show('uppercase keys + percent-encoded key', 'https://a.example.com/x?UTM_SOURCE=x&%75tm_medium=y&FBCLID=z&keep=1')
  await show('key without value + empty value', 'https://a.example.com/x?utm_source&q=&id=1&gclid=')
  await show('tracker in fragment (SPA route) untouched', 'https://a.example.com/#/route?utm_source=x')
  await show('fragment containing ?', 'https://a.example.com/page?utm_source=x#faq?q=1')
  await show('non-URL lines with & and =', 'Tips & tricks\nprice=20% off\nfbclid\nWhy?')
  await show('unicode path + IDN', 'https://bücher.example/straße?utm_source=x&seite=2')
  await show('similar names kept (utmost, gclid_old)', 'https://a.example.com/?utmost=1&utm=2&gclid_old=3&ref=x')
  await show('semicolon-separated', 'https://a.example.com/?a=1;utm_source=x')
  await show('double escaped &amp;amp;', 'https://a.example.com/?a=1&amp;amp;utm_source=x')
  await show('empty input', '')
  // without the condition
  const noCond = toPipelineSteps(recipe.steps) as any[]
  delete noCond[1].steps[0].condition
  await show('NO CONDITION: sample 2', recipe.samples[1].input, noCond)
  await show('NO CONDITION: notes', 'Tips & tricks\nWhy?\nfbclid\n  indented note  ', noCond)
  // single step on whole text (what the each fixes)
  await show('WHOLE TEXT, no each', recipe.samples[0].input, [steps[0], (steps[1] as any).steps[0]])
}
