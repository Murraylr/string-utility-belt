import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'convert-idn-domains-to-punycode',
  name: 'Convert a list of IDN domains to Punycode',
  summary:
    'Paste internationalized domain names, one per line, and get the xn-- form that nginx server_name, certbot -d and DNS zone files expect, with capitals, full-width characters and IME dots mapped first.',
  category: 'DevOps & Config',
  primaryQuery: 'convert idn domains to punycode',
  published: '2026-10-08',
  steps: [
    step('nfkc', 'normalize', { form: 'NFKC' },
      'Folds full-width letters and dots typed with a Japanese or Chinese input method, ligatures such as ﬁ, and accents stored as a letter plus a combining mark into the single characters IDNA expects.',
      { label: 'NFKC normalize' }),
    step('ime-dots', 'replace', { pattern: '。', replacement: '.', regex: false, flags: 'g' },
      'IDNA treats the ideographic full stop 。 as a label dot. Unicode normalization leaves it alone, so it is replaced here, or the whole name would be encoded as one label.',
      { label: 'ideographic 。 to dot' }),
    step('lower', 'case', { mode: 'lower' },
      'IDNA maps capitals to lowercase before encoding, but the Punycode encoder keeps case, and a capital accented letter such as Ä encodes to a different xn-- label than ä. Lowercasing first gives the label browsers look up.'),
    each('encode-each', { mode: 'lines' }, [laneStep('trim', 'trim'), laneStep('puny', 'punycode_encode', { mode: 'domain' }, { condition: { kind: 'regex', pattern: '^[^\\s/@:,#]+$' } })],
      'Trims each line and encodes it as its own domain, adding xn-- only to labels with non-ASCII characters. On the whole text, line breaks would land inside labels and corrupt the names around them. Lines that are not a bare host name, such as URLs, e-mail addresses or comments, stay untouched.',
      { label: 'encode every line' }),
  ],
  samples: [
    {
      id: 'server-names',
      title: 'Names for nginx and certbot',
      input: 'Ärztehaus.example\nwww.ärztehaus.example\ncafé.example\n straße.example\nshop.ñandú.example\nstatus.example.com\nпример.испытание\n',
      output: 'xn--rztehaus-zza.example\nwww.xn--rztehaus-zza.example\nxn--caf-dma.example\nxn--strae-oqa.example\nshop.xn--and-6ma2c.example\nstatus.example.com\nxn--e1afmkfd.xn--80akhbyknj4f\n',
    },
    {
      id: 'ime-typed',
      title: 'Typed with a Japanese or Chinese IME',
      input: '例え。テスト\nｗｗｗ．例え。テスト\n例子。测试\n실례.테스트\n',
      output: 'xn--r8jz45g.xn--zckzah\nwww.xn--r8jz45g.xn--zckzah\nxn--fsqu00a.xn--0zwm56d\nxn--9n2bp8q.xn--9t4b11yi5a\n',
    },
  ],
}
