import { describe, it, expect } from 'vitest'
import util from './index'
import xmlToJson from '../xml_to_json/index'

describe('json_to_xml', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_xml')
    expect(util.name).toBe('json to xml')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toEqual(['string', 'json'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(
      ['attributePrefix', 'declaration', 'indent', 'itemName', 'rootName'].sort()
    )
  })

  it('converts a nested object, using a single top-level key as the root', async () => {
    const out = await util.apply('{"note":{"@id":"1","to":"Tove","from":"Jani"}}', {})
    expect(out).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<note id="1">\n' +
        '  <to>Tove</to>\n' +
        '  <from>Jani</from>\n' +
        '</note>'
    )
  })

  it('accepts an already-parsed object from a previous step', async () => {
    const out = await util.apply({ config: { debug: true, retries: 3 } } as any, { declaration: false })
    expect(out).toBe('<config>\n  <debug>true</debug>\n  <retries>3</retries>\n</config>')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n ', {})).toBe('')
  })

  it('preserves unicode and astral characters in text and attributes', async () => {
    const out = await util.apply({ gruß: { '@lang': 'de-😀', '#text': 'héllo 😀 世界' } } as any, {
      declaration: false
    })
    expect(out).toBe('<gruß lang="de-😀">héllo 😀 世界</gruß>')
    expect(Array.from(out as string).includes('😀')).toBe(true)
  })

  it('escapes XML metacharacters in text and attribute values', async () => {
    const out = await util.apply('{"x":{"@q":"say \\"hi\\"","raw":"a<b> & c"}}', { declaration: false })
    expect(out).toBe('<x q="say &quot;hi&quot;">\n  <raw>a&lt;b&gt; &amp; c</raw>\n</x>')
  })

  it('repeats sibling elements for arrays and wraps nested arrays in itemName', async () => {
    const repeated = await util.apply('{"a":1,"b":[1,2]}', { declaration: false })
    expect(repeated).toBe('<root>\n  <a>1</a>\n  <b>1</b>\n  <b>2</b>\n</root>')

    const nested = await util.apply('{"m":{"rows":[[1,2],[3]]}}', { declaration: false })
    expect(nested).toBe(
      '<m>\n  <rows>\n    <item>1</item>\n    <item>2</item>\n  </rows>\n  <rows>\n    <item>3</item>\n  </rows>\n</m>'
    )
  })

  it('honours rootName and itemName', async () => {
    const out = await util.apply('[1,2]', { rootName: 'numbers', itemName: 'n', declaration: false })
    expect(out).toBe('<numbers>\n  <n>1</n>\n  <n>2</n>\n</numbers>')
  })

  it('lets an explicit rootName override the single-top-level-key shortcut', async () => {
    // left at the default, the single key names the root
    expect(await util.apply('{"note":{"a":1}}', { rootName: 'root', declaration: false })).toBe(
      '<note>\n  <a>1</a>\n</note>'
    )
    // changed, it wraps instead of being silently ignored
    expect(await util.apply('{"note":{"a":1}}', { rootName: 'custom', declaration: false })).toBe(
      '<custom>\n  <note>\n    <a>1</a>\n  </note>\n</custom>'
    )
  })

  it('keeps a key whose value is an empty array', async () => {
    expect(await util.apply('{"x":{"a":[],"b":1}}', { declaration: false })).toBe(
      '<x>\n  <a/>\n  <b>1</b>\n</x>'
    )
  })

  it('renders non-scalar attribute and text values as JSON, not [object Object]', async () => {
    const out = await util.apply({ a: { '@x': { k: 1 }, '#text': [1, 2] } } as any, {
      declaration: false
    })
    expect(out).toBe('<a x="{&quot;k&quot;:1}">[1,2]</a>')
  })

  it('honours indent, including 0 for a single line', async () => {
    const wide = await util.apply('{"a":{"b":"c"}}', { indent: 4, declaration: false })
    expect(wide).toBe('<a>\n    <b>c</b>\n</a>')

    const flat = await util.apply('{"a":{"b":"c"}}', { indent: 0 })
    expect(flat).toBe('<?xml version="1.0" encoding="UTF-8"?><a><b>c</b></a>')
  })

  it('honours attributePrefix and declaration', async () => {
    const dollar = await util.apply('{"t":{"$id":"7","#text":"hi"}}', {
      attributePrefix: '$',
      declaration: false
    })
    expect(dollar).toBe('<t id="7">hi</t>')

    // with a different prefix configured, "@id" is just an ordinary child element
    const asChild = await util.apply('{"t":{"@id":"7"}}', { attributePrefix: '$', declaration: false })
    expect(asChild).toBe('<t>\n  <_id>7</_id>\n</t>')
  })

  it('maps null to an empty element and "" to an open/close pair', async () => {
    expect(await util.apply('{"a":null}', { declaration: false })).toBe('<a/>')
    expect(await util.apply('{"x":{"a":"","b":null}}', { declaration: false })).toBe(
      '<x>\n  <a></a>\n  <b/>\n</x>'
    )
  })

  it('sanitizes keys that are not legal XML names', async () => {
    const out = await util.apply('{"x":{"first name":"Ada","2nd":"b"}}', { declaration: false })
    expect(out).toBe('<x>\n  <first_name>Ada</first_name>\n  <_2nd>b</_2nd>\n</x>')
  })

  it('throws on invalid JSON', async () => {
    expect(() => util.apply('{oops', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('not json', {})).toThrow()
  })

  it('escapes carriage returns so they survive an XML parser', async () => {
    // an unescaped CR is normalised to LF by every XML parser, losing the value
    const xml = (await util.apply({ a: 'x\r\ny' } as any, { declaration: false })) as string
    expect(xml).toBe('<a>x&#13;\ny</a>')
    expect(await xmlToJson.apply(xml, {})).toEqual({ a: 'x\r\ny' })
  })

  it('round-trips xml -> json -> xml exactly, including unicode', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<카탈로그 id="1">\n' +
      '  <item sku="A-1">Café 😀</item>\n' +
      '  <item sku="B-2">Tea</item>\n' +
      '</카탈로그>'
    const json = await xmlToJson.apply(xml, {})
    const back = await util.apply(json as any, {})
    expect(back).toBe(xml)
  })
})
